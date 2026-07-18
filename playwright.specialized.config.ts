import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-specialized",
  fullyParallel: false,
  reporter: "list",
  use: { trace: "retain-on-failure" },
  webServer: [
    { command: "npm run preview -- --host 127.0.0.1 --port 4281", cwd: "out/experience-landing", url: "http://127.0.0.1:4281", reuseExistingServer: false },
    { command: "npm run preview -- --host 127.0.0.1 --port 4282", cwd: "out/experience-dashboard", url: "http://127.0.0.1:4282", reuseExistingServer: false },
  ],
});
