import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import { buildTooltipConfig } from './useTooltipConfig'

describe('buildTooltipConfig', () => {
  it.for(['top', 'right', 'bottom', 'left', undefined] as const)(
    'keeps the tooltip arrow themed for side %s',
    async (side) => {
      const user = userEvent.setup()
      render(Tooltip, {
        props: { config: buildTooltipConfig('Hint'), side },
        slots: { default: '<button>Trigger</button>' }
      })

      await user.hover(screen.getByRole('button', { name: 'Trigger' }))
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Hint')
      const positioner = screen.getByTestId('tooltip-positioner')
      const arrow = within(positioner).getByTestId('tooltip-arrow')

      expect(positioner).toHaveClass(
        'bg-base-background',
        'border-border-default'
      )
      expect(arrow).toHaveClass('fill-base-background', 'stroke-border-default')
    }
  )
})
