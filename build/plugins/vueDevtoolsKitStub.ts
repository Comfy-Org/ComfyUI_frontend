import path from 'path'
import type { Plugin } from 'vite'

const STUB_PATH = path.resolve(
  import.meta.dirname,
  '../stubs/vueDevtoolsKit.ts'
)

/** Resolves `@vue/devtools-kit` to an inert stub wherever Vue DevTools cannot run. */
export function vueDevtoolsKitStub(devtoolsPluginInstalled: boolean): Plugin {
  return {
    name: 'comfy:vue-devtools-kit-stub',
    config(_config, { command }) {
      if (command === 'serve' && devtoolsPluginInstalled) return
      return {
        resolve: {
          alias: [{ find: /^@vue\/devtools-kit$/, replacement: STUB_PATH }]
        }
      }
    }
  }
}
