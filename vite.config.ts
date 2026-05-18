import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.json";

export default defineConfig({
  base: "./",
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        dashboard: "src/dashboard.html",
        options: "src/options.html",
        popup: "src/popup.html",
        offscreen: "src/offscreen.html",
      },
    },
  },
});
