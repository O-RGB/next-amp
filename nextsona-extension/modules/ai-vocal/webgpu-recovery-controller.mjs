/**
 * Small, dependency-free helpers for the browser AI recovery path.
 *
 * This file deliberately does not import TensorFlow.js and does not touch
 * audio. Keeping the timeout/coordinator logic separate makes it possible to
 * test the dangerous async cases in Node without requiring a real GPU.
 */

export class WebGpuReadbackTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`WebGPU readback exceeded ${timeoutMs}ms`);
    this.name = "WebGpuReadbackTimeoutError";
    this.recoverable = true;
    this.timeoutMs = timeoutMs;
  }
}

export function clampRecoveryTimeout(candidateMs, minMs, maxMs) {
  const candidate = Number(candidateMs);
  const min = Number(minMs);
  const max = Number(maxMs);
  if (!Number.isFinite(candidate) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError("Recovery timeout values must be finite numbers");
  }
  if (min < 0 || max < min) throw new RangeError("Invalid recovery timeout range");
  return Math.min(max, Math.max(min, candidate));
}

export function calculateWebGpuReadbackTimeout({
  chunkMs,
  p95Ms = 0,
  lastInferMs = 0,
  minMs = 1000,
  maxMs = 2000,
  p95Multiplier = 8,
  chunkMultiplier = 5
} = {}) {
  const chunk = Number(chunkMs);
  const p95 = Number(p95Ms);
  const last = Number(lastInferMs);
  const history = Math.max(
    Number.isFinite(p95) && p95 > 0 ? p95 : 0,
    Number.isFinite(last) && last > 0 ? last : 0
  );
  const candidate = Math.max(
    Number(minMs),
    history * Number(p95Multiplier),
    (Number.isFinite(chunk) && chunk > 0 ? chunk : 0) * Number(chunkMultiplier)
  );
  return clampRecoveryTimeout(candidate, minMs, maxMs);
}

/**
 * Dispose the current WebGPU backend instance without permanently deleting
 * the backend factory. TensorFlow.js removeBackend() removes both; failing to
 * register the captured factory again makes every later setBackend("webgpu")
 * fail in the same offscreen document.
 */
export function recycleWebGpuBackend(runtime = globalThis.tf) {
  if (!runtime || runtime.getBackend?.() !== "webgpu" || !runtime.removeBackend) {
    return false;
  }

  let factory = null;
  try { factory = runtime.findBackendFactory?.("webgpu") || null; } catch (_) {}

  try {
    runtime.removeBackend("webgpu");
  } catch (_) {
    return false;
  }

  if (factory && runtime.registerBackend) {
    try {
      if (!runtime.findBackendFactory?.("webgpu")) {
        // Match the priority used by @tensorflow/tfjs-backend-webgpu.
        runtime.registerBackend("webgpu", factory, 3);
      }
    } catch (_) {
      // If registration fails, ensureWebGpuBackend() will reload the bundled
      // provider script on the next activation.
    }
  }
  return true;
}

/**
 * Observe a Promise with a deadline without creating an unhandled rejection.
 *
 * `task` may be a Promise or a function returning a Promise. The original
 * Promise is always observed, including the case where the timeout wins.
 * The caller must dispose any resource returned by a late-settling task in
 * `onLateSettle`; the helper intentionally cannot guess how to dispose it.
 */
export function settleWithDeadline(task, timeoutMs, { onLateSettle } = {}) {
  const source = typeof task === "function"
    ? Promise.resolve().then(task)
    : Promise.resolve(task);
  const deadline = Number(timeoutMs);
  if (!Number.isFinite(deadline) || deadline < 0) {
    return Promise.reject(new TypeError("timeoutMs must be a non-negative number"));
  }

  let timedOut = false;
  let timer = null;
  const observed = source.then(
    value => {
      if (timedOut) {
        try { onLateSettle?.({ status: "fulfilled", value }); } catch (_) {}
        return { status: "late-fulfilled", value };
      }
      return { status: "fulfilled", value };
    },
    error => {
      if (timedOut) {
        try { onLateSettle?.({ status: "rejected", error }); } catch (_) {}
        return { status: "late-rejected", error };
      }
      return { status: "rejected", error };
    }
  );
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve({
        status: "timeout",
        error: new WebGpuReadbackTimeoutError(deadline)
      });
    }, deadline);
  });

  return Promise.race([observed, timeout]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}

/**
 * Serialize process-wide WebGPU recovery. TensorFlow.js owns one backend per
 * offscreen document, so two AIVocalManager instances must never remove and
 * recreate that backend concurrently.
 */
export class WebGpuRecoveryCoordinator {
  constructor() {
    this.managers = new Set();
    this.sharedRecoveryPromise = null;
    this.sharedBackendTransitionPromise = null;
    this.backendEpoch = 0;
  }

  register(manager) {
    if (manager && typeof manager === "object") this.managers.add(manager);
    return () => this.unregister(manager);
  }

  unregister(manager) {
    this.managers.delete(manager);
  }

  releaseBackendIfUnused() {
    const activeWebGpuManager = Array.from(this.managers).some(manager => {
      try {
        return manager?.backendType === "webgpu" &&
          manager?.destroyed !== true && manager?.currentMode !== "bypass";
      } catch (_) {
        return false;
      }
    });
    if (activeWebGpuManager) return false;
    const runtime = globalThis.tf;
    if (recycleWebGpuBackend(runtime)) {
      this.backendEpoch++;
      return true;
    }
    return false;
  }

  /**
   * TensorFlow.js owns one mutable backend registry per offscreen document.
   * Serialize deliberate provider changes as well as recovery changes so a
   * rapid ECO/QUALITY toggle cannot call setBackend while another manager is
   * disposing/loading the shared runtime.
   */
  runBackendTransition(task) {
    if (typeof task !== "function") {
      return Promise.reject(new TypeError("backend transition task must be a function"));
    }
    const previous = this.sharedBackendTransitionPromise || Promise.resolve();
    const transition = previous.catch(() => {}).then(task);
    const tracked = transition.finally(() => {
      if (this.sharedBackendTransitionPromise === tracked) {
        this.sharedBackendTransitionPromise = null;
      }
    });
    this.sharedBackendTransitionPromise = tracked;
    return tracked;
  }

  request(requester, reason = "unknown") {
    if (this.sharedRecoveryPromise) return this.sharedRecoveryPromise;

    this.sharedRecoveryPromise = (async () => {
      const participants = Array.from(this.managers).filter(manager => {
        try {
          return manager !== null && manager !== undefined &&
            typeof manager.beginWebGpuRecovery === "function" &&
            typeof manager.finishWebGpuRecovery === "function" &&
            manager.canRecoverWebGpu?.() !== false;
        } catch (_) {
          return false;
        }
      });

      if (requester && !participants.includes(requester) &&
          typeof requester.beginWebGpuRecovery === "function" &&
          typeof requester.finishWebGpuRecovery === "function") {
        participants.push(requester);
      }

      for (const manager of participants) {
        await manager.beginWebGpuRecovery(reason);
      }

      const runtime = globalThis.tf;
      recycleWebGpuBackend(runtime);
      this.backendEpoch++;

      const results = [];
      for (const manager of participants) {
        try {
          results.push(await manager.finishWebGpuRecovery({
            reason,
            backendEpoch: this.backendEpoch
          }));
        } catch (error) {
          results.push({ ok: false, error });
        }
      }
      return results;
    })().finally(() => {
      this.sharedRecoveryPromise = null;
    });

    return this.sharedRecoveryPromise;
  }
}

export const webGpuRecoveryCoordinator = new WebGpuRecoveryCoordinator();
