const _0x22bffd = _0x2526;
(function (_0x594e32, _0x194ff6) {
  const _0x19547 = _0x2526,
    _0x243940 = _0x594e32();
  while (!![]) {
    try {
      const _0x38da38 =
        (-parseInt(_0x19547(0x1c8)) / 0x1) *
          (-parseInt(_0x19547(0x1cc)) / 0x2) +
        (-parseInt(_0x19547(0x90)) / 0x3) * (parseInt(_0x19547(0xec)) / 0x4) +
        (parseInt(_0x19547(0xdc)) / 0x5) * (-parseInt(_0x19547(0xc5)) / 0x6) +
        (-parseInt(_0x19547(0x129)) / 0x7) * (parseInt(_0x19547(0xa0)) / 0x8) +
        -parseInt(_0x19547(0x187)) / 0x9 +
        (-parseInt(_0x19547(0x223)) / 0xa) * (-parseInt(_0x19547(0x86)) / 0xb) +
        (parseInt(_0x19547(0x144)) / 0xc) * (-parseInt(_0x19547(0x151)) / 0xd);
      if (_0x38da38 === _0x194ff6) break;
      else _0x243940["push"](_0x243940["shift"]());
    } catch (_0x161e35) {
      _0x243940["push"](_0x243940["shift"]());
    }
  }
})(_0x2f1e, 0x34514);
import _0x371ebe from "../mjs/SignalsmithStretch.mjs";
(function () {
  const _0x50f84c = _0x2526,
    _0x5ce2ba = [_0x50f84c(0xa1), _0x50f84c(0x15d), "127.0.0.1"],
    _0x14b28c = window[_0x50f84c(0xab)]["hostname"];
  if (!_0x5ce2ba[_0x50f84c(0x23a)](_0x14b28c)) {
    document["body"][_0x50f84c(0x1c6)] = _0x50f84c(0x196);
    throw new Error(_0x50f84c(0x195));
  }
})(),
  (function () {
    const _0x3b55b4 = _0x2526,
      _0x467d06 = window["location"]["pathname"]["endsWith"]("app.html"),
      _0x21d81b = sessionStorage["getItem"]("access_allowed") === "true",
      _0x1027d9 = new URLSearchParams(
        window[_0x3b55b4(0xab)][_0x3b55b4(0x1b1)]
      ),
      _0x5b7386 =
        _0x467d06 &&
        _0x1027d9[_0x3b55b4(0x143)]("popup") === "1" &&
        window["opener"] &&
        !window[_0x3b55b4(0x13a)]["closed"];
    if ((_0x467d06 && !_0x5b7386) || !_0x21d81b) {
      window[_0x3b55b4(0xab)]["replace"](_0x3b55b4(0x1a9));
      throw new Error("Access\x20Denied");
    }
  })(),
  (function checkBrowserAndDisableExport() {
    const _0x3c0132 = _0x2526,
      _0x1c57c3 = /^((?!chrome|android).)*safari/i[_0x3c0132(0xa4)](
        navigator[_0x3c0132(0x1aa)]
      ),
      _0xe831e =
        /iPad|iPhone|iPod/[_0x3c0132(0xa4)](navigator["userAgent"]) ||
        (navigator[_0x3c0132(0x1a7)] === "MacIntel" &&
          navigator[_0x3c0132(0x70)] > 0x1);
    if (_0x1c57c3 || _0xe831e) {
      const _0x454e4e = document[_0x3c0132(0x1bd)](_0x3c0132(0x12e));
      _0x454e4e &&
        ((_0x454e4e[_0x3c0132(0x100)][_0x3c0132(0xd4)] = _0x3c0132(0x68)),
        console["log"](_0x3c0132(0x1c9)));
    }
  })(),
  document[_0x22bffd(0x1e4)](_0x22bffd(0x1ea), (_0x9ea086) =>
    _0x9ea086["preventDefault"]()
  );
const $ = (_0x26cc26) => document["querySelector"](_0x26cc26),
  $$ = (_0x58cdc1) => document[_0x22bffd(0x8b)](_0x58cdc1),
  STORAGE_KEY = _0x22bffd(0x244),
  savedSettingsRaw = localStorage[_0x22bffd(0x69)](STORAGE_KEY);
let savedSettings = savedSettingsRaw
  ? JSON[_0x22bffd(0x160)](savedSettingsRaw)
  : {};
const audioOptions = {};
savedSettings[_0x22bffd(0xa8)] &&
  savedSettings[_0x22bffd(0xa8)] !== _0x22bffd(0x1b3) &&
  (audioOptions[_0x22bffd(0x88)] = parseInt(savedSettings[_0x22bffd(0xa8)]));
savedSettings[_0x22bffd(0x150)] &&
  (audioOptions[_0x22bffd(0x235)] = savedSettings[_0x22bffd(0x150)]);
let audioContext;
try {
  audioContext = new AudioContext(audioOptions);
} catch (_0x191103) {
  console["warn"](_0x22bffd(0x237), _0x191103),
    (audioContext = new AudioContext());
}
const defaultTheme = {
  window: _0x22bffd(0x12f),
  text: _0x22bffd(0x147),
  textSec: _0x22bffd(0x185),
  highlight: _0x22bffd(0x12f),
  eq1: _0x22bffd(0x147),
  eq2: _0x22bffd(0x1e1),
  eq3: "#ff0000",
};
let currentTheme = { ...defaultTheme },
  reverbNode = audioContext["createConvolver"](),
  reverbGain = audioContext["createGain"]();
reverbGain[_0x22bffd(0x145)][_0x22bffd(0x1c3)] = 0x0;
let isReverbOn = ![];
function applyThemeToDOM(_0x5b34c9) {
  const _0x5681f8 = _0x22bffd,
    _0x213c48 = document[_0x5681f8(0xda)];
  _0x213c48[_0x5681f8(0x100)][_0x5681f8(0x122)](
    "--theme-window",
    _0x5b34c9[_0x5681f8(0xcd)]
  ),
    _0x213c48["style"][_0x5681f8(0x122)](
      "--theme-text",
      _0x5b34c9[_0x5681f8(0x164)]
    ),
    _0x213c48[_0x5681f8(0x100)]["setProperty"](
      "--theme-text-sec",
      _0x5b34c9[_0x5681f8(0x1c2)]
    ),
    _0x213c48[_0x5681f8(0x100)][_0x5681f8(0x122)](
      _0x5681f8(0x78),
      _0x5b34c9[_0x5681f8(0xac)]
    ),
    _0x213c48[_0x5681f8(0x100)][_0x5681f8(0x122)](
      _0x5681f8(0x172),
      _0x5b34c9["eq1"]
    ),
    _0x213c48[_0x5681f8(0x100)]["setProperty"]("--eq-col-2", _0x5b34c9["eq2"]),
    _0x213c48[_0x5681f8(0x100)][_0x5681f8(0x122)](
      _0x5681f8(0x1ec),
      _0x5b34c9[_0x5681f8(0x8a)]
    );
}
(window[_0x22bffd(0xe5)] = (_0x1aa313) => {
  const _0x12da1f = _0x22bffd;
  $(_0x12da1f(0x207))[_0x12da1f(0x179)] = _0x1aa313;
  const _0x365ab8 = $(_0x12da1f(0x112));
  _0x365ab8[_0x12da1f(0x1c6)] = "";
  const _0x3a72f1 = document[_0x12da1f(0x202)]("button");
  (_0x3a72f1[_0x12da1f(0x1fe)] = _0x12da1f(0x114)),
    (_0x3a72f1["textContent"] = "OK"),
    (_0x3a72f1["onclick"] = () =>
      $("#modal-generic")[_0x12da1f(0x227)][_0x12da1f(0xf5)](_0x12da1f(0x213))),
    _0x365ab8[_0x12da1f(0x163)](_0x3a72f1),
    $(_0x12da1f(0xde))["classList"][_0x12da1f(0x130)]("hidden");
}),
  (window[_0x22bffd(0x11d)] = (_0x3314db, _0x3051f0) => {
    const _0x281c9c = _0x22bffd;
    $(_0x281c9c(0x207))[_0x281c9c(0x179)] = _0x3314db;
    const _0x4e2294 = $(_0x281c9c(0x112));
    _0x4e2294[_0x281c9c(0x1c6)] = "";
    const _0x41241b = document[_0x281c9c(0x202)](_0x281c9c(0x1bc));
    (_0x41241b[_0x281c9c(0x1fe)] = "win-btn\x20w-20\x20h-6\x20text-[10px]"),
      (_0x41241b[_0x281c9c(0x179)] = "NO"),
      (_0x41241b[_0x281c9c(0x226)] = () => {
        const _0x270fab = _0x281c9c;
        $("#modal-generic")[_0x270fab(0x227)][_0x270fab(0xf5)](
          _0x270fab(0x213)
        );
      });
    const _0x4e2cb3 = document[_0x281c9c(0x202)](_0x281c9c(0x1bc));
    (_0x4e2cb3["className"] = _0x281c9c(0x114)),
      (_0x4e2cb3[_0x281c9c(0x179)] = _0x281c9c(0x1f9)),
      (_0x4e2cb3[_0x281c9c(0x226)] = () => {
        const _0x29836f = _0x281c9c;
        $(_0x29836f(0xde))[_0x29836f(0x227)][_0x29836f(0xf5)](_0x29836f(0x213)),
          _0x3051f0();
      }),
      _0x4e2294[_0x281c9c(0x163)](_0x41241b),
      _0x4e2294[_0x281c9c(0x163)](_0x4e2cb3),
      $(_0x281c9c(0xde))[_0x281c9c(0x227)]["remove"](_0x281c9c(0x213));
  }),
  (window[_0x22bffd(0x1c7)] = (_0x4519eb) => {
    const _0xcc7ee0 = _0x22bffd;
    [_0xcc7ee0(0x8d), _0xcc7ee0(0x128)]["forEach"]((_0x2644e1) => {
      const _0x4255c5 = _0xcc7ee0;
      _0x2644e1 === _0x4519eb
        ? ($(_0x4255c5(0x1f0) + _0x2644e1)[_0x4255c5(0x227)]["remove"](
            _0x4255c5(0x213)
          ),
          $(_0x4255c5(0xbe) + _0x2644e1)[_0x4255c5(0x227)][_0x4255c5(0xf5)](
            "active"
          ))
        : ($(_0x4255c5(0x1f0) + _0x2644e1)["classList"][_0x4255c5(0xf5)](
            _0x4255c5(0x213)
          ),
          $("#tab-btn-" + _0x2644e1)[_0x4255c5(0x227)]["remove"](
            _0x4255c5(0x158)
          ));
    });
  }),
  (window[_0x22bffd(0xd8)] = () => {
    const _0xe663dc = _0x22bffd;
    $(_0xe663dc(0x170))["classList"][_0xe663dc(0x130)]("hidden"),
      ($(_0xe663dc(0xbc))["value"] = currentTheme[_0xe663dc(0xcd)]),
      ($(_0xe663dc(0x149))[_0xe663dc(0x1c3)] = currentTheme[_0xe663dc(0x164)]),
      ($(_0xe663dc(0x1cf))[_0xe663dc(0x1c3)] = currentTheme[_0xe663dc(0xac)]),
      ($(_0xe663dc(0x1e5))[_0xe663dc(0x1c3)] = currentTheme[_0xe663dc(0xd0)]),
      ($(_0xe663dc(0x103))[_0xe663dc(0x1c3)] = currentTheme[_0xe663dc(0x81)]),
      ($(_0xe663dc(0x1dc))["value"] = currentTheme[_0xe663dc(0x8a)]),
      ($("#set-audio-sr")["value"] =
        savedSettings[_0xe663dc(0xa8)] || _0xe663dc(0x1b3)),
      ($(_0xe663dc(0x66))[_0xe663dc(0x1c3)] =
        savedSettings[_0xe663dc(0x150)] || _0xe663dc(0x1a5)),
      ($(_0xe663dc(0x13d))[_0xe663dc(0x179)] =
        savedSettings["reverbGain"] || _0xe663dc(0xc6)),
      previewTheme();
  }),
  (window[_0x22bffd(0x23e)] = () => {
    const _0x4c137a = _0x22bffd;
    $(_0x4c137a(0x170))[_0x4c137a(0x227)][_0x4c137a(0xf5)](_0x4c137a(0x213)),
      applyThemeToDOM(currentTheme);
  }),
  (window["previewTheme"] = () => {
    const _0x275cbf = _0x22bffd,
      _0x21d748 = $("#set-theme-window")[_0x275cbf(0x1c3)],
      _0x414dd2 = $(_0x275cbf(0x149))[_0x275cbf(0x1c3)],
      _0x237773 = $(_0x275cbf(0x23b)),
      _0x2e2a4b = $(_0x275cbf(0xc1));
    (_0x237773["style"][_0x275cbf(0x1b6)] = _0x21d748),
      (_0x2e2a4b[_0x275cbf(0x100)]["color"] = _0x414dd2),
      document[_0x275cbf(0xda)][_0x275cbf(0x100)][_0x275cbf(0x122)](
        _0x275cbf(0x131),
        _0x21d748
      ),
      document[_0x275cbf(0xda)][_0x275cbf(0x100)]["setProperty"](
        _0x275cbf(0x222),
        _0x414dd2
      ),
      document[_0x275cbf(0xda)][_0x275cbf(0x100)][_0x275cbf(0x122)](
        _0x275cbf(0x78),
        $(_0x275cbf(0x1cf))["value"]
      ),
      document[_0x275cbf(0xda)]["style"][_0x275cbf(0x122)](
        _0x275cbf(0x172),
        $("#set-eq-1")[_0x275cbf(0x1c3)]
      ),
      document["documentElement"]["style"][_0x275cbf(0x122)](
        _0x275cbf(0x99),
        $(_0x275cbf(0x103))[_0x275cbf(0x1c3)]
      ),
      document[_0x275cbf(0xda)][_0x275cbf(0x100)][_0x275cbf(0x122)](
        _0x275cbf(0x1ec),
        $(_0x275cbf(0x1dc))[_0x275cbf(0x1c3)]
      );
  }),
  (window["applyThemeSettings"] = () => {
    const _0x1ec5b5 = _0x22bffd;
    (currentTheme[_0x1ec5b5(0xcd)] = $(_0x1ec5b5(0xbc))[_0x1ec5b5(0x1c3)]),
      (currentTheme[_0x1ec5b5(0x164)] = $("#set-theme-text")[_0x1ec5b5(0x1c3)]),
      (currentTheme[_0x1ec5b5(0xac)] = $("#set-theme-high")[_0x1ec5b5(0x1c3)]),
      (currentTheme[_0x1ec5b5(0xd0)] = $(_0x1ec5b5(0x1e5))["value"]),
      (currentTheme["eq2"] = $(_0x1ec5b5(0x103))[_0x1ec5b5(0x1c3)]),
      (currentTheme["eq3"] = $(_0x1ec5b5(0x1dc))["value"]),
      applyThemeToDOM(currentTheme),
      saveSettings(),
      $(_0x1ec5b5(0x170))["classList"][_0x1ec5b5(0xf5)](_0x1ec5b5(0x213));
  }),
  (window[_0x22bffd(0x16a)] = () => {
    const _0x4d5721 = _0x22bffd;
    (savedSettings[_0x4d5721(0xa8)] = $(_0x4d5721(0x1f7))["value"]),
      (savedSettings[_0x4d5721(0x150)] = $(_0x4d5721(0x66))[_0x4d5721(0x1c3)]),
      localStorage[_0x4d5721(0x10e)](
        STORAGE_KEY,
        JSON[_0x4d5721(0xdf)](savedSettings)
      ),
      customConfirm(_0x4d5721(0xfe), () => {
        location["reload"]();
      });
  }),
  (window[_0x22bffd(0x18f)] = () => {
    const _0x389b63 = _0x22bffd;
    (currentTheme = { ...defaultTheme }),
      applyThemeToDOM(currentTheme),
      saveSettings(),
      $(_0x389b63(0x170))[_0x389b63(0x227)][_0x389b63(0xf5)](_0x389b63(0x213));
  });
const tooltip = $(_0x22bffd(0xb3)),
  hideTooltip = () => {
    const _0x32c539 = _0x22bffd;
    tooltip["style"][_0x32c539(0xd4)] = _0x32c539(0x68);
  };
