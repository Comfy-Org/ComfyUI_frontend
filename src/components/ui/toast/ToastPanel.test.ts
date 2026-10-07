import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import ToastPanel from './ToastPanel.vue'

const PanelWithToggle = defineComponent({
  components: { ToastPanel },
  props: { visible: { type: Boolean, default: true } },
  setup() {
    return { expanded: ref(false) }
  },
  template: `
    <ToastPanel v-model:expanded="expanded" :visible>
      <div data-testid="content">{{ expanded ? 'expanded' : 'collapsed' }}</div>
      <template #footer="{ toggle }">
        <button @click="toggle">{{ expanded ? 'Collapse' : 'Expand' }}</button>
      </template>
    </ToastPanel>
  `
})

describe('ToastPanel', () => {
  it('renders only while visible and is not a live region', async () => {
    const { rerender } = render(PanelWithToggle, { props: { visible: false } })
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()

    await rerender({ visible: true })

    expect(screen.getByTestId('content')).toHaveTextContent('collapsed')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('expands and collapses from the footer toggle', async () => {
    const user = userEvent.setup()
    render(PanelWithToggle)

    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(screen.getByTestId('content')).toHaveTextContent('expanded')

    await user.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.getByTestId('content')).toHaveTextContent('collapsed')
  })
})
