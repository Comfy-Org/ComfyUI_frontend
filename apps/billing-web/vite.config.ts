import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/** The same commit resolution as the Cloud app's build, so RUM versions line up. */
function frontendCommit(): string {
  if (process.env.FRONTEND_COMMIT_HASH) return process.env.FRONTEND_COMMIT_HASH
  try {
    return execSync('git rev-parse HEAD', { timeout: 5000, windowsHide: true })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: {
    __BILLING_WEB_COMMIT__: JSON.stringify(frontendCommit())
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url))
      },
      {
        find: /^\/fonts\//,
        replacement: fileURLToPath(
          new URL('../../public/fonts/', import.meta.url)
        )
      }
    ]
  }
})