function attachTooltips() {
  const _0x11a3b0 = _0x22bffd;
  $$("input[type=\x22range\x22]")[_0x11a3b0(0xfd)]((_0x275297) => {
    const _0x3598b2 = _0x11a3b0;
    _0x275297[_0x3598b2(0xe0)] = (_0x34ee0d) => {
      const _0x185345 = _0x3598b2,
        _0x14b3a5 = parseFloat(_0x34ee0d[_0x185345(0x221)][_0x185345(0x1c3)]);
      let _0x5be90b = _0x14b3a5;
      const _0x59825f =
        _0x275297[_0x185345(0x13b)][_0x185345(0x1f5)] || _0x185345(0x1d4);
      if (_0x59825f === _0x185345(0x10f)) _0x5be90b = formatTime(_0x14b3a5);
      else {
        if (_0x59825f === "percent")
          _0x5be90b = Math[_0x185345(0x16f)](_0x14b3a5 * 0x64) + "%";
        else {
          if (_0x59825f === "balance")
            _0x5be90b =
              _0x14b3a5 === 0x0
                ? _0x185345(0xa9)
                : _0x14b3a5 < 0x0
                ? "L\x20" + Math["abs"](_0x14b3a5)
                : "R\x20" + _0x14b3a5;
          else {
            if (_0x59825f === "x") _0x5be90b = _0x14b3a5 + "x";
            else {
              if (_0x59825f === "val") _0x5be90b = _0x14b3a5;
              else {
                if (_0x59825f === "db")
                  _0x5be90b = _0x14b3a5 + _0x185345(0x23c);
              }
            }
          }
        }
      }
      if (_0x275297[_0x185345(0x13b)]["idx"])
        handleEqInput(_0x275297[_0x185345(0x13b)]["idx"], _0x14b3a5, _0x275297),
          (_0x5be90b = _0x14b3a5 + _0x185345(0x23c));
      else {
        if (_0x275297["id"] === _0x185345(0x7d))
          (masterGainNode["gain"][_0x185345(0x1c3)] = _0x14b3a5),
            ($("#txt-vol")[_0x185345(0x179)] =
              Math[_0x185345(0x16f)](_0x14b3a5 * 0x64) + "%"),
            saveSettings();
        else {
          if (_0x275297["id"] === _0x185345(0xb7))
            (pannerNode[_0x185345(0x1e3)]["value"] = _0x14b3a5), saveSettings();
          else {
            if (
              _0x275297[_0x185345(0x13b)][_0x185345(0x17c)] === _0x185345(0x1f3)
            )
              (controlValues[_0x185345(0x1f3)] = _0x14b3a5),
                ($(_0x185345(0xad))[_0x185345(0x179)] =
                  _0x14b3a5[_0x185345(0x1bf)](0x2)),
                controlsChanged(),
                saveSettings();
            else {
              if (
                _0x275297[_0x185345(0x13b)][_0x185345(0x17c)] ===
                _0x185345(0x1f8)
              )
                (controlValues[_0x185345(0x1f8)] = _0x14b3a5),
                  ($(_0x185345(0xd1))["textContent"] = _0x14b3a5),
                  controlsChanged(),
                  saveSettings();
              else {
                if (_0x275297["id"] === "main-reverb")
                  (reverbGain[_0x185345(0x145)][_0x185345(0x1c3)] = _0x14b3a5),
                    ($(_0x185345(0x23f))[_0x185345(0x179)] =
                      _0x14b3a5["toFixed"](0x2)),
                    saveSettings();
                else
                  _0x275297["id"] === _0x185345(0x126) &&
                    stretch &&
                    stretch[_0x185345(0x10d)]({ input: _0x14b3a5, rate: 0x0 });
              }
            }
          }
        }
      }
      const _0x5248c3 = _0x275297[_0x185345(0x1d6)]();
      (tooltip[_0x185345(0x179)] = _0x5be90b),
        (tooltip[_0x185345(0x100)]["display"] = _0x185345(0x1a3));
      if (_0x275297[_0x185345(0x227)]["contains"](_0x185345(0x240))) {
        tooltip[_0x185345(0x100)][_0x185345(0x1fc)] =
          _0x5248c3[_0x185345(0x238)] + 0x5 + "px";
        const _0x33d7c5 = parseFloat(_0x275297[_0x185345(0x19e)]),
          _0x42d5f5 = parseFloat(_0x275297["max"]),
          _0x35c1af = (_0x14b3a5 - _0x33d7c5) / (_0x42d5f5 - _0x33d7c5),
          _0x4bf9bd =
            _0x5248c3["bottom"] - _0x5248c3[_0x185345(0xe4)] * _0x35c1af;
        tooltip[_0x185345(0x100)][_0x185345(0x184)] = _0x4bf9bd - 0xa + "px";
      } else {
        tooltip[_0x185345(0x100)][_0x185345(0x184)] =
          _0x5248c3[_0x185345(0x184)] - 0x19 + "px";
        const _0xf0d8ba = parseFloat(_0x275297[_0x185345(0x19e)]),
          _0x333c9d = parseFloat(_0x275297[_0x185345(0x1b2)]),
          _0x1de177 = (_0x14b3a5 - _0xf0d8ba) / (_0x333c9d - _0xf0d8ba),
          _0x3ab313 =
            _0x5248c3[_0x185345(0x1fc)] +
            _0x5248c3[_0x185345(0x1a1)] * _0x1de177;
        tooltip[_0x185345(0x100)][_0x185345(0x1fc)] =
          _0x3ab313 - tooltip[_0x185345(0x76)] / 0x2 + "px";
      }
    };
  });
}
window[_0x22bffd(0x1e4)](_0x22bffd(0x236), hideTooltip),
  window[_0x22bffd(0x1e4)]("touchend", hideTooltip),
  (window["formatTime"] = (_0x20cfbe) => {
    const _0x386341 = _0x22bffd;
    _0x20cfbe = parseFloat(_0x20cfbe);
    if (isNaN(_0x20cfbe)) return _0x386341(0x233);
    return (
      Math["floor"](_0x20cfbe / 0x3c) +
      ":" +
      Math[_0x386341(0x1cb)](_0x20cfbe % 0x3c)
        [_0x386341(0x16b)]()
        [_0x386341(0x124)](0x2, "0")
    );
  });
function createImpulseResponse(
  _0x1cd1da = 0x3,
  _0x128f19 = 0x2,
  _0x3bc5fb = 0.02
) {
  const _0x49d6ec = _0x22bffd,
    _0x2da270 = audioContext[_0x49d6ec(0x88)],
    _0xf36bb6 = _0x2da270 * _0x1cd1da,
    _0x3e65b7 = audioContext[_0x49d6ec(0x20e)](0x2, _0xf36bb6, _0x2da270),
    _0x2d3236 = Math[_0x49d6ec(0x1cb)](_0x3bc5fb * _0x2da270);
  for (let _0x3e7340 = 0x0; _0x3e7340 < 0x2; _0x3e7340++) {
    const _0x2b4a23 = _0x3e65b7[_0x49d6ec(0x104)](_0x3e7340);
    let _0x212e6c = 0x0;
    const _0x25419d = 0.12;
    for (let _0x1cbb74 = 0x0; _0x1cbb74 < _0xf36bb6; _0x1cbb74++) {
      const _0x279807 = Math[_0x49d6ec(0x115)]() * 0x2 - 0x1;
      _0x212e6c = _0x212e6c + _0x25419d * (_0x279807 - _0x212e6c);
      const _0x45fed9 = _0x212e6c;
      if (_0x1cbb74 < _0x2d3236) _0x2b4a23[_0x1cbb74] = 0x0;
      else {
        const _0x3e6d80 = (_0x1cbb74 - _0x2d3236) / (_0xf36bb6 - _0x2d3236),
          _0x582af8 = Math[_0x49d6ec(0xae)](-_0x128f19 * _0x3e6d80),
          _0x2d8f87 = 0x1 + 0.1 * Math[_0x49d6ec(0x9b)](_0x3e6d80 * 0x14);
        _0x2b4a23[_0x1cbb74] = _0x45fed9 * _0x582af8 * _0x2d8f87;
      }
    }
    const _0x21607b = [
      { delay: 0.01, gain: 0.6 },
      { delay: 0.03, gain: 0.4 },
      { delay: 0.07, gain: 0.2 },
      { delay: 0.12, gain: 0.1 },
    ];
    for (const _0x7dc295 of _0x21607b) {
      const _0x26df0c = Math[_0x49d6ec(0x1cb)](_0x7dc295["delay"] * _0x2da270),
        _0x1eb6b3 = 0x28;
      if (_0x26df0c < _0xf36bb6)
        for (let _0x135384 = 0x0; _0x135384 < _0x1eb6b3; _0x135384++) {
          _0x26df0c + _0x135384 < _0xf36bb6 &&
            (_0x2b4a23[_0x26df0c + _0x135384] +=
              (Math[_0x49d6ec(0x115)]() * 0x2 - 0x1) *
              _0x7dc295[_0x49d6ec(0x145)] *
              0.1 *
              (0x1 - _0x135384 / _0x1eb6b3));
        }
    }
  }
  for (let _0x404306 = 0x0; _0x404306 < 0x2; _0x404306++) {
    const _0x30f59a = _0x3e65b7[_0x49d6ec(0x104)](_0x404306);
    let _0x29cea0 = 0x0;
    for (let _0x123b77 = 0x0; _0x123b77 < _0xf36bb6; _0x123b77++)
      _0x29cea0 = Math[_0x49d6ec(0x1b2)](
        _0x29cea0,
        Math[_0x49d6ec(0x7a)](_0x30f59a[_0x123b77])
      );
    if (_0x29cea0 > 0x0) {
      for (let _0x4b5c57 = 0x0; _0x4b5c57 < _0xf36bb6; _0x4b5c57++)
        _0x30f59a[_0x4b5c57] /= _0x29cea0;
      for (let _0x4013b9 = 0x0; _0x4013b9 < _0xf36bb6; _0x4013b9++)
        _0x30f59a[_0x4013b9] *= 0.8;
    }
  }
  return _0x3e65b7;
}
reverbNode[_0x22bffd(0x138)] = createImpulseResponse();
function updateReverbConnection() {
  const _0x502429 = _0x22bffd,
    _0x1b0d9a = $(_0x502429(0x14f));
  try {
    reverbNode["disconnect"]();
  } catch (_0x164239) {}
  try {
    reverbGain["disconnect"]();
  } catch (_0xa0e5d4) {}
  if (isReverbOn && eqNodes[_0x502429(0x13c)] > 0x0) {
    const _0x2ce8c3 = eqNodes[eqNodes[_0x502429(0x13c)] - 0x1];
    _0x2ce8c3[_0x502429(0xd3)](reverbNode),
      reverbNode[_0x502429(0xd3)](reverbGain),
      reverbGain[_0x502429(0xd3)](analyser),
      (_0x1b0d9a[_0x502429(0x179)] = "ON"),
      _0x1b0d9a[_0x502429(0x227)][_0x502429(0xf5)](_0x502429(0x154)),
      _0x1b0d9a[_0x502429(0x227)][_0x502429(0x130)](_0x502429(0xbb));
  } else
    (_0x1b0d9a[_0x502429(0x179)] = _0x502429(0x98)),
      _0x1b0d9a["classList"][_0x502429(0x130)](_0x502429(0x154)),
      _0x1b0d9a[_0x502429(0x227)][_0x502429(0xf5)](_0x502429(0xbb));
}
function saveSettings() {
  const _0x9fdf5b = _0x22bffd,
    _0x332f40 = Array[_0x9fdf5b(0x94)](
      document[_0x9fdf5b(0x8b)](_0x9fdf5b(0x245))
    )[_0x9fdf5b(0x171)]((_0x592e3e) => parseFloat(_0x592e3e[_0x9fdf5b(0x1c3)]));
  window[_0x9fdf5b(0x95)] = _0x332f40;
  const _0x5892fd = {
    ...savedSettings,
    vol: $(_0x9fdf5b(0x197))[_0x9fdf5b(0x1c3)],
    bal: $(_0x9fdf5b(0x9c))["value"],
    rate: controlValues[_0x9fdf5b(0x1f3)],
    pitch: controlValues[_0x9fdf5b(0x1f8)],
    isShuffle: isShuffle,
    repeatMode: repeatMode,
    isEqOn: isEqOn,
    playlistId: currentPlaylistId,
    eqGains: _0x332f40,
    eqPreset: $(_0x9fdf5b(0xee))["value"],
    isMono: isMono,
    theme: currentTheme,
    reverbGain: $(_0x9fdf5b(0x77))[_0x9fdf5b(0x1c3)],
  };
  (savedSettings = _0x5892fd),
    localStorage[_0x9fdf5b(0x10e)](STORAGE_KEY, JSON["stringify"](_0x5892fd));
}
function loadSettings() {
  const _0x1750dd = _0x22bffd,
    _0x52acee = savedSettings;
  if (!_0x52acee) {
    applyThemeToDOM(defaultTheme), updateReverbConnection();
    return;
  }
  _0x52acee[_0x1750dd(0x19b)] &&
    (($(_0x1750dd(0x197))[_0x1750dd(0x1c3)] = _0x52acee[_0x1750dd(0x19b)]),
    (masterGainNode[_0x1750dd(0x145)]["value"] = parseFloat(_0x52acee["vol"])),
    ($(_0x1750dd(0x156))["textContent"] =
      Math[_0x1750dd(0x16f)](_0x52acee[_0x1750dd(0x19b)] * 0x64) + "%"));
  _0x52acee[_0x1750dd(0x183)] &&
    (($("#main-bal")[_0x1750dd(0x1c3)] = _0x52acee[_0x1750dd(0x183)]),
    (pannerNode[_0x1750dd(0x1e3)]["value"] = parseFloat(
      _0x52acee[_0x1750dd(0x183)]
    )));
  _0x52acee["rate"] &&
    ((controlValues[_0x1750dd(0x1f3)] = parseFloat(
      _0x52acee[_0x1750dd(0x1f3)]
    )),
    ($(_0x1750dd(0x1e0))[_0x1750dd(0x1c3)] = _0x52acee[_0x1750dd(0x1f3)]),
    ($(_0x1750dd(0xad))["textContent"] =
      _0x52acee[_0x1750dd(0x1f3)][_0x1750dd(0x1bf)](0x2)));
  _0x52acee["pitch"] &&
    ((controlValues[_0x1750dd(0x1f8)] = parseFloat(
      _0x52acee[_0x1750dd(0x15b)]
    )),
    ($("input[data-key=\x22semitones\x22]")[_0x1750dd(0x1c3)] =
      _0x52acee[_0x1750dd(0x15b)]),
    ($(_0x1750dd(0xd1))["textContent"] = _0x52acee[_0x1750dd(0x15b)]));
  _0x52acee[_0x1750dd(0x1af)] &&
    ((isShuffle = !![]), $(_0x1750dd(0xe9))[_0x1750dd(0x227)]["add"]("active"));
  if (_0x52acee[_0x1750dd(0x219)] !== undefined)
    repeatMode = _0x52acee["repeatMode"];
  updateRepeatBtn();
  if (_0x52acee[_0x1750dd(0x136)] !== undefined)
    isMono = _0x52acee[_0x1750dd(0x136)];
  updateMonoStereoState(),
    (isEqOn =
      _0x52acee["isEqOn"] !== undefined ? _0x52acee[_0x1750dd(0x1ce)] : !![]),
    ($(_0x1750dd(0x117))[_0x1750dd(0x179)] = isEqOn ? "ON" : _0x1750dd(0x98)),
    $("#btn-eq-toggle")[_0x1750dd(0x227)]["toggle"](_0x1750dd(0xa3), isEqOn);
  if (_0x52acee["playlistId"]) currentPlaylistId = _0x52acee["playlistId"];
  _0x52acee[_0x1750dd(0x1c4)]
    ? ((currentTheme = _0x52acee[_0x1750dd(0x1c4)]),
      applyThemeToDOM(currentTheme))
    : applyThemeToDOM(defaultTheme),
    _0x52acee[_0x1750dd(0x212)] !== undefined &&
      (($(_0x1750dd(0x77))[_0x1750dd(0x1c3)] = _0x52acee["reverbGain"]),
      (reverbGain[_0x1750dd(0x145)][_0x1750dd(0x1c3)] = parseFloat(
        _0x52acee[_0x1750dd(0x212)]
      )),
      ($(_0x1750dd(0x23f))[_0x1750dd(0x179)] = parseFloat(
        _0x52acee[_0x1750dd(0x212)]
      )[_0x1750dd(0x1bf)](0x2))),
    (window[_0x1750dd(0x95)] = _0x52acee[_0x1750dd(0xcb)] || [
      0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
    ]),
    _0x52acee[_0x1750dd(0x71)] &&
      ($(_0x1750dd(0xee))[_0x1750dd(0x1c3)] = _0x52acee[_0x1750dd(0x71)]),
    FREQUENCIES[_0x1750dd(0xfd)]((_0x332467, _0x4bae1b) => {
      const _0x13a72d = _0x1750dd,
        _0x27cb94 = $(_0x13a72d(0x1d8) + _0x4bae1b);
      if (_0x27cb94) {
        if (isEqOn)
          _0x27cb94[_0x13a72d(0x227)][_0x13a72d(0xf5)]("eq-bar-active");
        else _0x27cb94[_0x13a72d(0x227)][_0x13a72d(0x130)]("eq-bar-active");
      }
    }),
    updateReverbConnection();
}
let isEngineHot = ![];
const audioStartup = $("#audio-startup"),
  audioLoop = $("#audio-loop"),
  loopSource = audioContext[_0x22bffd(0xd6)](audioLoop);
