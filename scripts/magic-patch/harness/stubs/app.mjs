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
  ui: { dialog: { show: () => {} }, settings: { addSetting: () => {} } },
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

export default app
