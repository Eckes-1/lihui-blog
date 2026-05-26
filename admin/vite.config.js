import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/admin/',
  plugins: [tailwindcss(), svelte()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3001',
      '/blog': 'http://localhost:3001',
      '/_astro': 'http://localhost:3001'
    },
    hmr: {
      port: 5174,
      clientPort: 443,
      protocol: 'wss',
    },
  },
  resolve: {
    alias: { '$lib': '/src/lib' }
  }
})
