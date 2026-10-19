import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifestFilename: 'manifest.json',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'BinHub',
        short_name: 'BinHub',
        description:
          'Note, todo, bookmark, calendario e note vocali. Offline-first, sul tuo dispositivo.',
        lang: 'it',
        start_url: '/#/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#07100e',
        background_color: '#07100e',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Nuova nota', url: '/#/notes?new=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Nuovo todo', url: '/#/todos?new=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Nuovo evento', url: '/#/calendar?new=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
