import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import ReshootDisclosure from './ReshootDisclosure.vue'

describe('ReshootDisclosure', () => {
  it.for([
    { disabled: false, tabindex: null, opens: true },
    { disabled: true, tabindex: '-1', opens: false }
  ])(
    'keeps a disclosure disabled: $disabled out of reach of keyboard and pointer',
    ({ disabled, tabindex, opens }) => {
      render(ReshootDisclosure, {
        props: { label: 'Move', disabled },
        slots: { default: 'Move controls' }
      })
      const summary = screen.getByText('Move')

      expect(summary.getAttribute('tabindex')).toBe(tabindex)
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      summary.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(!opens)
    }
  )
})