loopSource[_0x22bffd(0xd3)](audioContext["destination"]);
const initAudioEngine = async () => {
  const _0x2badc6 = _0x22bffd;
  if (isEngineHot) return;
  try {
    if (audioContext[_0x2badc6(0x21c)] === "suspended")
      await audioContext[_0x2badc6(0xb5)]();
    (isEngineHot = !![]),
      (audioStartup[_0x2badc6(0x21b)] = 0.5),
      (audioLoop[_0x2badc6(0x21b)] = 0.05),
      await audioStartup[_0x2badc6(0x1ab)](),
      audioLoop[_0x2badc6(0x1ab)]()[_0x2badc6(0x169)]((_0x4e842b) => {}),
      ($("#engine-status")[_0x2badc6(0x100)]["backgroundColor"] = "#00ff00"),
      ($(_0x2badc6(0xb6))[_0x2badc6(0x100)][_0x2badc6(0x109)] =
        _0x2badc6(0x18b)),
      ($(_0x2badc6(0x9e))["textContent"] = "Ready.");
  } catch (_0x24f47e) {
    console[_0x2badc6(0x225)](_0x2badc6(0x135), _0x24f47e);
  }
};
document["addEventListener"]("click", initAudioEngine, { once: !![] }),
  document[_0x22bffd(0x1e4)](_0x22bffd(0x153), initAudioEngine, { once: !![] });
const checkAndResumeAudioContext = () => {
  const _0x36b8dd = _0x22bffd;
  if (
    isEngineHot &&
    (audioContext["state"] === "suspended" ||
      audioContext[_0x36b8dd(0x21c)] === _0x36b8dd(0x18c))
  )
    audioContext[_0x36b8dd(0xb5)]();
  if (isEngineHot && audioLoop["paused"])
    audioLoop[_0x36b8dd(0x1ab)]()[_0x36b8dd(0x169)]((_0x2eecef) => {});
  if (stretch && controlValues[_0x36b8dd(0x158)] && !isChangingTrack) {
    const _0x2055e2 = stretch[_0x36b8dd(0x1a4)] || 0x0;
    _0x2055e2 >= audioDuration - 0.5 &&
      (console[_0x36b8dd(0x1dd)](_0x36b8dd(0x1a8)), handleNextTrack(!![]));
  }
};
setInterval(checkAndResumeAudioContext, 0x3e8),
  [_0x22bffd(0x7e), _0x22bffd(0x153), _0x22bffd(0xca)][_0x22bffd(0xfd)](
    (_0x266a66) =>
      document[_0x22bffd(0x1e4)](_0x266a66, checkAndResumeAudioContext)
  );
let stretch = null,
  eqNodes = [],
  analyser = audioContext[_0x22bffd(0x193)](),
  masterGainNode = audioContext["createGain"](),
  pannerNode = audioContext["createStereoPanner"](),
  stereoPath = audioContext["createGain"](),
  monoPath = audioContext[_0x22bffd(0x11a)]();
(monoPath["channelCount"] = 0x1),
  (monoPath["channelCountMode"] = _0x22bffd(0x14b)),
  (monoPath[_0x22bffd(0x1be)] = _0x22bffd(0x239));
let isMono = ![],
  audioDuration = 0x1,
  isChangingTrack = ![],
  playDebounceTimer = null;
analyser["connect"](stereoPath),
  analyser[_0x22bffd(0xd3)](monoPath),
  stereoPath[_0x22bffd(0xd3)](pannerNode),
  monoPath[_0x22bffd(0xd3)](pannerNode),
  pannerNode["connect"](masterGainNode),
  masterGainNode[_0x22bffd(0xd3)](audioContext[_0x22bffd(0x215)]),
  (masterGainNode[_0x22bffd(0x145)][_0x22bffd(0x1c3)] = 0.8),
  (analyser[_0x22bffd(0xe6)] = 0x40);
const FREQUENCIES = [
    0x3c, 0xaa, 0x136, 0x258, 0x3e8, 0xbb8, 0x1770, 0x2ee0, 0x36b0, 0x3e80,
  ],
  PRESETS = {
    flat: [0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0],
    rock: [0x4, 0x3, 0x2, 0x0, -0x1, -0x1, 0x0, 0x2, 0x3, 0x4],
    pop: [-0x1, 0x1, 0x3, 0x3, 0x1, -0x1, -0x2, -0x2, -0x1, -0x1],
    jazz: [0x3, 0x2, 0x0, -0x2, -0x2, 0x0, 0x2, 0x3, 0x4, 0x4],
    fullbass: [0x6, 0x6, 0x5, 0x2, 0x0, -0x2, -0x4, -0x5, -0x6, -0x6],
  };
let controlValues = { active: ![], rate: 0x1, semitones: 0x0 },
  isEqOn = !![];
function initEQ() {
  const _0x27f61c = _0x22bffd;
  eqNodes["forEach"]((_0x52a6ec) => {
    const _0x49bd1f = _0x2526;
    try {
      _0x52a6ec[_0x49bd1f(0x1a2)]();
    } catch (_0x5a57d8) {}
  }),
    (eqNodes = []);
  let _0x76216d = null,
    _0x5f5150 = null;
  return (
    FREQUENCIES[_0x27f61c(0xfd)]((_0x4c7a0c, _0x4669a7) => {
      const _0x14510d = _0x27f61c,
        _0x4c33c6 = audioContext[_0x14510d(0x17e)]();
      (_0x4c33c6[_0x14510d(0x22e)] = _0x14510d(0xaa)),
        (_0x4c33c6[_0x14510d(0x67)][_0x14510d(0x1c3)] = _0x4c7a0c),
        (_0x4c33c6["Q"][_0x14510d(0x1c3)] = 1.4);
      let _0x57a96e =
        window["savedEqGains"] &&
        window[_0x14510d(0x95)][_0x4669a7] !== undefined
          ? window[_0x14510d(0x95)][_0x4669a7]
          : 0x0;
      const _0x112487 = document[_0x14510d(0x1bd)](
        "input[data-idx=\x22" + _0x4669a7 + "\x22]"
      );
      _0x112487 &&
        ((_0x112487[_0x14510d(0x1c3)] = _0x57a96e),
        updateThumb(_0x112487, _0x14510d(0x9a) + _0x4669a7));
      (_0x4c33c6[_0x14510d(0x145)][_0x14510d(0x1c3)] = isEqOn
        ? _0x57a96e
        : 0x0),
        eqNodes[_0x14510d(0x1bb)](_0x4c33c6);
      if (_0x76216d) _0x76216d["connect"](_0x4c33c6);
      else _0x5f5150 = _0x4c33c6;
      _0x76216d = _0x4c33c6;
    }),
    { input: _0x5f5150, output: _0x76216d }
  );
}
async function loadAudioEngine(_0xd6e409, _0x3e17c2) {
  const _0x13fbc9 = _0x22bffd;
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  const _0x149f23 = await audioContext["decodeAudioData"](_0xd6e409);
  audioDuration = _0x149f23[_0x13fbc9(0xa7)];
  const _0x4d44e4 = [];
  for (let _0x46a8e = 0x0; _0x46a8e < _0x149f23[_0x13fbc9(0x19c)]; ++_0x46a8e)
    _0x4d44e4[_0x13fbc9(0x1bb)](_0x149f23["getChannelData"](_0x46a8e));
  stretch && (stretch[_0x13fbc9(0x21a)](), stretch["disconnect"]());
  stretch = await _0x371ebe(audioContext);
  const _0x1db4d4 = initEQ();
  stretch[_0x13fbc9(0xd3)](_0x1db4d4[_0x13fbc9(0xeb)]),
    _0x1db4d4["output"]["connect"](analyser),
    updateReverbConnection(),
    await stretch[_0x13fbc9(0x18a)](_0x4d44e4),
    (controlValues[_0x13fbc9(0x158)] = !![]),
    controlsChanged(),
    (isChangingTrack = ![]),
    updateMediaSession(_0x3e17c2[_0x13fbc9(0x224)]),
    ($("#info-samplerate")["textContent"] =
      _0x149f23[_0x13fbc9(0x88)] / 0x3e8 + _0x13fbc9(0x6c));
  if (_0x3e17c2[_0x13fbc9(0xb4)] && _0x3e17c2[_0x13fbc9(0xb4)]["size"]) {
    const _0x34df12 = Math[_0x13fbc9(0x16f)](
      (_0x3e17c2[_0x13fbc9(0xb4)]["size"] * 0x8) / audioDuration / 0x3e8
    );
    $(_0x13fbc9(0x1e2))[_0x13fbc9(0x179)] = _0x34df12 + "\x20k";
  } else $(_0x13fbc9(0x1e2))[_0x13fbc9(0x179)] = _0x13fbc9(0x162);
  attachTooltips(), drawEQCurve();
}
function controlsChanged(_0x2681d3) {
  const _0x578b5e = _0x22bffd;
  $("#btn-play")["classList"][_0x578b5e(0xc3)](
    _0x578b5e(0xa3),
    controlValues[_0x578b5e(0x158)]
  );
  if (stretch) {
    let _0x34ebb2 = Object[_0x578b5e(0x1ac)](
      { output: audioContext[_0x578b5e(0x127)] + (_0x2681d3 || 0x0) },
      controlValues
    );
    stretch["schedule"](_0x34ebb2);
  }
  updatePositionState();
}
function updateMediaSession(_0x52eefe) {
  const _0x2f4086 = _0x22bffd;
  _0x2f4086(0x19a) in navigator &&
    ((navigator[_0x2f4086(0x19a)][_0x2f4086(0x140)] = new MediaMetadata({
      title: _0x52eefe,
      artist: _0x2f4086(0x119),
      artwork: [
        {
          src: "https://next-amp-player.vercel.app/assets/logo/logo.png",
          sizes: _0x2f4086(0x1fd),
          type: _0x2f4086(0x1b4),
        },
      ],
    })),
    navigator[_0x2f4086(0x19a)][_0x2f4086(0x8c)](_0x2f4086(0x1ab), () =>
      $("#btn-play")[_0x2f4086(0xca)]()
    ),
    navigator[_0x2f4086(0x19a)][_0x2f4086(0x8c)](_0x2f4086(0x89), () =>
      $(_0x2f4086(0x9d))["click"]()
    ),
    navigator["mediaSession"][_0x2f4086(0x8c)]("previoustrack", () =>
      $(_0x2f4086(0x132))[_0x2f4086(0xca)]()
    ),
    navigator[_0x2f4086(0x19a)][_0x2f4086(0x8c)](_0x2f4086(0xb1), () =>
      $(_0x2f4086(0x8f))[_0x2f4086(0xca)]()
    ),
    navigator["mediaSession"][_0x2f4086(0x8c)](
      _0x2f4086(0x14e),
      (_0x511a83) => {
        const _0x2fb534 = _0x2f4086;
        _0x511a83[_0x2fb534(0x205)] !== undefined &&
          stretch &&
          (stretch[_0x2fb534(0x10d)]({ input: _0x511a83[_0x2fb534(0x205)] }),
          updatePositionState());
      }
    ),
    updatePositionState());
}
function updatePositionState() {
  const _0x2ea764 = _0x22bffd;
  if ("mediaSession" in navigator && stretch)
    try {
      navigator[_0x2ea764(0x19a)]["setPositionState"]({
        duration: audioDuration || 0x0,
        playbackRate: controlValues[_0x2ea764(0x158)]
          ? controlValues[_0x2ea764(0x1f3)]
          : 0x0,
        position: stretch["inputTime"] || 0x0,
      });
    } catch (_0x42ff9d) {}
}
let LIBRARY = [],
  playlists = { main: { name: _0x22bffd(0x1a0), trackIds: [] } },
  currentPlaylistId = _0x22bffd(0x173),
  currentTrackIndex = -0x1,
  selectedIndices = new Set(),
  lastSelectedIndex = -0x1;
const DB_NAME = "NextampUltimateDB",
  dbReq = indexedDB[_0x22bffd(0xef)](DB_NAME, 0x8);
(dbReq[_0x22bffd(0x105)] = (_0x5342cf) => {
  const _0x1b0ac8 = _0x22bffd,
    _0x428c48 = _0x5342cf[_0x1b0ac8(0x221)]["result"];
  if (!_0x428c48["objectStoreNames"][_0x1b0ac8(0x23d)](_0x1b0ac8(0x18e)))
    _0x428c48[_0x1b0ac8(0x146)](_0x1b0ac8(0x18e), { keyPath: "id" });
  if (!_0x428c48["objectStoreNames"][_0x1b0ac8(0x23d)](_0x1b0ac8(0xdd)))
    _0x428c48[_0x1b0ac8(0x146)]("playlists", { keyPath: "id" });
}),
  (dbReq[_0x22bffd(0x110)] = async (_0xc5a6f7) => {
    await loadLibraryFromDB(),
      await loadPlaylistsFromDB(),
      loadSettings(),
      renderPlaylistSelect(),
      renderPlaylistUI(),
      initEQ(),
      drawEQCurve(),
      attachTooltips();
  });
function _0x2526(_0x5c6b21, _0x262223) {
  _0x5c6b21 = _0x5c6b21 - 0x66;
  const _0x2f1ee1 = _0x2f1e();
  let _0x25261a = _0x2f1ee1[_0x5c6b21];
  return _0x25261a;
}
async function saveTrackToLib(_0x36f48c) {
  const _0x285de9 = _0x22bffd,
    _0x64b72d = dbReq[_0x285de9(0xf2)],
    _0x5ddd58 = _0x64b72d["transaction"]("library", _0x285de9(0x231));
  _0x5ddd58[_0x285de9(0xf0)](_0x285de9(0x18e))[_0x285de9(0x19d)](_0x36f48c);
}
async function deleteTrackFromLib(_0x280f28) {
  const _0x4bf333 = _0x22bffd,
    _0x8e427d = dbReq["result"],
    _0x426753 = _0x8e427d[_0x4bf333(0xa6)](_0x4bf333(0x18e), _0x4bf333(0x231));
  _0x426753[_0x4bf333(0xf0)](_0x4bf333(0x18e))[_0x4bf333(0x106)](_0x280f28);
}
async function savePlaylistsToDB(_0x4ee623) {
  const _0x9a4a25 = _0x22bffd,
    _0x598f9d = dbReq["result"],
    _0xcd6dff = _0x598f9d["transaction"]("playlists", "readwrite");
  _0xcd6dff[_0x9a4a25(0xf0)](_0x9a4a25(0xdd))[_0x9a4a25(0x19d)](_0x4ee623);
}
async function loadLibraryFromDB() {
  return new Promise((_0x51a274) => {
    const _0x35247a = _0x2526,
      _0x5a8a92 = dbReq["result"],
      _0xf4b8d1 = _0x5a8a92["transaction"](_0x35247a(0x18e), _0x35247a(0xc0)),
      _0x3b0aa7 = _0xf4b8d1["objectStore"](_0x35247a(0x18e))[
        _0x35247a(0x108)
      ]();
    _0x3b0aa7[_0x35247a(0x110)] = () => {
      const _0x49388c = _0x35247a;
      (LIBRARY = _0x3b0aa7[_0x49388c(0xf2)] || []), _0x51a274();
    };
  });
}
async function loadPlaylistsFromDB() {
  return new Promise((_0x5d7834) => {
    const _0x278498 = _0x2526,
      _0x49ff5d = dbReq[_0x278498(0xf2)],
      _0xa46784 = _0x49ff5d[_0x278498(0xa6)](_0x278498(0xdd), _0x278498(0xc0)),
      _0x2d3e8d = _0xa46784["objectStore"]("playlists")[_0x278498(0x108)]();
    _0x2d3e8d["onsuccess"] = () => {
      const _0x363c1e = _0x278498;
      if (_0x2d3e8d[_0x363c1e(0xf2)])
        _0x2d3e8d[_0x363c1e(0xf2)][_0x363c1e(0xfd)](
          (_0x36c8ea) => (playlists[_0x36c8ea["id"]] = _0x36c8ea)
        );
      _0x5d7834();
    };
  });
}
const getTrackById = (_0x4c6da5) =>
  LIBRARY[_0x22bffd(0x1f1)]((_0x4a0b9c) => _0x4a0b9c["id"] === _0x4c6da5);
