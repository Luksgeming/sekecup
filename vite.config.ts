import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Tauri expects a fixed port and fails loudly if it is taken
  server: { port: 5173, strictPort: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // registered from main.ts, and only outside the desktop app
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'REA',
        short_name: 'REA',
        description: 'Gambar denah rumah dan lihat dalam 3D',
        lang: 'id',
        display: 'standalone',
        background_color: '#f7f5f0',
        theme_color: '#2b2a27',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // furniture models are big, so they are cached the first time they are used instead of up front
        runtimeCaching: [
          {
            urlPattern: /\/models\/.*\.glb$/,
            // serve the cached copy at once, and refresh it in the background after a release
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'rea-models', expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
});
