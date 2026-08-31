/** `scripts/app.js` — the module 5,685 import sites reach for. */
import { registry } from './registry.mjs'

export const app = {
  get graph() {
    return registry.graph
  },
  canvas: {
    setDirty: () => {},
    draw: () => {},
    getCanvasWindow: () => globalThis
  },
  ui: {
    dialog: { show: () => {} },
    settings: {
      addSetting: () => {},
      // Packs read their own settings during registration. Returning the
      // caller's default keeps them on their documented path; returning
      // undefined sent them down error branches instead.
      getSettingValue: (_id, fallback) => fallback,
      setSettingValue: () => {}
    }
  },
  extensionManager: { registerSidebarTab: () => {}, toast: { add: () => {} } },
  registerExtension(extension) {
    registry.extensions.push(extension)
  },
  queuePrompt: async () => ({}),
  graphToPrompt: async () => ({ workflow: {}, output: {} }),
  loadGraphData: () => {},
  nodeOutputs: {},
  lastNodeErrors: null
}
