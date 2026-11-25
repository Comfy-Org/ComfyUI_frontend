import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { transformWithOxc } from 'vite'
import type { Plugin } from 'vite'

const PUBLISHED_FILE = 'comfy/api/v4.js'
const sourcePath = () =>
  fileURLToPath(
    new URL('../../src/platform/nodeApi/v4/publishedModule.ts', import.meta.url)
  )

/** Serves the V4 node API module at `/comfy/api/v4.js` in development, and emits it there, outside the app bundle, in a build. */
export function publishedNodeApiPlugin(): Plugin[] {
  return [
    {
      name: 'comfy-published-node-api:serve',
      apply: 'serve',
      enforce: 'pre',
      resolveId(id) {
        return id === `/${PUBLISHED_FILE}` ? sourcePath() : null
      }
    },
    {
      name: 'comfy-published-node-api:build',
      apply: 'build',
      async generateBundle() {
        const source = sourcePath()
        const { code } = await transformWithOxc(
          await readFile(source, 'utf8'),
          source
        )
        this.emitFile({ type: 'asset', fileName: PUBLISHED_FILE, source: code })
      }
    }
  ]
}
