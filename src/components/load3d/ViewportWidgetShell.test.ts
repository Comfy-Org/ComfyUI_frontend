import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import ViewportWidgetShell from './ViewportWidgetShell.vue'

type ShellInstance = InstanceType<typeof ViewportWidgetShell>

function renderShell(withBottom: boolean) {
  const shellRef = ref<ShellInstance | null>(null)
  const events: string[] = []
  const Harness = defineComponent({
    components: { ViewportWidgetShell },
    setup: () => ({ shellRef, events, withBottom }),
    template: `
      <ViewportWidgetShell
        ref="shellRef"
        bottom-class="h-12"
        @mouseenter="events.push('enter')"
        @mouseleave="events.push('leave')"
      >
        <template #top><button type="button">Top action</button></template>
        <template v-if="withBottom" #bottom><span>Bottom content</span></template>
      </ViewportWidgetShell>
    `
  })
  render(Harness)
  return { shellRef, events }
}

describe('ViewportWidgetShell', () => {
  it('exposes the viewport container and toolbar and relays hover events', async () => {
    const { shellRef, events } = renderShell(true)
    const user = userEvent.setup()

    const container = shellRef.value!.container!
    const toolbar = shellRef.value!.toolbar!
    expect(container.dataset.captureWheel).toBe('true')
    expect(toolbar).toContainElement(
      screen.getByRole('button', { name: 'Top action' })
    )

    await user.hover(container)
    await user.unhover(container)
    expect(events).toEqual(['enter', 'leave'])
  })

  it('renders the bottom bar only when the slot is provided', () => {
    renderShell(false)
    expect(screen.queryByText('Bottom content')).toBeNull()

    renderShell(true)
    expect(screen.getByText('Bottom content')).toBeInTheDocument()
  })
})
