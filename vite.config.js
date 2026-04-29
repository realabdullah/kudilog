import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",

      // All static assets that should be pre-cached by the service worker
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "icons/apple-touch-icon.png",
        "icons/apple-touch-icon-*.png",
        "icons/favicon-*.png",
        "icons/icon-*.png",
      ],

      manifest: {
        name: "KudiLog – Personal Budget Tracker",
        short_name: "KudiLog",
        description:
          "Fast, local-first personal monthly budgeting. Log expenses in seconds, own your data.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        categories: ["finance", "productivity", "utilities"],

        icons: [
          // ── Small / launcher sizes ──────────────────────────────────────
          {
            src: "icons/icon-48.png",
            sizes: "48x48",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-72.png",
            sizes: "72x72",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-96.png",
            sizes: "96x96",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-144.png",
            sizes: "144x144",
            type: "image/png",
            purpose: "any",
          },

          // ── Standard PWA sizes ───────────────────────────────────────────
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-256.png",
            sizes: "256x256",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },

          // ── Maskable (Android adaptive icon) ────────────────────────────
          // Separate entry required — do NOT combine "any maskable" in one entry
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },

          // ── High-res / app store quality ─────────────────────────────────
          {
            src: "icons/icon-1024.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any",
          },
        ],

        // ── Screenshots (optional, enhances install prompt on Android) ───
        // screenshots: [],

        // ── Related apps (optional) ──────────────────────────────────────
        // prefer_related_applications: false,
      },

      workbox: {
        // Cache all key static asset types
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webp}"],

        // Don't cache the service worker itself or workbox files
        globIgnores: ["**/sw.js", "**/workbox-*.js"],

        // ── Runtime caching ───────────────────────────────────────────────
        runtimeCaching: [
          // Google Fonts (if ever added)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Clean up outdated caches on activation
        cleanupOutdatedCaches: true,

        // Skip waiting so new SW activates immediately
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
});
