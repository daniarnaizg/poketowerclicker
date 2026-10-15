import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'src': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000
  },
  test: {
    // Vitest externalizes deps by default, which bypasses the react->preact
    // aliases above; inline zustand so its Preact-compat entry resolves.
    server: { deps: { inline: ['zustand'] } }
  }
});
