/** Store-build Tailwind configuration. The extension's development/Go build
 * may keep the runtime compiler, while the Chrome Web Store build uses the
 * precompiled CSS generated from this file. */
module.exports = {
  content: [
    "./next-amp-extension/popup.html",
    "./next-amp-extension/popup.js",
    "./next-amp-extension/modules/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        "win-base": "#1a1a1a",
        "win-gray": "#292929",
        "btn-face": "#c0c0c0",
        "win-green": "#00ff00",
        "win-gold": "#ffcc00",
      },
      fontFamily: {
        pixel: ['"Chakra Petch"', "sans-serif"],
        ui: ['"Inter"', "sans-serif"],
      },
    },
  },
};
