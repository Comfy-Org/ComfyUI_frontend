import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'

import PanelHeader from './PanelHeader.vue'

const tooltipDirectiveStub = {
  mounted: vi.fn(),
  updated: vi.fn()
}

function mount(isMaximized = false) {
  return render(PanelHeader, {
    props: { isMaximized },
    global: {
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
    }
  })
}

describe('PanelHeader', () => {
  it.for([
    [false, 'New chat'],
    [false, 'Maximize panel'],
    [true, 'Minimize panel'],
    [false, 'Close']
  ] as const)(
    'shows the %s panel tooltip for %s',
    ([isMaximized, label]) => {
      const spy = vi.spyOn(tooltipConfig, 'buildAgentTooltipConfig')

      mount(isMaximized)

      expect(spy).toHaveBeenCalledWith(label)
    }
  )
})
