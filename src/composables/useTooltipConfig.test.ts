import { describe, expect, it } from 'vitest'

import { buildTooltipConfig } from './useTooltipConfig'

describe('buildTooltipConfig', () => {
  it.for([
    ['top', 'border-t-node-component-tooltip-border'],
    ['right', 'border-r-node-component-tooltip-border'],
    ['bottom', 'border-b-node-component-tooltip-border'],
    ['left', 'border-l-node-component-tooltip-border']
  ] as const)(
    'colours only the arrow edge facing a %s tooltip target',
    ([side, arrowEdgeClass]) => {
      const context = {
        top: false,
        right: false,
        bottom: false,
        left: false,
        [side]: true
      }
      const { class: arrowClass } = buildTooltipConfig('Hint').pt.arrow({
        context
      })

      expect(arrowClass).toBe(arrowEdgeClass)
    }
  )

  it('colours the right arrow edge when no side is set, matching PrimeVue’s default', () => {
    const { class: arrowClass } = buildTooltipConfig('Hint').pt.arrow({
      context: {}
    })

    expect(arrowClass).toBe('border-r-node-component-tooltip-border')
  })
})