function getCurrentDisplayList() {
  const _0x11b354 = _0x22bffd;
  if (currentPlaylistId === _0x11b354(0x173)) return LIBRARY;
  return playlists[currentPlaylistId]["trackIds"]
    ["map"]((_0x438fa5) => getTrackById(_0x438fa5))
    ["filter"]((_0x1096f8) => _0x1096f8);
}
async function playTrack(_0xbed186) {
  const _0x5a8b21 = _0x22bffd;
  if (!isEngineHot) await initAudioEngine();
  if (playDebounceTimer) clearTimeout(playDebounceTimer);
  isChangingTrack = !![];
  let _0x5ad328 = getCurrentDisplayList();
  if (_0xbed186 < 0x0 || _0xbed186 >= _0x5ad328[_0x5a8b21(0x13c)]) {
    isChangingTrack = ![];
    return;
  }
  currentTrackIndex = _0xbed186;
  const _0x6ec39d =
    _0x5a8b21(0x192) in window || navigator["maxTouchPoints"] > 0x0;
  _0x6ec39d &&
    selectedIndices[_0x5a8b21(0xdb)] <= 0x1 &&
    (selectedIndices["clear"](),
    selectedIndices[_0x5a8b21(0xf5)](_0xbed186),
    (lastSelectedIndex = _0xbed186));
  renderPlaylistUI();
  const _0x2b6950 = _0x5ad328[_0xbed186];
  ($(_0x5a8b21(0x9e))["textContent"] =
    _0xbed186 + 0x1 + ".\x20" + _0x2b6950[_0x5a8b21(0x224)] + _0x5a8b21(0x229)),
    (playDebounceTimer = setTimeout(async () => {
      const _0x2a871c = _0x5a8b21;
      checkAndResumeAudioContext();
      try {
        const _0x397c9f = await _0x2b6950[_0x2a871c(0xb4)][_0x2a871c(0xed)]();
        await loadAudioEngine(_0x397c9f, _0x2b6950),
          ($(_0x2a871c(0x9e))[_0x2a871c(0x179)] =
            _0xbed186 + 0x1 + ".\x20" + _0x2b6950["name"]);
      } catch (_0x52a2ba) {
        console[_0x2a871c(0x225)](_0x2a871c(0x181), _0x52a2ba),
          ($("#marquee")[_0x2a871c(0x179)] = _0x2a871c(0x121)),
          (isChangingTrack = ![]),
          (_0x2b6950[_0x2a871c(0xcf)] = !![]),
          await saveTrackToLib(_0x2b6950),
          renderPlaylistUI();
      }
    }, 0xc8));
}
function handleNextTrack(_0xde7f1e = ![]) {
  const _0x373be4 = _0x22bffd;
  let _0x27f395 = getCurrentDisplayList();
  if (_0x27f395[_0x373be4(0x13c)] === 0x0) return;
  let _0x334d71;
  if (_0xde7f1e && repeatMode === 0x2) _0x334d71 = currentTrackIndex;
  else {
    if (isShuffle) {
      if (_0x27f395[_0x373be4(0x13c)] > 0x1)
        do {
          _0x334d71 = Math[_0x373be4(0x1cb)](
            Math[_0x373be4(0x115)]() * _0x27f395[_0x373be4(0x13c)]
          );
        } while (_0x334d71 === currentTrackIndex);
      else _0x334d71 = 0x0;
    } else _0x334d71 = currentTrackIndex + 0x1;
  }
  _0x334d71 < _0x27f395[_0x373be4(0x13c)]
    ? playTrack(_0x334d71)
    : repeatMode === 0x1 || !_0xde7f1e
    ? playTrack(0x0)
    : $(_0x373be4(0x168))["click"]();
}
function handlePrevTrack() {
  const _0x341061 = _0x22bffd;
  let _0x349375 = getCurrentDisplayList();
  if (_0x349375["length"] === 0x0) return;
  let _0x1fb49a = isShuffle
    ? Math["floor"](Math[_0x341061(0x115)]() * _0x349375["length"])
    : currentTrackIndex - 0x1;
  if (_0x1fb49a < 0x0)
    _0x1fb49a = repeatMode === 0x1 ? _0x349375[_0x341061(0x13c)] - 0x1 : 0x0;
  playTrack(_0x1fb49a);
}
($("#btn-play")[_0x22bffd(0x226)] = async () => {
  const _0x6dbaf2 = _0x22bffd;
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  const _0x4dabd3 = getCurrentDisplayList(),
    _0x262412 = _0x6dbaf2(0x192) in window || navigator["maxTouchPoints"] > 0x0;
  if (_0x262412 && selectedIndices[_0x6dbaf2(0xdb)] > 0x0) {
    const _0x29c8ee = Array[_0x6dbaf2(0x94)](selectedIndices)[0x0];
    if (_0x29c8ee !== currentTrackIndex && _0x4dabd3[_0x29c8ee]) {
      playTrack(_0x29c8ee);
      return;
    }
  }
  if (!stretch && _0x4dabd3[_0x6dbaf2(0x13c)] > 0x0)
    playTrack(Math[_0x6dbaf2(0x1b2)](0x0, currentTrackIndex));
  else
    stretch &&
      ((controlValues[_0x6dbaf2(0x158)] = !controlValues["active"]),
      controlsChanged(0.1));
}),
  ($(_0x22bffd(0x9d))[_0x22bffd(0x226)] = () => {
    const _0x2c3995 = _0x22bffd;
    (controlValues[_0x2c3995(0x158)] = ![]), controlsChanged();
  }),
  ($(_0x22bffd(0x168))[_0x22bffd(0x226)] = () => {
    const _0x8da732 = _0x22bffd;
    (controlValues[_0x8da732(0x158)] = ![]),
      stretch &&
        (stretch[_0x8da732(0x21a)](), stretch["schedule"]({ input: 0x0 })),
      ($(_0x8da732(0x182))[_0x8da732(0x1c3)] = 0x0),
      ($(_0x8da732(0x152))[_0x8da732(0x179)] = "00:00"),
      $("#btn-play")[_0x8da732(0x227)][_0x8da732(0x130)](_0x8da732(0xa3)),
      ($(_0x8da732(0x9e))[_0x8da732(0x179)] = _0x8da732(0x177)),
      (isChangingTrack = ![]),
      updatePositionState();
  }),
  ($(_0x22bffd(0x8f))[_0x22bffd(0x226)] = () => handleNextTrack(![])),
  ($(_0x22bffd(0x132))[_0x22bffd(0x226)] = () => handlePrevTrack());
const eqContainer = $(_0x22bffd(0x6f)),
  eqCanvas = $(_0x22bffd(0xf1)),
  eqCtx = eqCanvas[_0x22bffd(0x6b)]("2d");
($("#btn-eq-toggle")["onclick"] = () => {
  const _0x3fb830 = _0x22bffd;
  (isEqOn = !isEqOn),
    ($(_0x3fb830(0x117))["textContent"] = isEqOn ? "ON" : _0x3fb830(0x98)),
    $("#btn-eq-toggle")[_0x3fb830(0x227)][_0x3fb830(0xc3)](
      _0x3fb830(0xa3),
      isEqOn
    ),
    $$(_0x3fb830(0x245))["forEach"]((_0x259f34, _0x40899d) =>
      updateEqBand(_0x40899d, _0x259f34[_0x3fb830(0x1c3)])
    ),
    saveSettings();
}),
  FREQUENCIES[_0x22bffd(0xfd)]((_0x422939, _0x23ddd3) => {
    const _0x36fc30 = _0x22bffd,
      _0x179e0f = document[_0x36fc30(0x202)](_0x36fc30(0x18d));
    (_0x179e0f[_0x36fc30(0x1fe)] = _0x36fc30(0x75)),
      (_0x179e0f[_0x36fc30(0x1c6)] =
        _0x36fc30(0x161) +
        (isEqOn ? _0x36fc30(0x123) : "") +
        _0x36fc30(0xc8) +
        _0x23ddd3 +
        _0x36fc30(0x211) +
        _0x23ddd3 +
        _0x36fc30(0x6a) +
        _0x23ddd3 +
        _0x36fc30(0x1db) +
        (_0x422939 >= 0x3e8 ? _0x422939 / 0x3e8 + "k" : _0x422939) +
        _0x36fc30(0x79)),
      (_0x179e0f[_0x36fc30(0x1bd)]("input")[_0x36fc30(0x1c0)] = (_0x14f060) => {
        const _0x2f20a8 = _0x36fc30;
        (_0x14f060[_0x2f20a8(0x221)][_0x2f20a8(0x1c3)] = 0x0),
          handleEqInput(_0x23ddd3, 0x0, _0x14f060[_0x2f20a8(0x221)]);
      }),
      eqContainer["appendChild"](_0x179e0f);
  }),
  (window[_0x22bffd(0x101)] = (_0x23d6f7, _0x4daf5b, _0x4415a0) => {
    const _0x2036a4 = _0x22bffd;
    $("#eq-preset-select")[_0x2036a4(0x1c3)] !== _0x2036a4(0xf6) &&
      ($(_0x2036a4(0xee))[_0x2036a4(0x1c3)] = "custom"),
      updateEqBand(_0x23d6f7, _0x4daf5b),
      updateThumb(_0x4415a0, _0x2036a4(0x9a) + _0x23d6f7);
  }),
  (window["updateThumb"] = (_0x5de2e4, _0x381587) => {
    const _0x2d3be5 = _0x22bffd,
      _0x35b5ec = parseFloat(_0x5de2e4[_0x2d3be5(0x19e)]),
      _0x259995 = parseFloat(_0x5de2e4[_0x2d3be5(0x1b2)]),
      _0x4000ce = parseFloat(_0x5de2e4[_0x2d3be5(0x1c3)]),
      _0x33907a = ((_0x4000ce - _0x35b5ec) / (_0x259995 - _0x35b5ec)) * 0x64,
      _0x3a719e = $("#" + _0x381587);
    if (_0x3a719e)
      _0x3a719e[_0x2d3be5(0x100)][_0x2d3be5(0x184)] = 0x64 - _0x33907a + "%";
  }),
  (window[_0x22bffd(0x16d)] = (_0x2981d5, _0x33f57b) => {
    const _0x5e5608 = _0x22bffd;
    if (eqNodes[_0x2981d5])
      eqNodes[_0x2981d5]["gain"][_0x5e5608(0x1c3)] = isEqOn
        ? parseFloat(_0x33f57b)
        : 0x0;
    const _0x192a92 = $(_0x5e5608(0x1d8) + _0x2981d5);
    if (_0x192a92) {
      if (isEqOn) _0x192a92["classList"][_0x5e5608(0xf5)](_0x5e5608(0x123));
      else _0x192a92[_0x5e5608(0x227)][_0x5e5608(0x130)](_0x5e5608(0x123));
    }
    drawEQCurve(), saveSettings();
  });
function drawEQCurve() {
  const _0x15b197 = _0x22bffd;
  eqCtx[_0x15b197(0x166)](
    0x0,
    0x0,
    eqCanvas[_0x15b197(0x1a1)],
    eqCanvas[_0x15b197(0xe4)]
  ),
    (eqCtx[_0x15b197(0x1df)] = _0x15b197(0x148)),
    (eqCtx[_0x15b197(0x1ef)] = 0x1),
    eqCtx["beginPath"](),
    eqCtx[_0x15b197(0x16e)](0x0, 0xf),
    eqCtx["lineTo"](0xb4, 0xf),
    eqCtx[_0x15b197(0x220)]();
  if (!isEqOn) return;
  (eqCtx["strokeStyle"] = currentTheme[_0x15b197(0x164)]),
    (eqCtx[_0x15b197(0x1ef)] = 0x2),
    eqCtx[_0x15b197(0x167)]();
  const _0x4f4867 =
      eqCanvas[_0x15b197(0x1a1)] / (FREQUENCIES[_0x15b197(0x13c)] - 0x1),
    _0x2261e4 = [];
  FREQUENCIES[_0x15b197(0xfd)]((_0x3a0254, _0x5875e0) => {
    const _0x55491d = _0x15b197;
    let _0x57add8 = 0x0;
    if (eqNodes[_0x5875e0])
      _0x57add8 = eqNodes[_0x5875e0]["gain"][_0x55491d(0x1c3)];
    else {
      const _0x372d88 = $(_0x55491d(0xc9) + _0x5875e0 + "\x22]");
      _0x57add8 = _0x372d88 ? parseFloat(_0x372d88["value"]) : 0x0;
    }
    _0x2261e4[_0x55491d(0x1bb)]({
      x: _0x5875e0 * _0x4f4867,
      y: 0xf - _0x57add8 * (0xf / 0xe),
    });
  }),
    eqCtx["moveTo"](_0x2261e4[0x0]["x"], _0x2261e4[0x0]["y"]);
  for (
    let _0x2986dc = 0x1;
    _0x2986dc < _0x2261e4[_0x15b197(0x13c)] - 0x2;
    _0x2986dc++
  ) {
    const _0x91ec37 =
        (_0x2261e4[_0x2986dc]["x"] + _0x2261e4[_0x2986dc + 0x1]["x"]) / 0x2,
      _0x490883 =
        (_0x2261e4[_0x2986dc]["y"] + _0x2261e4[_0x2986dc + 0x1]["y"]) / 0x2;
    eqCtx[_0x15b197(0x217)](
      _0x2261e4[_0x2986dc]["x"],
      _0x2261e4[_0x2986dc]["y"],
      _0x91ec37,
      _0x490883
    );
  }
  eqCtx[_0x15b197(0x217)](
    _0x2261e4[_0x2261e4[_0x15b197(0x13c)] - 0x2]["x"],
    _0x2261e4[_0x2261e4[_0x15b197(0x13c)] - 0x2]["y"],
    _0x2261e4[_0x2261e4[_0x15b197(0x13c)] - 0x1]["x"],
    _0x2261e4[_0x2261e4[_0x15b197(0x13c)] - 0x1]["y"]
  ),
    eqCtx[_0x15b197(0x220)]();
}
$(_0x22bffd(0xee))[_0x22bffd(0x84)] = (_0xe27421) => {
  const _0x421174 = _0x22bffd,
    _0x3e7ae2 = _0xe27421[_0x421174(0x221)][_0x421174(0x1c3)];
  PRESETS[_0x3e7ae2] &&
    (PRESETS[_0x3e7ae2][_0x421174(0xfd)]((_0x4dce78, _0xb040fc) => {
      const _0x4fa5a7 = _0x421174,
        _0x45d47b = $(_0x4fa5a7(0xc9) + _0xb040fc + "\x22]");
      if (_0x45d47b) {
        (_0x45d47b[_0x4fa5a7(0x1c3)] = _0x4dce78),
          updateThumb(_0x45d47b, _0x4fa5a7(0x9a) + _0xb040fc);
        if (eqNodes[_0xb040fc])
          eqNodes[_0xb040fc][_0x4fa5a7(0x145)]["value"] = isEqOn
            ? _0x4dce78
            : 0x0;
      }
    }),
    drawEQCurve(),
    saveSettings());
};
const cvs = $("#visualizer"),
  ctx = cvs["getContext"]("2d"),
  visualModeNames = [_0x22bffd(0x1f6), "LINE", "WAVE", "OFF"];
let visualMode = 0x0;
$(_0x22bffd(0x22a))[_0x22bffd(0x226)] = () => {
  const _0x25773d = _0x22bffd;
  visualMode = (visualMode + 0x1) % 0x4;
  const _0x7db006 = $(_0x25773d(0xcc));
  (_0x7db006[_0x25773d(0x179)] = "" + visualModeNames[visualMode]),
    (_0x7db006[_0x25773d(0x100)]["opacity"] =
      visualMode === 0x3 ? _0x25773d(0x230) : "1");
};
function resizeCvs() {
  const _0x4d8075 = _0x22bffd,
    _0x328c10 = cvs[_0x4d8075(0xea)][_0x4d8075(0x1d6)]();
  (cvs[_0x4d8075(0x1a1)] = _0x328c10["width"]),
    (cvs["height"] = _0x328c10[_0x4d8075(0xe4)]);
}
window[_0x22bffd(0x1e4)]("resize", resizeCvs), setTimeout(resizeCvs, 0x1f4);
let lastUpdateTime = 0x0,
  lastFrameTime = 0x0;
