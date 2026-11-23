/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// One id per build: embedded in the app and written to version.json, so open devices can
// notice a newer deployment and offer a reload (all devices must run the same version).
const BUILD_ID = new Date().toISOString();

const versionFile = (): Plugin => ({
  name: 'darts-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

// base: './' + HashRouter => every route and refresh works on GitHub Pages (any repo sub-path).
export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [react(), tailwindcss(), versionFile()],
  server: { host: true, port: 5173 },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
