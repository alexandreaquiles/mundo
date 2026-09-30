import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

/** Carimbo do build, para dar para ver em que versão o aparelho está. */
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      // A versão nova assume assim que chega e a página recarrega sozinha,
      // mesmo no meio de uma partida — que então se perde. É a troca escolhida:
      // o modo 'prompt', que espera um momento seguro, depende de alguém mandar
      // ativar, e na prática muita gente ficava parada na versão antiga.
      registerType: 'autoUpdate',
      // o registro vem de `virtual:pwa-register/react`; 'auto' registraria de novo
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Mundo — Bandeiras e Capitais',
        short_name: 'Mundo',
        description: 'Adivinhe a bandeira, a capital e o lugar no mapa. Quinze rodadas, 195 países.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        categories: ['games', 'education'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // bandeiras, os dois mapas e o app shell entram todos no precache:
        // o jogo inteiro tem que rodar offline
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // o ranking pode aparecer velho quando não há rede; o jogo nunca depende dele
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mundo-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
