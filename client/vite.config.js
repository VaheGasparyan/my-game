import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  resolve: { alias: { '@shared': shared } },
  server: { fs: { allow: ['..'] } },
});
