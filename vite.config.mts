import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Proxy websocket requests to the server
      '/': {
        target: 'ws://127.0.0.1:8188',
        ws: true,
      }
    }
  }
});