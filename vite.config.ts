import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app shows its own version (sync window, title-bar tooltip) from package.json,
// so the number can never drift from what was built and released.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  define: { __APP_VERSION__: JSON.stringify(version) },
});
