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
  assetsInclude: ["**/*.md"],
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: {
    // Aggressive minification — esbuild is faster than terser and already in Vite
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor chunks for long-term caching (hashed filenames → immutable)
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) return "vendor-react";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-tiptap";
            if (id.includes("@radix-ui") || id.includes("radix-ui")) return "vendor-radix";
            if (id.includes("framer-motion")) return "vendor-motion";
            return "vendor";
          }
        },
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  esbuild: {
    // Drop console/debugger in production builds
    drop: ["console", "debugger"],
    legalComments: "none",
  },
});