const targetFPS = 0x3c;
function draw(_0x3295aa) {
  const _0x162c13 = _0x22bffd;
  requestAnimationFrame(draw);
  if (_0x3295aa - lastFrameTime < 0x3e8 / targetFPS) return;
  lastFrameTime = _0x3295aa;
  _0x3295aa - lastUpdateTime > 0x3e8 &&
    (updatePositionState(), (lastUpdateTime = _0x3295aa));
  if (stretch && !holding) {
    const _0x4dd5fd = $("#playback");
    _0x4dd5fd["max"] = audioDuration;
    const _0x7707e2 = stretch[_0x162c13(0x1a4)] || 0x0;
    (_0x4dd5fd[_0x162c13(0x1c3)] = _0x7707e2),
      ($(_0x162c13(0x152))[_0x162c13(0x179)] = formatTime(_0x7707e2)),
      controlValues["active"] &&
        _0x7707e2 >= audioDuration - 0.2 &&
        !isChangingTrack &&
        handleNextTrack(!![]);
  }
  (ctx["fillStyle"] = _0x162c13(0x216)),
    ctx["fillRect"](0x0, 0x0, cvs[_0x162c13(0x1a1)], cvs["height"]);
  if (visualMode === 0x3) return;
  const _0x1248a9 = analyser[_0x162c13(0xba)],
    _0x40d702 = new Uint8Array(_0x1248a9);
  if (visualMode === 0x0) {
    analyser[_0x162c13(0xaf)](_0x40d702);
    const _0x3f6a61 = cvs[_0x162c13(0xe4)] * 0.7,
      _0xa763e3 = cvs[_0x162c13(0xe4)],
      _0x4e1a9b = (cvs[_0x162c13(0x1a1)] / _0x1248a9) * 2.5,
      _0xd074a6 = ctx[_0x162c13(0xd9)](
        0x0,
        _0xa763e3,
        0x0,
        _0xa763e3 - _0x3f6a61
      );
    _0xd074a6[_0x162c13(0x13f)](0x0, currentTheme["eq1"]),
      _0xd074a6[_0x162c13(0x13f)](0.6, currentTheme["eq2"]),
      _0xd074a6[_0x162c13(0x13f)](0x1, currentTheme[_0x162c13(0x8a)]),
      (ctx[_0x162c13(0x15e)] = _0xd074a6);
    let _0x4d91d4 = 0x0;
    for (let _0x113389 = 0x0; _0x113389 < _0x1248a9; _0x113389++) {
      const _0x39e5da = _0x40d702[_0x113389] / 0xff,
        _0x25695f = _0x39e5da * _0x3f6a61;
      if (_0x25695f > 0x0)
        ctx[_0x162c13(0x20c)](
          _0x4d91d4,
          _0xa763e3 - _0x25695f,
          _0x4e1a9b - 0x1,
          _0x25695f
        );
      _0x4d91d4 += _0x4e1a9b;
    }
  } else {
    if (visualMode === 0x1) {
      analyser["getByteFrequencyData"](_0x40d702);
      const _0x371514 = cvs["height"] * 0.7,
        _0x277382 = cvs[_0x162c13(0xe4)];
      (ctx[_0x162c13(0x1ef)] = 0x2),
        (ctx[_0x162c13(0x1df)] = currentTheme[_0x162c13(0x164)]),
        ctx[_0x162c13(0x167)]();
      const _0x366b75 = cvs[_0x162c13(0x1a1)] / _0x1248a9;
      let _0x5cb398 = 0x0;
      for (let _0x35e499 = 0x0; _0x35e499 < _0x1248a9; _0x35e499++) {
        const _0x50b7fe = _0x40d702[_0x35e499] / 0xff,
          _0x2cb5a7 = _0x277382 - _0x50b7fe * _0x371514;
        if (_0x35e499 === 0x0) ctx["moveTo"](_0x5cb398, _0x2cb5a7);
        else ctx["lineTo"](_0x5cb398, _0x2cb5a7);
        _0x5cb398 += _0x366b75;
      }
      ctx[_0x162c13(0x220)]();
    } else {
      if (visualMode === 0x2) {
        analyser["getByteTimeDomainData"](_0x40d702),
          (ctx[_0x162c13(0x1ef)] = 0x2),
          (ctx[_0x162c13(0x1df)] = _0x162c13(0x159)),
          ctx[_0x162c13(0x167)]();
        const _0x5c8de4 = (cvs[_0x162c13(0x1a1)] * 0x1) / _0x1248a9;
        let _0x5d22b0 = 0x0;
        for (let _0x563270 = 0x0; _0x563270 < _0x1248a9; _0x563270++) {
          const _0x571da6 = _0x40d702[_0x563270] / 0x80,
            _0x2b4ff2 =
              cvs[_0x162c13(0xe4)] / 0x2 +
              (_0x571da6 - 0x1) * (cvs[_0x162c13(0xe4)] / 0x2);
          if (_0x563270 === 0x0) ctx[_0x162c13(0x16e)](_0x5d22b0, _0x2b4ff2);
          else ctx[_0x162c13(0x242)](_0x5d22b0, _0x2b4ff2);
          _0x5d22b0 += _0x5c8de4;
        }
        ctx[_0x162c13(0x220)]();
      }
    }
  }
}
requestAnimationFrame(draw),
  ($(_0x22bffd(0x20b))[_0x22bffd(0x226)] = (_0x4b76bd) => {
    const _0x530690 = _0x22bffd;
    (_0x4b76bd["target"]["id"] === "pl-box" ||
      _0x4b76bd[_0x530690(0x221)][_0x530690(0x227)]["contains"](
        _0x530690(0x92)
      )) &&
      (selectedIndices[_0x530690(0xa5)](), renderPlaylistUI());
  }),
  (window[_0x22bffd(0x93)] = () => {
    const _0x45882a = _0x22bffd,
      _0x5a0651 = $("#pl-box");
    _0x5a0651[_0x45882a(0x1c6)] = "";
    let _0x5b2762 = getCurrentDisplayList();
    if (_0x5b2762[_0x45882a(0x13c)] === 0x0)
      _0x5a0651["innerHTML"] =
        "<div\x20class=\x22text-gray-500\x20text-center\x20mt-10\x20text-[10px]\x20pointer-events-none\x22>" +
        (currentPlaylistId === _0x45882a(0x173)
          ? "Drop\x20files\x20or\x20Click\x20ADD..."
          : _0x45882a(0x137)) +
        _0x45882a(0x79);
    else
      _0x5b2762["forEach"]((_0x450ed6, _0xb9769a) => {
        const _0x54fc76 = _0x45882a,
          _0x657dfa = document[_0x54fc76(0x202)]("div");
        selectedIndices[_0x54fc76(0x178)](_0xb9769a)
          ? _0x657dfa[_0x54fc76(0x227)][_0x54fc76(0xf5)](_0x54fc76(0x22f))
          : _0x450ed6[_0x54fc76(0xcf)]
          ? (_0x657dfa[_0x54fc76(0x1fe)] +=
              "\x20text-red-500\x20hover:bg-[#222]")
          : (_0x657dfa["className"] +=
              "\x20theme-text-main\x20hover:bg-[#222]");
        let _0x2d5163 = _0xb9769a === currentTrackIndex ? _0x54fc76(0xc7) : "";
        (_0x657dfa[_0x54fc76(0x1fe)] += _0x54fc76(0xf4) + _0x2d5163),
          (_0x657dfa[_0x54fc76(0x201)] = !![]),
          (_0x657dfa["innerHTML"] =
            _0x54fc76(0xc4) +
            (_0xb9769a + 0x1) +
            _0x54fc76(0xe1) +
            _0x450ed6[_0x54fc76(0x224)] +
            _0x54fc76(0x200)),
          (_0x657dfa["ondragstart"] = (_0x56e58f) => {
            const _0x5f148b = _0x54fc76;
            _0x56e58f[_0x5f148b(0x1da)][_0x5f148b(0x1b7)](
              _0x5f148b(0x141),
              _0xb9769a
            ),
              _0x657dfa[_0x5f148b(0x227)][_0x5f148b(0xf5)](_0x5f148b(0x17b));
          }),
          (_0x657dfa["ondragend"] = () =>
            _0x657dfa[_0x54fc76(0x227)][_0x54fc76(0x130)]("dragging")),
          (_0x657dfa[_0x54fc76(0x102)] = (_0x43f94d) => {
            const _0x531d25 = _0x54fc76;
            _0x43f94d[_0x531d25(0x97)](),
              _0x657dfa[_0x531d25(0x227)][_0x531d25(0xf5)]("drag-over");
          }),
          (_0x657dfa[_0x54fc76(0x11b)] = () =>
            _0x657dfa[_0x54fc76(0x227)][_0x54fc76(0x130)]("drag-over")),
          (_0x657dfa[_0x54fc76(0x22c)] = (_0x4346d0) => {
            const _0x197924 = _0x54fc76;
            _0x4346d0[_0x197924(0x97)](),
              _0x657dfa[_0x197924(0x227)][_0x197924(0x130)]("drag-over"),
              handleDragDrop(
                parseInt(_0x4346d0[_0x197924(0x1da)]["getData"]("text/plain")),
                _0xb9769a
              );
          });
        let _0x20fb76 = 0x0;
        (_0x657dfa[_0x54fc76(0x116)] = (_0x50285f) => {
          const _0x344ef8 = _0x54fc76,
            _0x475e0f = new Date()[_0x344ef8(0x210)](),
            _0x114ca1 = _0x475e0f - _0x20fb76;
          _0x114ca1 < 0x12c &&
            _0x114ca1 > 0x0 &&
            (_0x50285f["preventDefault"](), playTrack(_0xb9769a)),
            (_0x20fb76 = _0x475e0f);
        }),
          (_0x657dfa[_0x54fc76(0x226)] = (_0x5b5846) => {
            const _0xbe354 = _0x54fc76;
            _0x5b5846[_0xbe354(0x241)]();
            if (_0x5b5846["shiftKey"] && lastSelectedIndex !== -0x1) {
              const _0x11eefa = Math[_0xbe354(0x19e)](
                  lastSelectedIndex,
                  _0xb9769a
                ),
                _0x125cf2 = Math[_0xbe354(0x1b2)](lastSelectedIndex, _0xb9769a);
              selectedIndices[_0xbe354(0xa5)]();
              for (
                let _0x45615c = _0x11eefa;
                _0x45615c <= _0x125cf2;
                _0x45615c++
              )
                selectedIndices[_0xbe354(0xf5)](_0x45615c);
            } else
              _0x5b5846[_0xbe354(0x203)] || _0x5b5846[_0xbe354(0x1e7)]
                ? (selectedIndices["has"](_0xb9769a)
                    ? selectedIndices[_0xbe354(0x106)](_0xb9769a)
                    : selectedIndices[_0xbe354(0xf5)](_0xb9769a),
                  (lastSelectedIndex = _0xb9769a))
                : (selectedIndices[_0xbe354(0xa5)](),
                  selectedIndices[_0xbe354(0xf5)](_0xb9769a),
                  (lastSelectedIndex = _0xb9769a));
            renderPlaylistUI();
          }),
          (_0x657dfa[_0x54fc76(0x1c0)] = () => playTrack(_0xb9769a)),
          _0x5a0651[_0x54fc76(0x163)](_0x657dfa);
      });
    $(_0x45882a(0xfb))[_0x45882a(0x179)] =
      _0x5b2762[_0x45882a(0x13c)] + _0x45882a(0x188);
    const _0x165b2a = selectedIndices[_0x45882a(0xdb)] > 0x0,
      _0x524953 = (_0x1ec099, _0x13894f) => {
        const _0x146d9d = _0x45882a,
          _0x2f90ad = $(_0x1ec099);
        _0x2f90ad[_0x146d9d(0x1ee)] = _0x13894f;
        if (_0x13894f)
          _0x2f90ad[_0x146d9d(0x227)]["add"](_0x146d9d(0xbb), _0x146d9d(0x14a)),
            _0x2f90ad[_0x146d9d(0x227)][_0x146d9d(0x130)](
              "text-red-900",
              _0x146d9d(0x6d),
              _0x146d9d(0x1d5)
            );
        else {
          _0x2f90ad["classList"][_0x146d9d(0x130)](
            "text-gray-500",
            _0x146d9d(0x14a)
          ),
            _0x2f90ad[_0x146d9d(0x227)][_0x146d9d(0xf5)](_0x146d9d(0x1d5));
          if (_0x1ec099 === _0x146d9d(0x165))
            _0x2f90ad[_0x146d9d(0x227)][_0x146d9d(0xf5)]("text-red-900");
          else _0x2f90ad[_0x146d9d(0x227)][_0x146d9d(0xf5)](_0x146d9d(0x6d));
        }
      };
    _0x524953("#btn-del-track", !_0x165b2a),
      _0x524953(_0x45882a(0x1eb), !_0x165b2a),
      _0x524953("#btn-move-down", !_0x165b2a),
      ($("#btn-del-pl")["style"][_0x45882a(0xd4)] =
        currentPlaylistId === _0x45882a(0x173) ? "none" : _0x45882a(0x1a3));
  }),
  (window[_0x22bffd(0x206)] = (_0x3fa510) => {
    const _0x1fbe0f = _0x22bffd;
    if (selectedIndices["size"] !== 0x1) return;
    const _0x4ebb94 = Array[_0x1fbe0f(0x94)](selectedIndices)[0x0];
    handleDragDrop(_0x4ebb94, _0x4ebb94 + _0x3fa510);
  }),
  (window[_0x22bffd(0x218)] = async (_0x283b84, _0x140995) => {
    const _0x10e69e = _0x22bffd;
    let _0xd03851 = getCurrentDisplayList();
    if (
      _0x140995 < 0x0 ||
      _0x140995 >= _0xd03851["length"] ||
      _0x283b84 === _0x140995
    )
      return;
    const _0x57d1e2 = _0xd03851[_0x10e69e(0x10c)](_0x283b84, 0x1)[0x0];
    _0xd03851[_0x10e69e(0x10c)](_0x140995, 0x0, _0x57d1e2);
    if (currentTrackIndex === _0x283b84) currentTrackIndex = _0x140995;
    else {
      if (currentTrackIndex === _0x140995 && _0x283b84 > _0x140995)
        currentTrackIndex++;
      else {
        if (currentTrackIndex === _0x140995 && _0x283b84 < _0x140995)
          currentTrackIndex--;
      }
    }
    currentPlaylistId !== _0x10e69e(0x173) &&
      ((playlists[currentPlaylistId]["trackIds"] = _0xd03851[_0x10e69e(0x171)](
        (_0x2347cb) => _0x2347cb["id"]
      )),
      await savePlaylistsToDB(playlists[currentPlaylistId])),
      selectedIndices["clear"](),
      selectedIndices[_0x10e69e(0xf5)](_0x140995),
      renderPlaylistUI();
  }),
  (window[_0x22bffd(0x21f)] = async () => {
    const _0x12053d = _0x22bffd;
    if (selectedIndices[_0x12053d(0xdb)] === 0x0) return;
    customConfirm(
      "Remove\x20" + selectedIndices[_0x12053d(0xdb)] + _0x12053d(0x6e),
      async () => {
        const _0xf59aaa = _0x12053d,
          _0x58a735 = Array[_0xf59aaa(0x94)](selectedIndices)[_0xf59aaa(0x74)](
            (_0x7071d9, _0x2ebad1) => _0x2ebad1 - _0x7071d9
          );
        if (currentPlaylistId === _0xf59aaa(0x173)) {
          const _0x1ee0cf = getCurrentDisplayList();
          for (let _0x42c90e of _0x58a735) {
            await deleteTrackFromLib(_0x1ee0cf[_0x42c90e]["id"]),
              LIBRARY[_0xf59aaa(0x10c)](_0x42c90e, 0x1);
          }
        } else {
          const _0x446be1 = playlists[currentPlaylistId];
          for (let _0x4567d9 of _0x58a735)
            _0x446be1[_0xf59aaa(0x1d3)][_0xf59aaa(0x10c)](_0x4567d9, 0x1);
          await savePlaylistsToDB(_0x446be1);
        }
        selectedIndices[_0xf59aaa(0xa5)](), renderPlaylistUI();
      }
    );
  }),
  (window[_0x22bffd(0x120)] = () => {
    const _0xd2eaf8 = _0x22bffd;
    if (currentPlaylistId === _0xd2eaf8(0x173)) return;
    customConfirm(
      _0xd2eaf8(0x1b0) + playlists[currentPlaylistId]["name"] + "\x22?",
      () => {
        const _0x5e5a6a = _0xd2eaf8;
        delete playlists[currentPlaylistId];
        const _0x1eb20d = dbReq["result"],
          _0x20b42f = _0x1eb20d[_0x5e5a6a(0xa6)](
            _0x5e5a6a(0xdd),
            _0x5e5a6a(0x231)
          );
        _0x20b42f[_0x5e5a6a(0xf0)]("playlists")["delete"](currentPlaylistId),
          switchPlaylist("main"),
          renderPlaylistSelect();
      }
    );
  });
const fileInput = $(_0x22bffd(0x11f));
($(_0x22bffd(0x194))["onclick"] = () => {
  const _0x5328d9 = _0x22bffd;
  $(_0x5328d9(0xa2))["classList"]["remove"](_0x5328d9(0x213));
}),
  (window[_0x22bffd(0xce)] = () => {
    const _0x5f2173 = _0x22bffd;
    $("#modal-add-method")[_0x5f2173(0x227)][_0x5f2173(0xf5)](_0x5f2173(0x213)),
      $(_0x5f2173(0x11f))["click"]();
  }),
  (window[_0x22bffd(0x1e6)] = () =>
    $(_0x22bffd(0xa2))[_0x22bffd(0x227)][_0x22bffd(0xf5)](_0x22bffd(0x213))),
  (fileInput[_0x22bffd(0x84)] = (_0x36e908) =>
    handleFiles(_0x36e908[_0x22bffd(0x221)][_0x22bffd(0x1f4)])),
  (document[_0x22bffd(0x1de)][_0x22bffd(0x102)] = (_0x37db18) =>
    _0x37db18[_0x22bffd(0x97)]()),
  (document[_0x22bffd(0x1de)][_0x22bffd(0x22c)] = (_0x1354c9) => {
    const _0xabb485 = _0x22bffd;
    _0x1354c9["preventDefault"](),
      handleFiles(_0x1354c9[_0xabb485(0x1da)][_0xabb485(0x1f4)]);
  });
