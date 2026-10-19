import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const normalizedBase = (process.env.VITE_BASE ?? '/').trim().replace(/^\/+|\/+$/g, '')
const base = normalizedBase ? `/${normalizedBase}/` : '/'

export default defineConfig({
  base,
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
        start_url: `${base}#/`,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#07100e',
        background_color: '#07100e',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}icons/maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Nuova nota', url: `${base}#/notes?new=1`, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }] },
          { name: 'Nuovo todo', url: `${base}#/todos?new=1`, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }] },
          { name: 'Nuovo evento', url: `${base}#/calendar?new=1`, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        navigateFallback: `${base}index.html`,
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
