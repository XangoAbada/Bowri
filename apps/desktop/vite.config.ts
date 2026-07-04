import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Nie obserwuj katalogu Rust/Tauri — cargo trzyma tam blokady na plikach
    // build (.exe), przez co watcher Vite wywala się z EBUSY podczas `tauri dev`.
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/shared/test/setup.ts"],
    css: true
  }
});