async function handleFiles(_0x3e6348) {
  const _0x54b35f = _0x22bffd;
  if (!isEngineHot) await initAudioEngine();
  checkAndResumeAudioContext();
  if (!isEngineHot) await audioContext[_0x54b35f(0xb5)]();
  for (const _0x9ac424 of _0x3e6348) {
    const _0x130111 = "t_" + Date[_0x54b35f(0xd7)]() + Math[_0x54b35f(0x115)](),
      _0x591ccb = {
        id: _0x130111,
        name: _0x9ac424[_0x54b35f(0x224)],
        blob: _0x9ac424,
      };
    LIBRARY[_0x54b35f(0x1bb)](_0x591ccb),
      await saveTrackToLib(_0x591ccb),
      currentPlaylistId !== _0x54b35f(0x173) &&
        (playlists[currentPlaylistId]["trackIds"][_0x54b35f(0x1bb)](_0x130111),
        await savePlaylistsToDB(playlists[currentPlaylistId]));
  }
  renderPlaylistUI();
}
(window[_0x22bffd(0x13e)] = () => {
  const _0x159736 = _0x22bffd;
  ($(_0x159736(0x1ca))[_0x159736(0x1c3)] = ""),
    $("#modal-new-playlist")["classList"][_0x159736(0x130)](_0x159736(0x213)),
    $(_0x159736(0x1ca))[_0x159736(0xb8)]();
}),
  (window[_0x22bffd(0x1c5)] = () =>
    $("#modal-new-playlist")[_0x22bffd(0x227)][_0x22bffd(0xf5)](
      _0x22bffd(0x213)
    )),
  (window["confirmNewPlaylist"] = () => {
    const _0x2c6a92 = _0x22bffd,
      _0x4e51ca = $("#new-playlist-name")[_0x2c6a92(0x1c3)];
    _0x4e51ca &&
      _0x4e51ca[_0x2c6a92(0x73)]()[_0x2c6a92(0x13c)] > 0x0 &&
      (createNewPlaylist(_0x4e51ca[_0x2c6a92(0x73)]()),
      closeNewPlaylistModal());
  }),
  (window["createNewPlaylist"] = (_0x775d81) => {
    const _0xfdf9b7 = _0x22bffd,
      _0xfddac3 = _0xfdf9b7(0x87) + Date["now"]();
    (playlists[_0xfddac3] = { id: _0xfddac3, name: _0x775d81, trackIds: [] }),
      savePlaylistsToDB(playlists[_0xfddac3]),
      renderPlaylistSelect(),
      switchPlaylist(_0xfddac3);
  }),
  (window[_0x22bffd(0x246)] = (_0x3ec7fd) => {
    const _0x35b62a = _0x22bffd;
    (currentPlaylistId = _0x3ec7fd),
      ($(_0x35b62a(0x234))[_0x35b62a(0x1c3)] = _0x3ec7fd),
      selectedIndices[_0x35b62a(0xa5)](),
      renderPlaylistUI(),
      saveSettings();
  }),
  (window["renderPlaylistSelect"] = () => {
    const _0x3bde98 = _0x22bffd,
      _0x2d733b = $(_0x3bde98(0x234));
    (_0x2d733b[_0x3bde98(0x1c6)] = _0x3bde98(0x80)),
      Object[_0x3bde98(0x10b)](playlists)
        ["filter"]((_0x3830d7) => _0x3830d7 !== _0x3bde98(0x173))
        ["forEach"]((_0x58239f) => {
          const _0x1a0ef8 = _0x3bde98,
            _0x209025 = document[_0x1a0ef8(0x202)](_0x1a0ef8(0x14d));
          (_0x209025[_0x1a0ef8(0x1c3)] = _0x58239f),
            (_0x209025["textContent"] = playlists[_0x58239f][_0x1a0ef8(0x224)]),
            _0x2d733b[_0x1a0ef8(0x163)](_0x209025);
        }),
      (_0x2d733b[_0x3bde98(0x1c3)] = currentPlaylistId);
  }),
  ($("#playlist-select")[_0x22bffd(0x84)] = (_0x459063) =>
    switchPlaylist(_0x459063[_0x22bffd(0x221)][_0x22bffd(0x1c3)])),
  (window["openAddToModal"] = () => {
    const _0x5c5ae7 = _0x22bffd;
    if (!selectedIndices[_0x5c5ae7(0xdb)]) return customAlert(_0x5c5ae7(0x20d));
    const _0x3f8f70 = $("#modal-list");
    (_0x3f8f70[_0x5c5ae7(0x1c6)] = ""),
      Object[_0x5c5ae7(0x10b)](playlists)
        [_0x5c5ae7(0x1b8)]((_0x506162) => _0x506162 !== "main")
        [_0x5c5ae7(0xfd)]((_0x390d5d) => {
          const _0x1d9838 = _0x5c5ae7,
            _0x52a670 = document[_0x1d9838(0x202)](_0x1d9838(0x1bc));
          (_0x52a670[_0x1d9838(0x1fe)] = _0x1d9838(0xf3)),
            (_0x52a670[_0x1d9838(0x179)] =
              playlists[_0x390d5d][_0x1d9838(0x224)]),
            (_0x52a670[_0x1d9838(0x226)] = () => {
              const _0x4cea49 = _0x1d9838,
                _0x1498ce = getCurrentDisplayList(),
                _0x3f0d0b = Array[_0x4cea49(0x94)](selectedIndices)[
                  _0x4cea49(0x171)
                ]((_0x2e592c) => _0x1498ce[_0x2e592c]["id"]);
              playlists[_0x390d5d][_0x4cea49(0x1d3)][_0x4cea49(0x1bb)](
                ..._0x3f0d0b
              ),
                savePlaylistsToDB(playlists[_0x390d5d]),
                closeAddToModal(),
                selectedIndices[_0x4cea49(0xa5)](),
                renderPlaylistUI();
            }),
            _0x3f8f70[_0x1d9838(0x163)](_0x52a670);
        }),
      $(_0x5c5ae7(0x180))[_0x5c5ae7(0x227)]["remove"](_0x5c5ae7(0x213));
  }),
  (window[_0x22bffd(0x12b)] = () =>
    $(_0x22bffd(0x180))[_0x22bffd(0x227)][_0x22bffd(0xf5)](_0x22bffd(0x213)));
let isShuffle = ![],
  repeatMode = 0x0;
$("#tog-shuffle")["onclick"] = function () {
  const _0x4bbe61 = _0x22bffd;
  (isShuffle = !isShuffle),
    this[_0x4bbe61(0x227)][_0x4bbe61(0xc3)]("active", isShuffle),
    saveSettings();
};
const updateRepeatBtn = () => {
  const _0x571bbc = _0x22bffd,
    _0xaa48a7 = $(_0x571bbc(0x232));
  _0xaa48a7[_0x571bbc(0x227)][_0x571bbc(0x130)]("active", _0x571bbc(0x214));
  if (repeatMode === 0x0) _0xaa48a7[_0x571bbc(0x179)] = _0x571bbc(0xe2);
  else {
    if (repeatMode === 0x1)
      _0xaa48a7["classList"]["add"](_0x571bbc(0x158)),
        (_0xaa48a7["textContent"] = _0x571bbc(0x17f));
    else
      repeatMode === 0x2 &&
        (_0xaa48a7[_0x571bbc(0x227)]["add"](_0x571bbc(0x214)),
        (_0xaa48a7[_0x571bbc(0x179)] = _0x571bbc(0x134)));
  }
};
$("#tog-repeat")[_0x22bffd(0x226)] = function () {
  (repeatMode = (repeatMode + 0x1) % 0x3), updateRepeatBtn(), saveSettings();
};
const updateMonoStereoState = () => {
  const _0x2d2081 = _0x22bffd;
  isMono
    ? ((stereoPath[_0x2d2081(0x145)]["value"] = 0x0),
      (monoPath[_0x2d2081(0x145)]["value"] = 0x1),
      ($(_0x2d2081(0x21d))[_0x2d2081(0x179)] = _0x2d2081(0x133)),
      $(_0x2d2081(0x21d))[_0x2d2081(0x227)]["remove"]("theme-text-main"),
      $(_0x2d2081(0x21d))[_0x2d2081(0x227)][_0x2d2081(0xf5)](_0x2d2081(0x12d)))
    : ((stereoPath["gain"][_0x2d2081(0x1c3)] = 0x1),
      (monoPath[_0x2d2081(0x145)]["value"] = 0x0),
      ($("#btn-mono-stereo")[_0x2d2081(0x179)] = _0x2d2081(0x155)),
      $("#btn-mono-stereo")[_0x2d2081(0x227)]["add"](_0x2d2081(0x154)),
      $(_0x2d2081(0x21d))[_0x2d2081(0x227)][_0x2d2081(0x130)](
        _0x2d2081(0x12d)
      ));
};
($(_0x22bffd(0x21d))[_0x22bffd(0x226)] = async () => {
  const _0x1abde8 = _0x22bffd;
  if (audioContext[_0x1abde8(0x21c)] === _0x1abde8(0x186))
    await audioContext[_0x1abde8(0xb5)]();
  (isMono = !isMono), updateMonoStereoState(), saveSettings();
}),
  ($(_0x22bffd(0x14f))[_0x22bffd(0x226)] = () => {
    (isReverbOn = !isReverbOn), updateReverbConnection(), saveSettings();
  }),
  (window["toggleSection"] = (_0x2907f4) =>
    $("#" + _0x2907f4)["classList"]["toggle"]("hidden"));
let deferredPrompt;
window[_0x22bffd(0x1e4)](_0x22bffd(0x208), (_0x47d1af) => {
  const _0x305a8a = _0x22bffd;
  _0x47d1af["preventDefault"](),
    (deferredPrompt = _0x47d1af),
    $(_0x305a8a(0x1d9))[_0x305a8a(0x227)]["remove"](_0x305a8a(0x213));
}),
  ($("#btn-install-pwa")[_0x22bffd(0x226)] = async () => {
    const _0x301da7 = _0x22bffd;
    $(_0x301da7(0x1d9))[_0x301da7(0x227)]["add"](_0x301da7(0x213)),
      deferredPrompt &&
        (deferredPrompt[_0x301da7(0x1e8)](), (deferredPrompt = null));
  });
const pb = $("#playback");
let holding = ![];
(pb[_0x22bffd(0x176)] = pb[_0x22bffd(0x192)] = () => (holding = !![])),
  (pb[_0x22bffd(0x1b5)] = pb[_0x22bffd(0x116)] =
    () => {
      const _0x3d3722 = _0x22bffd;
      (holding = ![]),
        stretch &&
          (stretch[_0x3d3722(0x10d)]({
            input: parseFloat(pb[_0x3d3722(0x1c3)]),
            rate: controlValues[_0x3d3722(0x1f3)],
            semitones: controlValues[_0x3d3722(0x1f8)],
          }),
          updatePositionState());
    }),
  (pb[_0x22bffd(0xe0)] = () => {
    if (!stretch) return;
    stretch["schedule"]({ input: parseFloat(pb["value"]), rate: 0x0 });
  }),
  ($(_0x22bffd(0x197))[_0x22bffd(0xe0)] = (_0x500ba8) => {
    const _0x2e772a = _0x22bffd;
    (masterGainNode[_0x2e772a(0x145)]["value"] = parseFloat(
      _0x500ba8["target"][_0x2e772a(0x1c3)]
    )),
      ($(_0x2e772a(0x156))[_0x2e772a(0x179)] =
        Math["round"](_0x500ba8[_0x2e772a(0x221)][_0x2e772a(0x1c3)] * 0x64) +
        "%"),
      saveSettings();
  }),
  ($("#main-bal")[_0x22bffd(0xe0)] = (_0x54f92d) => {
    const _0x3c7f77 = _0x22bffd;
    (pannerNode["pan"][_0x3c7f77(0x1c3)] = parseFloat(
      _0x54f92d["target"]["value"]
    )),
      saveSettings();
  }),
  ($(_0x22bffd(0x1ae))[_0x22bffd(0xe0)] = (_0x4914d5) => {
    const _0x13e6ae = _0x22bffd;
    (controlValues[_0x13e6ae(0x1f3)] = parseFloat(
      _0x4914d5[_0x13e6ae(0x221)]["value"]
    )),
      ($(_0x13e6ae(0xad))[_0x13e6ae(0x179)] =
        controlValues[_0x13e6ae(0x1f3)][_0x13e6ae(0x1bf)](0x2)),
      controlsChanged(),
      saveSettings();
  }),
  ($(_0x22bffd(0x142))["oninput"] = (_0x349920) => {
    const _0x423c16 = _0x22bffd;
    (controlValues[_0x423c16(0x1f8)] = parseFloat(
      _0x349920[_0x423c16(0x221)][_0x423c16(0x1c3)]
    )),
      ($(_0x423c16(0xd1))[_0x423c16(0x179)] = controlValues["semitones"]),
      controlsChanged(),
      saveSettings();
  });
