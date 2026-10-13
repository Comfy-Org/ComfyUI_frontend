import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'

import TransformPane from './TransformPane.vue'

const NodeTooltip = defineComponent({
  components: { Tooltip, TooltipContent, TooltipTrigger },
  props: { label: { type: String, required: true } },
  template: `
    <Tooltip>
      <TooltipTrigger as-child><button>{{ label }}</button></TooltipTrigger>
      <TooltipContent>{{ label }} tooltip</TooltipContent>
    </Tooltip>
  `
})

describe('TransformPane', () => {
  it('has ph-no-capture class to exclude from PostHog session recording', () => {
    render(TransformPane)
    expect(screen.getByTestId('transform-pane').classList).toContain(
      'ph-no-capture'
    )
  })

  it('waits the node tooltip delay before every node tooltip', async () => {
    vi.useFakeTimers()
    vi.spyOn(useSettingStore(), 'get').mockImplementation(
      <K extends keyof Settings>(key: K): Settings[K] =>
        (key === 'LiteGraph.Node.TooltipDelay'
          ? 1000
          : undefined) as Settings[K]
    )
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(TransformPane, {
      slots: {
        default: () => [
          h(NodeTooltip, { label: 'Title' }),
          h(NodeTooltip, { label: 'Slot' })
        ]
      }
    })

    await user.hover(screen.getByRole('button', { name: 'Title' }))
    await vi.advanceTimersByTimeAsync(900)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(100)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Title tooltip')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button', { name: 'Slot' }))
    await vi.advanceTimersByTimeAsync(900)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(100)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Slot tooltip')
  })
})
