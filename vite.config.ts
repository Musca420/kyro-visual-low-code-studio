import react from "@vitejs/plugin-react";
import { liveBridge } from "./server/liveBridge";

export default {
  base: "./",
  plugins: [react(), liveBridge()],
  server: { watch: { ignored: ["**/.kyro/**", "**/android-builds/**"] } },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
};
