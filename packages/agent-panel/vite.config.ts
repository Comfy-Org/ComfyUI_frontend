import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Dev-only proxy for the live harness mode: REST and the /ws socket route to an
// ephemeral comfy-cloud test environment so the panel can be exercised against the
// real comfy-agent backend from localhost (browser CORS forbids calling it directly).
const liveProxyTarget =
  process.env.AGENT_PROXY_TARGET ?? 'https://pr-4432.testenvs.comfy.org'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: liveProxyTarget, changeOrigin: true },
      '/ws': { target: liveProxyTarget, changeOrigin: true, ws: true }
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts']
  }
})
