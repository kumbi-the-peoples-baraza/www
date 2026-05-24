import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@pages": path.resolve(__dirname, "./src/components/pages"),
      "@layout": path.resolve(__dirname, "./src/components/layout"),
      "@forms": path.resolve(__dirname, "./src/components/forms"),
      "@cms": path.resolve(__dirname, "./src/components/cms"),
      "@ui": path.resolve(__dirname, "./src/components/ui"),
      "@notebooks": path.resolve(__dirname, "./src/features/notebooks"),
    },
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
