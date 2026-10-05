import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import ToastPanel from './ToastPanel.vue'

const PanelWithToggle = defineComponent({
  components: { ToastPanel },
  setup() {
    return { expanded: ref(false) }
  },
  template: `
    <ToastPanel v-model:expanded="expanded">
      <template #default="{ isExpanded }">
        <div data-testid="content">{{ isExpanded ? 'expanded' : 'collapsed' }}</div>
      </template>
      <template #footer="{ isExpanded, toggle }">
        <button @click="toggle">{{ isExpanded ? 'Collapse' : 'Expand' }}</button>
      </template>
    </ToastPanel>
  `
})

describe('ToastPanel', () => {
  it('announces politely and starts collapsed', () => {
    render(PanelWithToggle)

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByTestId('content')).toHaveTextContent('collapsed')
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
