import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createStore } from './server/store.js';
import { createApiHandler } from './server/api.js';

function storeApi() {
  let db;
  const mount = (server) => {
    db ??= createStore();
    server.middlewares.use(createApiHandler(db));
  };
  return { name: 'atelier-api', configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig({
  plugins: [react(), storeApi()],
  server: {
    port: 5173,
    open: false
  }
});
