import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  plugins: [
    react(),
    {
      // Injected for production builds only: the Vite dev client needs inline
      // bootstrap scripts that this policy intentionally blocks.
      name: 'roomfit-csp',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  // Relative asset URLs let the same build run from a web server and from
  // the Electron file:// bundle.
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // electron-builder writes large binaries here; watching them can crash
      // the dev server with EBUSY on Windows.
      ignored: ['**/release/**', '**/dist/**'],
    },
  },
  build: {
    target: 'es2020',
  },
});
