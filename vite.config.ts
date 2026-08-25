import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/cleaning-system/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "build",
    sourcemap: false,
    // Spreadsheet/PDF exporters are lazy chunks and load only when requested.
    chunkSizeWarningLimit: 1000,
  },
});
