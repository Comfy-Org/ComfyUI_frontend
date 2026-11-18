import '@testing-library/jest-dom/vitest'
import { createRequire } from 'node:module'
import { TooltipProvider } from 'reka-ui'
import { shallowReactive } from 'vue'
import type { Plugin } from 'vue'

import { appTooltipProviderDefaults } from '@comfyorg/design-system/lib/tooltip/tooltipConfig'

const requireFromTestingLibrary = createRequire(
  createRequire(import.meta.url).resolve('@testing-library/vue')
)
const { config }: { config: { global: { plugins: Plugin[] } } } =
  requireFromTestingLibrary('@vue/test-utils')

const testTooltipProviderProps = shallowReactive({
  ...appTooltipProviderDefaults,
  delayDuration: 0,
  skipDelayDuration: 300,
  disableClosingTrigger: undefined,
  disabled: undefined,
  content: undefined
})

const appShellTooltipProvider: Plugin = {
  install(app) {
    const root = app._component
    if (typeof root === 'function' || !root.setup) return
    const setupRoot = root.setup
    root.setup = (props, ctx) => {
      TooltipProvider.setup?.(testTooltipProviderProps, ctx)
      return setupRoot(props, ctx)
    }
  }
}
config.global.plugins.push(appShellTooltipProvider)
