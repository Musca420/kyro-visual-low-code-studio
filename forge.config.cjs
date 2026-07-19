const windowsSign = require("./windows-sign.cjs");

module.exports = {
  outDir: "desktop-dist",
  packagerConfig: {
    asar: false,
    name: "Kyro",
    executableName: "kyro",
    ...(windowsSign ? { windowsSign } : {}),
    ignore: [
      /^\/.git($|\/)/,
      /^\/android-builds($|\/)/,
      /^\/artifacts($|\/)/,
      /^\/desktop-dist($|\/)/,
      /^\/e2e($|\/)/,
      /^\/generated-app($|\/)/,
      /^\/node_modules\/\.vite($|\/)/,
      /^\/.live-browser-profile($|\/)/,
      /^\/out($|\/)/,
      /^\/playwright-report($|\/)/,
      /^\/test-results($|\/)/,
      /^\/tests($|\/)/,
    ],
  },
  makers: [
    { name: "@electron-forge/maker-squirrel", config: { name: "kyro_studio", ...(windowsSign ? { windowsSign } : {}) } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-deb", config: {} },
    { name: "@electron-forge/maker-rpm", config: {} },
  ],
};