function _0x2f1e() {
  const _0x21d8e6 = [
    "#ffff00",
    "#info-bitrate",
    "pan",
    "addEventListener",
    "#set-eq-1",
    "closeAddMethodModal",
    "metaKey",
    "prompt",
    "Remix_",
    "contextmenu",
    "#btn-move-up",
    "--eq-col-3",
    "Encoding\x20MP3...\x20(0%)",
    "disabled",
    "lineWidth",
    "#tab-content-",
    "find",
    "message",
    "rate",
    "files",
    "tooltipType",
    "BAR",
    "#set-audio-sr",
    "semitones",
    "YES",
    "activeElement",
    "Conn\x20Error:\x20",
    "left",
    "512x512",
    "className",
    "/assets/libs/worker/mp3-worker.js",
    "</span></div>",
    "draggable",
    "createElement",
    "ctrlKey",
    "Export\x20Failed:\x20",
    "seekTime",
    "moveTrack",
    "#modal-generic-msg",
    "beforeinstallprompt",
    "createObjectURL",
    "Processing\x20Audio...\x200%",
    "#pl-box",
    "fillRect",
    "Select\x20tracks\x20first",
    "createBuffer",
    "mime",
    "getTime",
    "\x22></div><div\x20class=\x22eq-thumb\x20\x22\x20style=\x22top:\x2050%\x22\x20id=\x22thumb-",
    "reverbGain",
    "hidden",
    "active-gold",
    "destination",
    "#111",
    "quadraticCurveTo",
    "handleDragDrop",
    "repeatMode",
    "stop",
    "volume",
    "state",
    "#btn-mono-stereo",
    "cursor",
    "handleDeleteTracks",
    "stroke",
    "target",
    "--theme-text",
    "50ROOxxd",
    "name",
    "error",
    "onclick",
    "classList",
    "setUint32",
    "\x20(Loading...)",
    "#visualizer-container",
    ".mp3",
    "ondrop",
    "revokeObjectURL",
    "type",
    "theme-highlight-bg",
    "0.5",
    "readwrite",
    "#tog-repeat",
    "00:00",
    "#playlist-select",
    "latencyHint",
    "mouseup",
    "Custom\x20sample\x20rate\x20failed,\x20falling\x20back",
    "right",
    "speakers",
    "includes",
    "#theme-preview-box",
    "\x20dB",
    "contains",
    "closeSettingsModal",
    "#val-reverb",
    "vertical",
    "stopPropagation",
    "lineTo",
    "decodeAudioData",
    "nextamp_settings_v9_stable",
    "input[data-idx]",
    "switchPlaylist",
    "#set-audio-latency",
    "frequency",
    "none",
    "getItem",
    "\x22></div><input\x20type=\x22range\x22\x20class=\x22vertical\x22\x20style=\x22height:\x20120%;\x20top:\x20-10%;\x22\x20min=\x22-12\x22\x20max=\x2212\x22\x20step=\x220.5\x22\x20value=\x220\x22\x20data-idx=\x22",
    "getContext",
    "\x20khz",
    "text-black",
    "\x20selected\x20track(s)?",
    "#eq-container",
    "maxTouchPoints",
    "eqPreset",
    "data",
    "trim",
    "sort",
    "flex\x20flex-col\x20items-center\x20h-full\x20flex-1\x20group\x20relative\x20py-3",
    "offsetWidth",
    "#main-reverb",
    "--theme-highlight",
    "</div>",
    "abs",
    "receivedSize",
    "border-win-green",
    "main-vol",
    "visibilitychange",
    "Encoding\x20MP3...\x20(",
    "<option\x20value=\x22main\x22>Main\x20Library</option>",
    "eq2",
    "Error:\x20Size\x20mismatch!\x20Expected\x20",
    "File\x20corrupted\x20during\x20transfer.\x20Please\x20try\x20again.",
    "onchange",
    "audio/wav",
    "938993apgzaK",
    "pl_",
    "sampleRate",
    "pause",
    "eq3",
    "querySelectorAll",
    "setActionHandler",
    "audio",
    "sync",
    "#btn-next",
    "3NAeXrv",
    "setInt16",
    "text-center",
    "renderPlaylistUI",
    "from",
    "savedEqGains",
    "closePeerModal",
    "preventDefault",
    "OFF",
    "--eq-col-2",
    "thumb-",
    "sin",
    "#main-bal",
    "#btn-pause",
    "#marquee",
    "file_received",
    "122456HoNzIB",
    "next-amp-player.vercel.app",
    "#modal-add-method",
    "pressed",
    "test",
    "clear",
    "transaction",
    "duration",
    "audioSampleRate",
    "CENTER",
    "peaking",
    "location",
    "highlight",
    "#val-rate",
    "exp",
    "getByteFrequencyData",
    "<i\x20class=\x22ph-bold\x20ph-hourglass\x20animate-hourglass\x20text-sm\x22></i>",
    "nexttrack",
    "qrcode-container",
    "#slider-tooltip",
    "blob",
    "resume",
    "#engine-status",
    "main-bal",
    "focus",
    "text-win-green",
    "frequencyBinCount",
    "text-gray-500",
    "#set-theme-window",
    "Export\x20Complete.",
    "#tab-btn-",
    "progress",
    "readonly",
    "#theme-preview-text",
    "textarea",
    "toggle",
    "<div\x20class=\x22flex\x20truncate\x20w-full\x20pointer-events-none\x22><span\x20class=\x22w-6\x20text-right\x20mr-2\x20flex-shrink-0\x22>",
    "12150EBuFOO",
    "0.0",
    "font-bold\x20text-white",
    "\x22\x20id=\x22eq-bg-",
    "input[data-idx=\x22",
    "click",
    "eqGains",
    "#v-status-indicator",
    "window",
    "triggerLocalFile",
    "hasError",
    "eq1",
    "#val-pitch",
    "onmessage",
    "connect",
    "display",
    "Saved:\x20",
    "createMediaElementSource",
    "now",
    "openSettingsModal",
    "createLinearGradient",
    "documentElement",
    "size",
    "25jPnatg",
    "playlists",
    "#modal-generic",
    "stringify",
    "oninput",
    ".</span><span\x20class=\x22truncate\x22>",
    "REPEAT",
    "charCodeAt",
    "height",
    "customAlert",
    "fftSize",
    "done",
    "Client\x20Connected!",
    "#tog-shuffle",
    "parentElement",
    "input",
    "385976nRqynY",
    "arrayBuffer",
    "#eq-preset-select",
    "open",
    "objectStore",
    "#eq-graph",
    "result",
    "w-full\x20text-left\x20px-2\x20py-1\x20text-[10px]\x20text-gray-300\x20hover:bg-win-green\x20hover:text-black\x20font-pixel\x20border\x20border-gray-600\x20mb-1",
    "\x20cursor-pointer\x20px-1\x20flex\x20justify-between\x20select-none\x20",
    "add",
    "custom",
    "#peer-status",
    "download",
    "terminate",
    "origin",
    "#pl-count",
    "Rendering\x20Effects...\x20(Please\x20wait)",
    "forEach",
    "Audio\x20settings\x20saved.\x20Reload\x20to\x20apply\x20changes?",
    "#host-progress-bar",
    "style",
    "handleEqInput",
    "ondragover",
    "#set-eq-2",
    "getChannelData",
    "onupgradeneeded",
    "delete",
    "Ready.\x20Scan\x20QR\x20with\x20your\x20phone.",
    "getAll",
    "boxShadow",
    "startRendering",
    "keys",
    "splice",
    "schedule",
    "setItem",
    "time",
    "onsuccess",
    "Worker\x20Error:\x20",
    "#modal-generic-btns",
    "onerror",
    "win-btn\x20w-20\x20h-6\x20text-[10px]",
    "random",
    "ontouchend",
    "#txt-eq-status",
    "#peer-link-text",
    "Nextamp\x20Player",
    "createGain",
    "ondragleave",
    "href",
    "customConfirm",
    "/remote.html?host=",
    "#upload-file",
    "handleDeletePlaylist",
    "Error\x20loading\x20file.",
    "setProperty",
    "eq-bar-active",
    "padStart",
    "sync_ack",
    "playback",
    "currentTime",
    "appearance",
    "49kxHJpt",
    "WAVE",
    "closeAddToModal",
    "code",
    "theme-text-sec",
    "#btn-export",
    "#000080",
    "remove",
    "--theme-window",
    "#btn-prev",
    "MONO",
    "REP\x201",
    "Init\x20failed",
    "isMono",
    "Playlist\x20empty.",
    "buffer",
    "close",
    "opener",
    "dataset",
    "length",
    "#disp-rev-gain",
    "openNewPlaylistModal",
    "addColorStop",
    "metadata",
    "text/plain",
    "[data-key=\x22semitones\x22]",
    "get",
    "1128zQVOYf",
    "gain",
    "createObjectStore",
    "#00ff00",
    "#333",
    "#set-theme-text",
    "cursor-default",
    "explicit",
    "#qrcode-container",
    "option",
    "seekto",
    "#btn-reverb-toggle",
    "audioLatency",
    "1391nEExYT",
    "#time-display",
    "touchstart",
    "theme-text-main",
    "STEREO",
    "#txt-vol",
    "meta",
    "active",
    "#00ffff",
    "\x20mins).\x20It\x20may\x20freeze\x20your\x20device.\x20Continue?",
    "pitch",
    "wait",
    "localhost",
    "fillStyle",
    "end",
    "parse",
    "<div\x20class=\x22relative\x20h-full\x20w-full\x20flex\x20justify-center\x22><div\x20class=\x22eq-bar-bg\x20",
    "N/A",
    "appendChild",
    "text",
    "#btn-del-track",
    "clearRect",
    "beginPath",
    "#btn-stop",
    "catch",
    "saveAudioSettings",
    "toString",
    "scrollTop",
    "updateEqBand",
    "moveTo",
    "round",
    "#modal-settings",
    "map",
    "--eq-col-1",
    "main",
    "Error:\x20",
    "Space",
    "onmousedown",
    "Stopped.",
    "has",
    "textContent",
    "Receiving:\x20",
    "dragging",
    "key",
    "#modal-peer-receive",
    "createBiquadFilter",
    "REP\x20ALL",
    "#modal-add-to",
    "Play\x20Error:",
    "#playback",
    "bal",
    "top",
    "#ffcc00",
    "suspended",
    "3007800dvSlmU",
    "\x20TRACKS",
    "toLowerCase",
    "addBuffers",
    "0\x200\x204px\x20#0f0",
    "interrupted",
    "div",
    "library",
    "resetTheme",
    "setFloat32",
    "setUint8",
    "ontouchstart",
    "createAnalyser",
    "#btn-pl-add",
    "Piracy\x20detected!",
    "<h1>Unauthorized\x20Copy</h1>",
    "#main-vol",
    "openPeerModal",
    "setUint16",
    "mediaSession",
    "vol",
    "numberOfChannels",
    "put",
    "min",
    "createConvolver",
    "Main\x20Library",
    "width",
    "disconnect",
    "block",
    "inputTime",
    "interactive",
    "\x20[OK]",
    "platform",
    "Auto-Next\x20(Background\x20Check)",
    "index.html",
    "userAgent",
    "play",
    "assign",
    "#host-progress-wrap",
    "[data-key=\x22rate\x22]",
    "isShuffle",
    "Delete\x20playlist\x20\x22",
    "search",
    "max",
    "default",
    "image/png",
    "onmouseup",
    "backgroundColor",
    "setData",
    "filter",
    "URL",
    "HOST\x20ID:\x20",
    "push",
    "button",
    "querySelector",
    "channelInterpretation",
    "toFixed",
    "ondblclick",
    "getElementById",
    "textSec",
    "value",
    "theme",
    "closeNewPlaylistModal",
    "innerHTML",
    "switchSettingsTab",
    "107hJzHuY",
    "Export\x20feature\x20disabled\x20due\x20to\x20Safari/iOS\x20WebAudio\x20limitations.",
    "#new-playlist-name",
    "floor",
    "6458skEJDO",
    "<i\x20class=\x22ph-fill\x20ph-floppy-disk\x20text-sm\x22></i>",
    "isEqOn",
    "#set-theme-high",
    "float32",
    "removeChild",
    "replace",
    "trackIds",
    "raw",
    "cursor-pointer",
    "getBoundingClientRect",
    "Preparing\x20Export...",
    "#eq-bg-",
    "#btn-install-pwa",
    "dataTransfer",
    "\x22\x20data-tooltip-type=\x22db\x22></div><div\x20class=\x22absolute\x20-bottom-1\x20text-[7px]\x20theme-text-main\x20font-pixel\x20tracking-tighter\x20pointer-events-none\x22>",
    "#set-eq-3",
    "log",
    "body",
    "strokeStyle",
    "input[data-key=\x22rate\x22]",
  ];
  _0x2f1e = function () {
    return _0x21d8e6;
  };
  return _0x2f1e();
}
function audioBufferToWav(_0x4f3c49, _0x4bb2ea) {
  const _0x1e81d4 = _0x22bffd;
  _0x4bb2ea = _0x4bb2ea || {};
  var _0x3befa2 = _0x4f3c49[_0x1e81d4(0x19c)],
    _0x581a9e = _0x4f3c49["sampleRate"],
    _0x519863 = _0x4bb2ea[_0x1e81d4(0x1d0)] ? 0x3 : 0x1,
    _0x56960c = _0x519863 === 0x3 ? 0x20 : 0x10,
    _0x2a2b72;
  return (
    _0x3befa2 === 0x2
      ? (_0x2a2b72 = interleave(
          _0x4f3c49["getChannelData"](0x0),
          _0x4f3c49["getChannelData"](0x1)
        ))
      : (_0x2a2b72 = _0x4f3c49["getChannelData"](0x0)),
    encodeWAV(_0x2a2b72, _0x519863, _0x581a9e, _0x3befa2, _0x56960c)
  );
}
function interleave(_0x1840dc, _0x300218) {
  const _0xcb90 = _0x22bffd;
  var _0x27bdc6 = _0x1840dc["length"] + _0x300218[_0xcb90(0x13c)],
    _0x33dc6b = new Float32Array(_0x27bdc6),
    _0x4bbf8e = 0x0,
    _0x466db1 = 0x0;
  while (_0x4bbf8e < _0x27bdc6) {
    (_0x33dc6b[_0x4bbf8e++] = _0x1840dc[_0x466db1]),
      (_0x33dc6b[_0x4bbf8e++] = _0x300218[_0x466db1]),
      _0x466db1++;
  }
  return _0x33dc6b;
}
function encodeWAV(_0x16db86, _0x4796c2, _0x8219bf, _0x4d5ec5, _0x111d84) {
  const _0x48caf3 = _0x22bffd;
  var _0x1d09d5 = _0x111d84 / 0x8,
    _0x4f1e9a = _0x4d5ec5 * _0x1d09d5,
    _0x5a8f45 = new ArrayBuffer(0x2c + _0x16db86["length"] * _0x1d09d5),
    _0x208eed = new DataView(_0x5a8f45);
  return (
    writeString(_0x208eed, 0x0, "RIFF"),
    _0x208eed[_0x48caf3(0x228)](
      0x4,
      0x24 + _0x16db86[_0x48caf3(0x13c)] * _0x1d09d5,
      !![]
    ),
    writeString(_0x208eed, 0x8, _0x48caf3(0x12a)),
    writeString(_0x208eed, 0xc, "fmt\x20"),
    _0x208eed[_0x48caf3(0x228)](0x10, 0x10, !![]),
    _0x208eed["setUint16"](0x14, _0x4796c2, !![]),
    _0x208eed["setUint16"](0x16, _0x4d5ec5, !![]),
    _0x208eed[_0x48caf3(0x228)](0x18, _0x8219bf, !![]),
    _0x208eed["setUint32"](0x1c, _0x8219bf * _0x4f1e9a, !![]),
    _0x208eed[_0x48caf3(0x199)](0x20, _0x4f1e9a, !![]),
    _0x208eed[_0x48caf3(0x199)](0x22, _0x111d84, !![]),
    writeString(_0x208eed, 0x24, _0x48caf3(0x72)),
    _0x208eed[_0x48caf3(0x228)](0x28, _0x16db86["length"] * _0x1d09d5, !![]),
    _0x4796c2 === 0x1
      ? floatTo16BitPCM(_0x208eed, 0x2c, _0x16db86)
      : floatTo32BitPCM(_0x208eed, 0x2c, _0x16db86),
    new Blob([_0x208eed], { type: _0x48caf3(0x85) })
  );
}
function floatTo16BitPCM(_0x42d62b, _0x1c11b6, _0xaa0e1) {
  const _0x451a72 = _0x22bffd;
  for (
    var _0xef6544 = 0x0;
    _0xef6544 < _0xaa0e1[_0x451a72(0x13c)];
    _0xef6544++, _0x1c11b6 += 0x2
  ) {
    var _0x5989da = Math[_0x451a72(0x1b2)](
      -0x1,
      Math[_0x451a72(0x19e)](0x1, _0xaa0e1[_0xef6544])
    );
    _0x42d62b[_0x451a72(0x91)](
      _0x1c11b6,
      _0x5989da < 0x0 ? _0x5989da * 0x8000 : _0x5989da * 0x7fff,
      !![]
    );
  }
}
function floatTo32BitPCM(_0x5ea6b5, _0x291cd6, _0x4bc46e) {
  const _0x1eb346 = _0x22bffd;
  for (
    var _0x546939 = 0x0;
    _0x546939 < _0x4bc46e["length"];
    _0x546939++, _0x291cd6 += 0x4
  ) {
    _0x5ea6b5[_0x1eb346(0x190)](_0x291cd6, _0x4bc46e[_0x546939], !![]);
  }
}
function writeString(_0x44ed32, _0x18d2e4, _0x392667) {
  const _0x8fc34b = _0x22bffd;
  for (
    var _0x37677a = 0x0;
    _0x37677a < _0x392667[_0x8fc34b(0x13c)];
    _0x37677a++
  ) {
    _0x44ed32[_0x8fc34b(0x191)](
      _0x18d2e4 + _0x37677a,
      _0x392667[_0x8fc34b(0xe3)](_0x37677a)
    );
  }
}
function createOfflineImpulseResponse(
  _0x33ac00,
  _0x1ae001 = 0x3,
  _0x4f335f = 0x2
) {
  const _0x40ba79 = _0x22bffd,
    _0x237fbc = _0x33ac00[_0x40ba79(0x88)],
    _0x561356 = _0x237fbc * _0x1ae001,
    _0xbbf496 = _0x33ac00[_0x40ba79(0x20e)](0x2, _0x561356, _0x237fbc);
  for (let _0x56bf93 = 0x0; _0x56bf93 < 0x2; _0x56bf93++) {
    const _0x2801ea = _0xbbf496[_0x40ba79(0x104)](_0x56bf93);
    let _0x80d600 = 0x0;
    for (let _0x32b6ad = 0x0; _0x32b6ad < _0x561356; _0x32b6ad++) {
      const _0x5f2237 = Math[_0x40ba79(0x115)]() * 0x2 - 0x1;
      _0x80d600 = _0x80d600 + 0.12 * (_0x5f2237 - _0x80d600);
      const _0x5eb8f7 = _0x32b6ad / _0x561356,
        _0x333b44 = Math[_0x40ba79(0xae)](
          -_0x4f335f * _0x5eb8f7 * (_0x1ae001 / 0x3)
        );
      _0x2801ea[_0x32b6ad] = _0x80d600 * _0x333b44;
    }
  }
  return _0xbbf496;
}
window["exportCurrentTrackWav"] = async () => {
  const _0x5d1f59 = _0x22bffd,
    _0x223ad9 = getCurrentDisplayList();
  if (currentTrackIndex < 0x0 || !_0x223ad9[currentTrackIndex]) {
    customAlert("No\x20track\x20loaded\x20to\x20export.");
    return;
  }
  const _0x5cc708 = _0x223ad9[currentTrackIndex],
    _0xac9b70 = controlValues["rate"] || 0x1;
  $(_0x5d1f59(0x9e))[_0x5d1f59(0x179)] = _0x5d1f59(0x1d7);
  const _0x3e73c0 = await _0x5cc708[_0x5d1f59(0xb4)][_0x5d1f59(0xed)](),
    _0x2c2134 = await audioContext[_0x5d1f59(0x243)](_0x3e73c0),
    _0x213d37 = _0x2c2134[_0x5d1f59(0xa7)] / _0xac9b70,
    _0x3d16ae = 0xa;
  _0x213d37 > _0x3d16ae * 0x3c
    ? customConfirm(
        "Output\x20is\x20very\x20long\x20(" +
          (_0x213d37 / 0x3c)[_0x5d1f59(0x1bf)](0x1) +
          _0x5d1f59(0x15a),
        () =>
          startRenderingProcess(
            _0x2c2134,
            _0x213d37,
            _0x5cc708[_0x5d1f59(0x224)]
          )
      )
    : startRenderingProcess(_0x2c2134, _0x213d37, _0x5cc708[_0x5d1f59(0x224)]);
};
function updateExportButtonState(_0x3deaa6) {
  const _0x314347 = _0x22bffd,
    _0x5a55c6 = $(_0x314347(0x12e));
  if (!_0x5a55c6) return;
  _0x3deaa6
    ? ((_0x5a55c6[_0x314347(0x1ee)] = !![]),
      _0x5a55c6[_0x314347(0x227)][_0x314347(0xf5)](_0x314347(0xa3)),
      (_0x5a55c6[_0x314347(0x1c6)] = _0x314347(0xb0)),
      (document["body"][_0x314347(0x100)][_0x314347(0x21e)] = _0x314347(0x15c)))
    : ((_0x5a55c6["disabled"] = ![]),
      _0x5a55c6["classList"][_0x314347(0x130)]("pressed"),
      (_0x5a55c6[_0x314347(0x1c6)] = _0x314347(0x1cd)),
      (document[_0x314347(0x1de)]["style"][_0x314347(0x21e)] = "default"),
      _0x5a55c6[_0x314347(0x227)]["remove"]("btn-working-analog"),
      _0x5a55c6[_0x314347(0x227)][_0x314347(0x130)](
        _0x314347(0xb9),
        _0x314347(0x7c)
      ),
      _0x5a55c6[_0x314347(0x227)]["add"]("text-win-green"));
}
async function startRenderingProcess(_0x48b1ca, _0x2391c5, _0x348aae) {
  const _0x606bf9 = _0x22bffd,
    _0x350979 = $(_0x606bf9(0x12e));
  if (_0x350979[_0x606bf9(0x1ee)]) return;
  updateExportButtonState(!![]),
    ($("#marquee")["textContent"] = _0x606bf9(0x20a));
  let _0x13a282 = null;
  try {
    const _0x947f2d = isReverbOn ? 0x2 : 0x0,
      _0x51f846 = 0xac44,
      _0x2b9bcf = new OfflineAudioContext(
        0x2,
        (_0x2391c5 + _0x947f2d) * _0x51f846,
        _0x51f846
      ),
      _0x467369 = await _0x371ebe(_0x2b9bcf),
      _0x1070a4 = [];
    for (
      let _0x299ae2 = 0x0;
      _0x299ae2 < _0x48b1ca[_0x606bf9(0x19c)];
      _0x299ae2++
    ) {
      _0x1070a4[_0x606bf9(0x1bb)](
        new Float32Array(_0x48b1ca[_0x606bf9(0x104)](_0x299ae2))
      );
    }
    await _0x467369[_0x606bf9(0x18a)](_0x1070a4),
      await new Promise((_0x334083) => setTimeout(_0x334083, 0xc8)),
      _0x467369["schedule"]({
        active: !![],
        input: 0x0,
        rate: controlValues[_0x606bf9(0x1f3)],
        semitones: controlValues[_0x606bf9(0x1f8)],
      });
    let _0x43d60b = _0x467369;
    const _0x2a141b = Array[_0x606bf9(0x94)](
      document[_0x606bf9(0x8b)](_0x606bf9(0x245))
    )[_0x606bf9(0x171)]((_0x510416) => parseFloat(_0x510416[_0x606bf9(0x1c3)]));
    if (isEqOn) {
      let _0x59f70b = _0x467369;
      FREQUENCIES[_0x606bf9(0xfd)]((_0x3085c8, _0x2a626b) => {
        const _0x785d90 = _0x606bf9,
          _0x4d9747 = _0x2b9bcf[_0x785d90(0x17e)]();
        (_0x4d9747[_0x785d90(0x22e)] = _0x785d90(0xaa)),
          (_0x4d9747[_0x785d90(0x67)][_0x785d90(0x1c3)] = _0x3085c8),
          (_0x4d9747["Q"]["value"] = 1.4),
          (_0x4d9747[_0x785d90(0x145)][_0x785d90(0x1c3)] =
            _0x2a141b[_0x2a626b] || 0x0),
          _0x59f70b[_0x785d90(0xd3)](_0x4d9747),
          (_0x59f70b = _0x4d9747);
      }),
        (_0x43d60b = _0x59f70b);
    }
    const _0xbb036c = _0x2b9bcf["createGain"]();
    (_0xbb036c[_0x606bf9(0x145)][_0x606bf9(0x1c3)] = parseFloat(
      $(_0x606bf9(0x197))[_0x606bf9(0x1c3)]
    )),
      _0x43d60b[_0x606bf9(0xd3)](_0xbb036c),
      _0xbb036c[_0x606bf9(0xd3)](_0x2b9bcf[_0x606bf9(0x215)]);
    if (isReverbOn) {
      const _0x1291c1 = _0x2b9bcf[_0x606bf9(0x19f)]();
      _0x1291c1[_0x606bf9(0x138)] = createOfflineImpulseResponse(_0x2b9bcf);
      const _0x3e9ba1 = _0x2b9bcf[_0x606bf9(0x11a)]();
      (_0x3e9ba1[_0x606bf9(0x145)]["value"] = parseFloat(
        $(_0x606bf9(0x77))[_0x606bf9(0x1c3)]
      )),
        _0x43d60b[_0x606bf9(0xd3)](_0x1291c1),
        _0x1291c1[_0x606bf9(0xd3)](_0x3e9ba1),
        _0x3e9ba1[_0x606bf9(0xd3)](_0x2b9bcf[_0x606bf9(0x215)]);
    }
    $(_0x606bf9(0x9e))[_0x606bf9(0x179)] = _0x606bf9(0xfc);
    const _0x2bccbd = await _0x2b9bcf[_0x606bf9(0x10a)]();
    return (
      ($("#marquee")[_0x606bf9(0x179)] = _0x606bf9(0x1ed)),
      new Promise((_0x5dc7b0, _0x3f4f87) => {
        const _0x571a33 = _0x606bf9;
        _0x13a282 = new Worker(_0x571a33(0x1ff));
        const _0x1aad94 = new Float32Array(_0x2bccbd["getChannelData"](0x0)),
          _0x5302aa =
            _0x2bccbd[_0x571a33(0x19c)] > 0x1
              ? new Float32Array(_0x2bccbd[_0x571a33(0x104)](0x1))
              : new Float32Array(_0x2bccbd[_0x571a33(0x104)](0x0)),
          _0x55fa34 = [_0x1aad94, _0x5302aa];
        _0x13a282["postMessage"](
          {
            channelData: _0x55fa34,
            sampleRate: _0x2bccbd[_0x571a33(0x88)],
            channels: 0x2,
          },
          [_0x1aad94[_0x571a33(0x138)], _0x5302aa[_0x571a33(0x138)]]
        ),
          (_0x13a282[_0x571a33(0xd2)] = function (_0x3f446e) {
            const _0x3fcd7e = _0x571a33;
            if (
              _0x3f446e[_0x3fcd7e(0x72)][_0x3fcd7e(0x22e)] === _0x3fcd7e(0xbf)
            ) {
              const _0x5c6fd5 = Math["round"](
                _0x3f446e[_0x3fcd7e(0x72)][_0x3fcd7e(0x1c3)] * 0x64
              );
              $("#marquee")["textContent"] = _0x3fcd7e(0x7f) + _0x5c6fd5 + "%)";
            } else {
              if (_0x3f446e[_0x3fcd7e(0x72)]["type"] === _0x3fcd7e(0xe7)) {
                const _0x2d1ae8 = URL[_0x3fcd7e(0x209)](
                    _0x3f446e["data"][_0x3fcd7e(0xb4)]
                  ),
                  _0x7a1d6a = document[_0x3fcd7e(0x202)]("a");
                (_0x7a1d6a[_0x3fcd7e(0x100)]["display"] = _0x3fcd7e(0x68)),
                  (_0x7a1d6a[_0x3fcd7e(0x11c)] = _0x2d1ae8);
                const _0x1cdc49 = _0x348aae[_0x3fcd7e(0x1d2)](/\.[^/.]+$/, "");
                (_0x7a1d6a[_0x3fcd7e(0xf8)] =
                  _0x3fcd7e(0x1e9) + _0x1cdc49 + _0x3fcd7e(0x22b)),
                  document[_0x3fcd7e(0x1de)]["appendChild"](_0x7a1d6a),
                  _0x7a1d6a[_0x3fcd7e(0xca)](),
                  setTimeout(() => {
                    const _0xaa17f8 = _0x3fcd7e;
                    document[_0xaa17f8(0x1de)][_0xaa17f8(0x1d1)](_0x7a1d6a),
                      window[_0xaa17f8(0x1b9)][_0xaa17f8(0x22d)](_0x2d1ae8),
                      ($(_0xaa17f8(0x9e))[_0xaa17f8(0x179)] = _0xaa17f8(0xbd)),
                      updateExportButtonState(![]);
                    if (_0x13a282) _0x13a282["terminate"]();
                    _0x5dc7b0();
                  }, 0x64);
              }
            }
          }),
          (_0x13a282[_0x571a33(0x113)] = function (_0xd897d2) {
            const _0x2ca6c4 = _0x571a33;
            console[_0x2ca6c4(0x225)](_0xd897d2),
              customAlert(_0x2ca6c4(0x111) + _0xd897d2[_0x2ca6c4(0x1f2)]),
              updateExportButtonState(![]);
            if (_0x13a282) _0x13a282[_0x2ca6c4(0xf9)]();
            _0x3f4f87(_0xd897d2);
          });
      })
    );
  } catch (_0x5214ac) {
    console[_0x606bf9(0x225)](_0x5214ac),
      customAlert(_0x606bf9(0x204) + _0x5214ac[_0x606bf9(0x1f2)]),
      ($(_0x606bf9(0x9e))["textContent"] = "Error."),
      updateExportButtonState(![]);
    if (_0x13a282) _0x13a282[_0x606bf9(0xf9)]();
  }
}
document[_0x22bffd(0x1e4)]("keydown", (_0x4eedc2) => {
  const _0x131dfb = _0x22bffd;
  if (
    _0x4eedc2[_0x131dfb(0x12c)] === _0x131dfb(0x175) ||
    _0x4eedc2["key"] === "\x20"
  ) {
    const _0x309ad0 = document[_0x131dfb(0x1fa)]["tagName"][_0x131dfb(0x189)](),
      _0x4d489e = document[_0x131dfb(0x1fa)][_0x131dfb(0x22e)];
    if (
      _0x309ad0 === _0x131dfb(0xc2) ||
      (_0x309ad0 === "input" && _0x4d489e === _0x131dfb(0x164))
    )
      return;
    _0x4eedc2[_0x131dfb(0x97)](),
      controlValues[_0x131dfb(0x158)]
        ? $(_0x131dfb(0x9d))[_0x131dfb(0xca)]()
        : $("#btn-play")[_0x131dfb(0xca)]();
  }
});
let peerHost = null,
  currentConn = null,
  incomingFile = { buffer: [], receivedSize: 0x0, meta: null };
