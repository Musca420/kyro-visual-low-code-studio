module.exports = {
  outDir: "desktop-dist",
  packagerConfig: {
    asar: true,
    name: "FrontendEditor",
    executableName: "frontend-editor",
    ignore: [
      /^\/.git($|\/)/,
      /^\/android-builds($|\/)/,
      /^\/artifacts($|\/)/,
      /^\/desktop-dist($|\/)/,
      /^\/e2e($|\/)/,
      /^\/generated-app($|\/)/,
      /^\/.live-browser-profile($|\/)/,
      /^\/out($|\/)/,
      /^\/playwright-report($|\/)/,
      /^\/test-results($|\/)/,
      /^\/tests($|\/)/,
    ],
  },
  makers: [
    { name: "@electron-forge/maker-squirrel", config: { name: "frontend_editor" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-deb", config: {} },
    { name: "@electron-forge/maker-rpm", config: {} },
  ],
};
