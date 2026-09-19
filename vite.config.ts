import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works from any path on Cloudflare Pages.
  base: "./",

  // Game content is served, not bundled. Editing content/chapters/ch01.json and
  // reloading is enough -- no rebuild, no touching engine code. See docs/CONTENT.md.
  publicDir: "content",

  build: {
    target: "es2020",
    outDir: "dist",
    chunkSizeWarningLimit: 1600
  },

  server: { port: 5173 }
});
