import path from "node:path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const base = mode === "pages" ? "/Recall/" : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
        workbox: {
          globPatterns: ["**/*.{js,mjs,css,html,json,pdf,svg,png,woff,woff2}"],
          // Don't cache KaTeX CSS from CDN - let browser handle it
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api/],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          runtimeCaching: [{
            urlPattern: /\/audio\/en-us-[a-f0-9]+\.wav$/,
            handler: "CacheFirst",
            options: { cacheName: "pet-audio-v1", rangeRequests: true, cacheableResponse: { statuses: [200] } },
          }],
        },
        manifest: {
          name: "PET词汇精读",
          short_name: "PET词汇",
          description: "面向 Cambridge B1 Preliminary for Schools 的本地优先词汇与精读工具。",
          theme_color: "#1479e8",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "any",
          scope: base,
          start_url: base,
          lang: "zh-CN",
          categories: ["education", "productivity"],
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}icons/icon-maskable-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    build: {
      target: "es2021",
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    optimizeDeps: {},
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