(window[_0x22bffd(0x198)] = () => {
  const _0x27ddd4 = _0x22bffd;
  $(_0x27ddd4(0xa2))[_0x27ddd4(0x227)][_0x27ddd4(0xf5)](_0x27ddd4(0x213)),
    $(_0x27ddd4(0x17d))[_0x27ddd4(0x227)][_0x27ddd4(0x130)](_0x27ddd4(0x213));
  if (!peerHost) initPeerHost();
  else {
    if (peerHost["id"]) {
      const _0x1b52e0 =
        window[_0x27ddd4(0xab)][_0x27ddd4(0xfa)] +
        _0x27ddd4(0x11e) +
        peerHost["id"];
      ($(_0x27ddd4(0x118))[_0x27ddd4(0x179)] = _0x1b52e0),
        ($(_0x27ddd4(0x14c))[_0x27ddd4(0x1c6)] = ""),
        new QRCode(document[_0x27ddd4(0x1c1)](_0x27ddd4(0xb2)), {
          text: _0x1b52e0,
          width: 0x96,
          height: 0x96,
        });
    }
  }
}),
  (window[_0x22bffd(0x96)] = () => {
    const _0x547d01 = _0x22bffd;
    $("#modal-peer-receive")[_0x547d01(0x227)]["add"](_0x547d01(0x213)),
      currentConn && (currentConn[_0x547d01(0x139)](), (currentConn = null)),
      ($("#qrcode-container")[_0x547d01(0x1c6)] = "");
  });
function logPeer(_0x46e97a) {
  const _0x46b2e7 = _0x22bffd,
    _0x50fd22 = $(_0x46b2e7(0xf7));
  if (!_0x50fd22) return;
  const _0x198a76 = document[_0x46b2e7(0x202)](_0x46b2e7(0x18d));
  (_0x198a76[_0x46b2e7(0x179)] = ">\x20" + _0x46e97a),
    _0x50fd22[_0x46b2e7(0x163)](_0x198a76),
    (_0x50fd22[_0x46b2e7(0x16c)] = _0x50fd22["scrollHeight"]);
}
function initPeerHost() {
  const _0x498f39 = _0x22bffd;
  (peerHost = new Peer()),
    peerHost["on"](_0x498f39(0xef), (_0x233a89) => {
      const _0x2d102b = _0x498f39;
      logPeer(_0x2d102b(0x1ba) + _0x233a89);
      const _0x1ad26c =
        window[_0x2d102b(0xab)]["origin"] + _0x2d102b(0x11e) + _0x233a89;
      ($("#peer-link-text")["textContent"] = _0x1ad26c),
        ($(_0x2d102b(0x14c))[_0x2d102b(0x1c6)] = ""),
        new QRCode(document["getElementById"](_0x2d102b(0xb2)), {
          text: _0x1ad26c,
          width: 0x96,
          height: 0x96,
        }),
        logPeer(_0x2d102b(0x107));
    }),
    peerHost["on"]("connection", (_0x45b52f) => {
      const _0x397bef = _0x498f39;
      if (currentConn) currentConn[_0x397bef(0x139)]();
      (currentConn = _0x45b52f),
        logPeer(_0x397bef(0xe8)),
        _0x45b52f["on"](_0x397bef(0x72), async (_0x129ce5) => {
          const _0x5bff9c = _0x397bef;
          if (_0x129ce5[_0x5bff9c(0x22e)] === _0x5bff9c(0x157))
            (incomingFile[_0x5bff9c(0x157)] = _0x129ce5),
              (incomingFile[_0x5bff9c(0x138)] = []),
              (incomingFile[_0x5bff9c(0x7b)] = 0x0),
              $(_0x5bff9c(0x1ad))["classList"]["remove"]("hidden"),
              ($("#host-progress-bar")["style"][_0x5bff9c(0x1a1)] = "0%"),
              logPeer(_0x5bff9c(0x17a) + _0x129ce5[_0x5bff9c(0x224)] + "...");
          else {
            if (_0x129ce5[_0x5bff9c(0x22e)] === _0x5bff9c(0x8e))
              _0x45b52f["send"]({ type: _0x5bff9c(0x125) });
            else {
              if (_0x129ce5["type"] === _0x5bff9c(0x15f)) {
                if (
                  incomingFile[_0x5bff9c(0x7b)] !==
                  incomingFile[_0x5bff9c(0x157)][_0x5bff9c(0xdb)]
                ) {
                  logPeer(
                    _0x5bff9c(0x82) +
                      incomingFile[_0x5bff9c(0x157)]["size"] +
                      ",\x20got\x20" +
                      incomingFile[_0x5bff9c(0x7b)]
                  ),
                    alert(_0x5bff9c(0x83)),
                    (incomingFile[_0x5bff9c(0x138)] = []);
                  return;
                }
                logPeer("Verifying\x20&\x20Saving..."),
                  $(_0x5bff9c(0x1ad))["classList"]["add"](_0x5bff9c(0x213));
                try {
                  const _0x2b8d5a = new Blob(incomingFile["buffer"], {
                      type: incomingFile[_0x5bff9c(0x157)][_0x5bff9c(0x20f)],
                    }),
                    _0x7fa545 = new File(
                      [_0x2b8d5a],
                      incomingFile[_0x5bff9c(0x157)]["name"],
                      { type: incomingFile[_0x5bff9c(0x157)][_0x5bff9c(0x20f)] }
                    );
                  await handleFiles([_0x7fa545]),
                    logPeer(
                      _0x5bff9c(0xd5) +
                        incomingFile[_0x5bff9c(0x157)]["name"] +
                        _0x5bff9c(0x1a6)
                    ),
                    _0x45b52f["send"]({ type: _0x5bff9c(0x9f) });
                } catch (_0x826b44) {
                  console[_0x5bff9c(0x225)](_0x826b44),
                    logPeer(_0x5bff9c(0x174) + _0x826b44[_0x5bff9c(0x1f2)]);
                }
                incomingFile[_0x5bff9c(0x138)] = [];
              } else {
                if (
                  _0x129ce5 instanceof ArrayBuffer ||
                  _0x129ce5 instanceof Uint8Array
                ) {
                  incomingFile["buffer"][_0x5bff9c(0x1bb)](_0x129ce5),
                    (incomingFile[_0x5bff9c(0x7b)] +=
                      _0x129ce5["byteLength"] || _0x129ce5[_0x5bff9c(0x13c)]);
                  if (
                    incomingFile[_0x5bff9c(0x157)] &&
                    incomingFile[_0x5bff9c(0x157)]["size"] > 0x0
                  ) {
                    const _0x4f8200 =
                      (incomingFile[_0x5bff9c(0x7b)] /
                        incomingFile[_0x5bff9c(0x157)][_0x5bff9c(0xdb)]) *
                      0x64;
                    $(_0x5bff9c(0xff))[_0x5bff9c(0x100)][_0x5bff9c(0x1a1)] =
                      _0x4f8200 + "%";
                  }
                }
              }
            }
          }
        }),
        _0x45b52f["on"](_0x397bef(0x139), () => {
          logPeer("Client\x20Disconnected."), (currentConn = null);
        }),
        _0x45b52f["on"](_0x397bef(0x225), (_0x4b1ac4) =>
          logPeer(_0x397bef(0x1fb) + _0x4b1ac4)
        );
    }),
    peerHost["on"](_0x498f39(0x225), (_0x5e76a0) => {
      const _0x3203fa = _0x498f39;
      logPeer("Peer\x20Error:\x20" + _0x5e76a0[_0x3203fa(0x22e)]);
    });
}
