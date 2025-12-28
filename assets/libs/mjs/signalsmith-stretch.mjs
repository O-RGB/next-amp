let module = {},
  exports = {};
var SignalsmithStretch = (() => {
  var t = "undefined" != typeof document ? document.currentScript?.src : void 0;
  return function (e = {}) {
    var r,
      s,
      n,
      i = e,
      o = new Promise((t, e) => {
        (r = t), (s = e);
      }),
      a = "object" == typeof window,
      u = "undefined" != typeof WorkerGlobalScope,
      f =
        "object" == typeof process &&
        "object" == typeof process.versions &&
        "string" == typeof process.versions.node &&
        "renderer" != process.type,
      l = !a && !f && !u,
      h = globalThis?.crypto || {
        getRandomValues: (t) => {
          for (var e = 0; e < t.length; e++) t[e] = (256 * Math.random()) | 0;
        },
      },
      p = (globalThis, Object.assign({}, i)),
      c = (t, e) => {
        throw e;
      },
      m = "";
    l
      ? ((n = (t) => {
          if ("function" == typeof readbuffer)
            return new Uint8Array(readbuffer(t));
          let e = read(t, "binary");
          return assert("object" == typeof e), e;
        }),
        (globalThis.clearTimeout ??= (t) => {}),
        (globalThis.setTimeout ??= (t) => t()),
        globalThis.arguments || globalThis.scriptArgs,
        "function" == typeof quit &&
          (c = (t, e) => {
            throw (
              (setTimeout(() => {
                if (!(e instanceof j)) {
                  let t = e;
                  e && "object" == typeof e && e.stack && (t = [e, e.stack]),
                    g(`exiting due to exception: ${t}`);
                }
                quit(t);
              }),
              e)
            );
          }),
        "undefined" != typeof print &&
          ((globalThis.console ??= {}),
          (console.log = print),
          (console.warn = console.error = globalThis.printErr ?? print)))
      : (a || u) &&
        (u
          ? (m = self.location.href)
          : "undefined" != typeof document &&
            document.currentScript &&
            (m = document.currentScript.src),
        t && (m = t),
        (m = m.startsWith("blob:")
          ? ""
          : m.substr(0, m.replace(/[?#].*/, "").lastIndexOf("/") + 1)),
        u &&
          (n = (t) => {
            var e = new XMLHttpRequest();
            return (
              e.open("GET", t, !1),
              (e.responseType = "arraybuffer"),
              e.send(null),
              new Uint8Array(e.response)
            );
          }));
    console.log.bind(console);
    var d,
      g = console.error.bind(console);
    function y(t) {
      if (O(t))
        return (function (t) {
          for (
            var e = atob(t), r = new Uint8Array(e.length), s = 0;
            s < e.length;
            ++s
          )
            r[s] = e.charCodeAt(s);
          return r;
        })(t.slice(L.length));
    }
    Object.assign(i, p),
      (p = null),
      "undefined" == typeof atob &&
        ("undefined" != typeof global &&
          "undefined" == typeof globalThis &&
          (globalThis = global),
        (globalThis.atob = function (t) {
          var e,
            r,
            s,
            n,
            i,
            o,
            a =
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
            u = "",
            f = 0;
          t = t.replace(/[^A-Za-z0-9\+\/\=]/g, "");
          do {
            (e =
              (a.indexOf(t.charAt(f++)) << 2) |
              ((n = a.indexOf(t.charAt(f++))) >> 4)),
              (r = ((15 & n) << 4) | ((i = a.indexOf(t.charAt(f++))) >> 2)),
              (s = ((3 & i) << 6) | (o = a.indexOf(t.charAt(f++)))),
              (u += String.fromCharCode(e)),
              64 !== i && (u += String.fromCharCode(r)),
              64 !== o && (u += String.fromCharCode(s));
          } while (f < t.length);
          return u;
        }));
    var b,
      v,
      S = !1;
    function w() {
      var t = d.buffer;
      (i.HEAP8 = new Int8Array(t)),
        new Int16Array(t),
        (v = new Uint8Array(t)),
        new Uint16Array(t),
        new Int32Array(t),
        new Uint32Array(t),
        new Float32Array(t),
        new Float64Array(t);
    }
    var _ = [],
      M = [],
      T = [],
      B = [];
    var A = 0,
      C = null,
      x = null;
    function R(t) {
      g((t = "Aborted(" + t + ")")),
        (S = !0),
        (t += ". Build with -sASSERTIONS for more info.");
      var e = new WebAssembly.RuntimeError(t);
      throw (s(e), e);
    }
    var E,
      L = "data:application/octet-stream;base64,",
      O = (t) => t.startsWith(L);
    function I(t) {
      var e = y(t);
      if (e) return e;
      if (n) return n(t);
      throw "both async and sync fetching of the wasm failed";
    }
    function k(t, e, r) {
      return (function (t) {
        return O(t)
          ? Promise.resolve().then(() => I(t))
          : (a || u) && "function" == typeof fetch
          ? fetch(t, { credentials: "same-origin" })
              .then((e) => {
                if (!e.ok)
                  throw "failed to load wasm binary file at '" + t + "'";
                return e.arrayBuffer();
              })
              .catch(() => I(t))
          : Promise.resolve().then(() => I(t));
      })(t)
        .then((t) => WebAssembly.instantiate(t, e))
        .then(r, (t) => {
          g(`failed to asynchronously prepare wasm: ${t}`), R(t);
        });
    }
    class j {
      name = "ExitStatus";
      constructor(t) {
        (this.message = `Program terminated with exit(${t})`),
          (this.status = t);
      }
    }
    var F,
      P = (t) => {
        for (; t.length > 0; ) t.shift()(i);
      },
      W = (t, e) => Math.ceil(t / e) * e,
      U = (t) => {
        R("OOM");
      },
      H = (t) => {
        var e = ((t - d.buffer.byteLength + 65535) / 65536) | 0;
        try {
          return d.grow(e), w(), 1;
        } catch (t) {}
      },
      N = (t) =>
        (N = (() => {
          if ("object" == typeof h && "function" == typeof h.getRandomValues)
            return (t) => h.getRandomValues(t);
          R("initRandomDevice");
        })())(t),
      D = (t, e) => {
        var r;
        (b = t), (b = r = t), c(r, new j(r));
      },
      z = "undefined" != typeof TextDecoder ? new TextDecoder() : void 0,
      $ = {
        d: () => R(""),
        c: (t, e, r) => v.copyWithin(t, e, e + r),
        b: (t) => {
          var e = v.length,
            r = 2147483648;
          (t >>>= 0) > r && U();
          for (var s = 1; s <= 4; s *= 2) {
            var n = e * (1 + 0.5 / s);
            n = Math.min(n, t + 100663296);
            var i = Math.min(r, W(Math.max(t, n), 65536));
            if (H(i)) return !0;
          }
          U();
        },
        a: (t, e) => (N(v.subarray(t, t + e)), 0),
      },
      q = (function () {
        function t(t, e) {
          var r;
          return (
            (q = t.exports),
            (d = q.e),
            w(),
            (r = q.f),
            M.unshift(r),
            (function () {
              if (
                0 == --A &&
                (null !== C && (clearInterval(C), (C = null)), x)
              ) {
                var t = x;
                (x = null), t();
              }
            })(),
            q
          );
        }
        A++;
        var e,
          r,
          n,
          o,
          a = { a: $ };
        return (
          (E ??=
            ((e = i.wasmBinaryFile || "signalsmith-stretch.wasm"),
            m ? m + e : e)),
          ((r = E),
          (n = a),
          (o = function (e) {
            t(e.instance);
          }),
          k(r, n, o)).catch(s),
          {}
        );
      })(),
      V =
        ((i._setBuffers = (t, e) => (i._setBuffers = q.h)(t, e)),
        (i._blockSamples = () => (i._blockSamples = q.i)()),
        (i._intervalSamples = () => (i._intervalSamples = q.j)()),
        (i._inputLatency = () => (i._inputLatency = q.k)()),
        (i._outputLatency = () => (i._outputLatency = q.l)()),
        (i._reset = () => (i._reset = q.m)()),
        (i._presetDefault = (t, e) => (i._presetDefault = q.n)(t, e)),
        (i._presetCheaper = (t, e) => (i._presetCheaper = q.o)(t, e)),
        (i._configure = (t, e, r, s) => (i._configure = q.p)(t, e, r, s)),
        (i._setTransposeFactor = (t, e) => (i._setTransposeFactor = q.q)(t, e)),
        (i._setTransposeSemitones = (t, e) =>
          (i._setTransposeSemitones = q.r)(t, e)),
        (i._setFormantFactor = (t, e) => (i._setFormantFactor = q.s)(t, e)),
        (i._setFormantSemitones = (t, e) =>
          (i._setFormantSemitones = q.t)(t, e)),
        (i._setFormantBase = (t) => (i._setFormantBase = q.u)(t)),
        (i._seek = (t, e) => (i._seek = q.v)(t, e)),
        (i._process = (t, e) => (i._process = q.w)(t, e)),
        (i._flush = (t) => (i._flush = q.x)(t)),
        (i._main = (t, e) => (V = i._main = q.y)(t, e)));
    function G() {
      var t = V;
      try {
        var e = t(0, 0);
        return D(e), e;
      } catch (t) {
        return ((t) => {
          if (t instanceof j || "unwind" == t) return b;
          c(1, t);
        })(t);
      }
    }
    function J() {
      A > 0 ||
        (P(_),
        A > 0 ||
          F ||
          ((F = !0),
          (i.calledRun = !0),
          S || (P(M), P(T), r(i), X && G(), P(B))));
    }
    (i.UTF8ToString = (t, e) =>
      t
        ? ((t, e = 0, r = NaN) => {
            for (var s = e + r, n = e; t[n] && !(n >= s); ) ++n;
            if (n - e > 16 && t.buffer && z) return z.decode(t.subarray(e, n));
            for (var i = ""; e < n; ) {
              var o = t[e++];
              if (128 & o) {
                var a = 63 & t[e++];
                if (192 != (224 & o)) {
                  var u = 63 & t[e++];
                  if (
                    (o =
                      224 == (240 & o)
                        ? ((15 & o) << 12) | (a << 6) | u
                        : ((7 & o) << 18) |
                          (a << 12) |
                          (u << 6) |
                          (63 & t[e++])) < 65536
                  )
                    i += String.fromCharCode(o);
                  else {
                    var f = o - 65536;
                    i += String.fromCharCode(
                      55296 | (f >> 10),
                      56320 | (1023 & f)
                    );
                  }
                } else i += String.fromCharCode(((31 & o) << 6) | a);
              } else i += String.fromCharCode(o);
            }
            return i;
          })(v, t, e)
        : ""),
      (x = function t() {
        F || J(), F || (x = t);
      });
    var X = !0;
    return J(), o;
  };
})();
function registerWorkletProcessor(t, e) {
  class r extends AudioWorkletProcessor {
    constructor(e) {
      super(e),
        (this.wasmReady = !1),
        (this.wasmModule = null),
        (this.channels = 0),
        (this.buffersIn = []),
        (this.buffersOut = []),
        (this.audioBuffers = []),
        (this.audioBuffersStart = 0),
        (this.audioBuffersEnd = 0),
        (this.timeIntervalSamples = 0.1 * sampleRate),
        (this.timeIntervalCounter = 0),
        (this.timeMap = [
          {
            active: !1,
            input: 0,
            output: 0,
            rate: 1,
            semitones: 0,
            tonalityHz: 8e3,
            formantSemitones: 0,
            formantCompensation: !1,
            formantBaseHz: 0,
            loopStart: 0,
            loopEnd: 0,
          },
        ]);
      let r = {
          configure: (t) => {
            Object.assign(this.config, t), this.configure();
          },
          latency: (t) => this.inputLatencySeconds + this.outputLatencySeconds,
          setUpdateInterval: (t) => {
            this.timeIntervalSamples = sampleRate * t;
          },
          stop: (t) => (
            "number" != typeof t && (t = currentTime),
            r.schedule({ active: !1, output: t })
          ),
          start: (t, e, s, n, i) => {
            if ("object" == typeof t)
              return "active" in t || (t.active = !0), r.schedule(t);
            let o = {
              active: !0,
              input: 0,
              output: currentTime + this.outputLatencySeconds,
            };
            "number" == typeof t && (o.output = t),
              "number" == typeof e && (o.input = e),
              "number" == typeof n && (o.rate = n),
              "number" == typeof i && (o.semitones = i);
            let a = r.schedule(o);
            return (
              "number" == typeof s &&
                (r.stop(o.output + s),
                (o.output += s),
                (o.active = !1),
                r.schedule(o)),
              a
            );
          },
          schedule: (t, e) => {
            let r = "outputTime" in t ? t.outputTime : currentTime,
              s = this.timeMap[this.timeMap.length - 1];
            for (
              ;
              this.timeMap.length &&
              this.timeMap[this.timeMap.length - 1].output >= r;

            )
              s = this.timeMap.pop();
            let n = Object.assign({}, s);
            if (
              (Object.assign(n, { input: null, output: r }),
              Object.assign(n, t),
              null === n.input)
            ) {
              let t = s.active ? s.rate : 0;
              n.input = s.input + (n.output - s.output) * t;
            }
            if ((this.timeMap.push(n), e && this.timeMap.length > 1)) {
              let t = this.timeMap[this.timeMap.length - 2];
              if (t.output < currentTime) {
                let e = t.active ? t.rate : 0;
                (t.input += (currentTime - t.output) * e),
                  (t.output = currentTime);
              }
              t.rate = (n.input - t.input) / (n.output - t.output);
            }
            let i = this.timeMap[0];
            for (; this.timeMap.length > 1 && this.timeMap[1].output <= r; )
              this.timeMap.shift(), (i = this.timeMap[0]);
            let o = i.active ? i.rate : 0,
              a = i.input + (r - i.output) * o;
            return (
              (this.timeIntervalCounter = this.timeIntervalSamples),
              this.port.postMessage(["time", a]),
              n
            );
          },
          dropBuffers: (t) => {
            if ("number" != typeof t) {
              let t = this.audioBuffers.flat(1).map((t) => t.buffer);
              return (
                (this.audioBuffers = []),
                (this.audioBuffersStart = this.audioBuffersEnd = 0),
                { value: { start: 0, end: 0 }, transfer: t }
              );
            }
            let e = [];
            for (; this.audioBuffers.length; ) {
              let r = this.audioBuffers[0][0].length;
              if ((this.audioBuffersStart + r) / sampleRate > t) break;
              this.audioBuffers.shift().forEach((t) => e.push(t.buffer)),
                (this.audioBuffersStart += r);
            }
            return {
              value: {
                start: this.audioBuffersStart / sampleRate,
                end: this.audioBuffersEnd / sampleRate,
              },
              transfer: e,
            };
          },
          addBuffers: (t) => {
            (t = [].concat(t)), this.audioBuffers.push(t);
            let e = t[0].length;
            return (
              (this.audioBuffersEnd += e), this.audioBuffersEnd / sampleRate
            );
          },
        },
        s = [];
      (this.port.onmessage = (t) => s.push(t)),
        t().then((t) => {
          (this.wasmModule = t),
            (this.wasmReady = !0),
            t._main(),
            (this.channels = e.numberOfOutputs ? e.outputChannelCount[0] : 2),
            this.configure(),
            (this.port.onmessage = (t) => {
              let e = t.data,
                s = e.shift(),
                n = e.shift(),
                i = r[n](...e);
              i?.transfer
                ? this.port.postMessage([s, i.value], i.transfer)
                : this.port.postMessage([s, i]);
            });
          let n = {};
          for (let t in r) n[t] = r[t].length;
          this.port.postMessage(["ready", n]),
            s.forEach(this.port.onmessage),
            (s = null);
        });
    }
    config = { preset: "default" };
    configure() {
      if (this.config.blockMs) {
        let t = Math.round((this.config.blockMs / 1e3) * sampleRate),
          e = Math.round(
            ((this.config.intervalMs || 0.25 * this.config.blockMs) / 1e3) *
              sampleRate
          ),
          r = this.config.splitComputation;
        this.wasmModule._configure(this.channels, t, e, r),
          this.wasmModule._reset();
      } else
        "cheaper" == this.config.preset
          ? this.wasmModule._presetCheaper(this.channels, sampleRate)
          : this.wasmModule._presetDefault(this.channels, sampleRate);
      this.updateBuffers(),
        (this.inputLatencySeconds =
          this.wasmModule._inputLatency() / sampleRate),
        (this.outputLatencySeconds =
          this.wasmModule._outputLatency() / sampleRate);
    }
    updateBuffers() {
      let t = this.wasmModule;
      this.bufferLength = t._inputLatency() + t._outputLatency();
      let e = 4 * this.bufferLength,
        r = t._setBuffers(this.channels, this.bufferLength);
      (this.buffersIn = []), (this.buffersOut = []);
      for (let t = 0; t < this.channels; ++t)
        this.buffersIn.push(r + e * t),
          this.buffersOut.push(r + e * (t + this.channels));
    }
    process(t, e, r) {
      if (!this.wasmReady)
        return (
          e.forEach((t) => {
            t.forEach((t) => {
              t.fill(0);
            });
          }),
          !0
        );
      if (!e[0]?.length) return !1;
      let s = currentTime + this.outputLatencySeconds;
      for (; this.timeMap.length > 1 && this.timeMap[1].output <= s; )
        this.timeMap.shift();
      let n = this.timeMap[0],
        i = this.wasmModule;
      i._setTransposeSemitones(n.semitones, n.tonalityHz / sampleRate),
        i._setFormantSemitones(n.formantSemitones, n.formantCompensation),
        i._setFormantBase(n.formantBaseHz / sampleRate),
        e[0].length != this.channels &&
          ((this.channels = e[0]?.length || 0), configure());
      let o = e[0][0].length,
        a = i.exports ? i.exports.memory.buffer : i.HEAP8.buffer,
        u = t[0];
      if (n.active)
        if (u?.length)
          e[0].forEach((t, e) => {
            let r = u[e % u.length],
              s = new Float32Array(a, this.buffersIn[e], o);
            r ? s.set(r) : s.fill(0);
          }),
            i._process(o, o);
        else {
          let t = n.input + (s - n.output) * n.rate,
            r = n.loopEnd - n.loopStart;
          r > 0 && t >= n.loopEnd && ((n.input -= r), (t -= r)),
            (t += this.inputLatencySeconds);
          let u = Math.round(t * sampleRate),
            f = e[0].map(
              (t, e) =>
                new Float32Array(a, this.buffersIn[e], this.bufferLength)
            ),
            l = 0,
            h = 0,
            p = this.audioBuffersStart,
            c = u - this.bufferLength;
          for (
            c < p && ((l = p - c), f.forEach((t) => t.fill(0, 0, l)), (c = p));
            h < this.audioBuffers.length && p < u;

          ) {
            let t = this.audioBuffers[h],
              e = c - p,
              r = (t[0].length, Math.min(t[0].length - e, u - c));
            r > 0
              ? (f.forEach((s, n) => {
                  let i = t[n % t.length];
                  s.subarray(l).set(i.subarray(e, e + r));
                }),
                (p += r),
                (l += r))
              : (p += t[0].length),
              ++h;
          }
          l < this.bufferLength && f.forEach((t) => t.subarray(l).fill(0)),
            i._seek(this.bufferLength, n.rate),
            i._process(0, o),
            (this.timeIntervalCounter -= o),
            this.timeIntervalCounter <= 0 &&
              ((this.timeIntervalCounter = this.timeIntervalSamples),
              this.port.postMessage(["time", t]));
        }
      else
        e[0].forEach((t, e) => {
          u[e % u.length];
          new Float32Array(a, this.buffersIn[e], o).fill(0);
        }),
          i._process(o, o);
      return (
        (a = i.exports ? i.exports.memory.buffer : i.HEAP8.buffer),
        e[0].forEach((t, e) => {
          let r = new Float32Array(a, this.buffersOut[e], o);
          t.set(r);
        }),
        !0
      );
    }
  }
  registerProcessor(e, r);
}
"object" == typeof exports && "object" == typeof module
  ? (module.exports = SignalsmithStretch)
  : "function" == typeof define &&
    define.amd &&
    define([], () => SignalsmithStretch),
  (SignalsmithStretch = ((t, e) => {
    if (
      "function" == typeof AudioWorkletProcessor &&
      "function" == typeof registerProcessor
    )
      return registerWorkletProcessor(t, e), {};
    let r = Symbol(),
      s = async function (n, i) {
        let o;
        i = i || {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        };
        try {
          o = new AudioWorkletNode(n, e, i);
        } catch (a) {
          if (!n[r]) {
            let i = s.moduleUrl;
            if (!i) {
              let r = `(${registerWorkletProcessor})((_scriptName=>${t})(),${JSON.stringify(
                e
              )})`;
              i = URL.createObjectURL(
                new Blob([r], { type: "text/javascript" })
              );
            }
            n[r] = n.audioWorklet.addModule(i);
          }
          await n[r], (o = new AudioWorkletNode(n, e, i));
        }
        let a = {},
          u = 0,
          f = null,
          l = (t, ...e) => {
            let r = u++;
            return new Promise((s) => {
              (a[r] = s), o.port.postMessage([r].concat(e), t);
            });
          };
        return (
          (o.inputTime = 0),
          (o.port.onmessage = (t) => {
            let e = t.data,
              r = e[0],
              s = e[1];
            "time" == r && ((o.inputTime = s), f && f(s)),
              r in a && (a[r](s), delete a[r]);
          }),
          new Promise((t) => {
            a.ready = (e) => {
              Object.keys(e).forEach((t) => {
                let r = e[t];
                o[t] = (...e) => {
                  let s = null;
                  return e.length > r && (s = e.pop()), l(s, t, ...e);
                };
              }),
                (o.setUpdateInterval = (t, e) => (
                  (f = e), l(null, "setUpdateInterval", t)
                )),
                t(o);
            };
          })
        );
      };
    return s;
  })(SignalsmithStretch, "signalsmith-stretch")),
  "object" == typeof exports && "object" == typeof module
    ? (module.exports = SignalsmithStretch)
    : "function" == typeof define &&
      define.amd &&
      define([], () => SignalsmithStretch);
let _export = SignalsmithStretch;
export default _export;
