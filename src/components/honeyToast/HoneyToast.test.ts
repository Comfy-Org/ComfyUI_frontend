import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import HoneyToast from './HoneyToast.vue'

describe('HoneyToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function renderComponent(
    props: { visible: boolean; expanded?: boolean } = { visible: true }
  ) {
    const user = userEvent.setup()
    const { unmount } = render(HoneyToast, {
      props,
      slots: {
        default: (slotProps: { isExpanded: boolean }) =>
          h(
            'div',
            { 'data-testid': 'content' },
            slotProps.isExpanded ? 'expanded' : 'collapsed'
          ),
        footer: (slotProps: { isExpanded: boolean; toggle: () => void }) =>
          h(
            'button',
            {
              'data-testid': 'toggle-btn',
              onClick: slotProps.toggle
            },
            slotProps.isExpanded ? 'Collapse' : 'Expand'
          )
      },
      container: document.body.appendChild(document.createElement('div'))
    })
    return { user, unmount }
  }

  it('renders when visible is true', async () => {
    const { unmount } = renderComponent({ visible: true })
    await nextTick()

    expect(screen.getByRole('status')).toBeInTheDocument()

    unmount()
  })

  it('does not render when visible is false', async () => {
    const { unmount } = renderComponent({ visible: false })
    await nextTick()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    unmount()
  })

  it('passes is-expanded=false to slots by default', async () => {
    const { unmount } = renderComponent({ visible: true })
    await nextTick()

    expect(screen.getByTestId('content')).toHaveTextContent('collapsed')

    unmount()
  })

  it('has aria-live="polite" for accessibility', async () => {
    const { unmount } = renderComponent({ visible: true })
    await nextTick()

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    unmount()
  })

  it('supports v-model:expanded with reactive parent state', async () => {
    const TestWrapper = defineComponent({
      components: { HoneyToast },
      setup() {
        const expanded = ref(false)
        return { expanded }
      },
      template: `
        <HoneyToast :visible="true" v-model:expanded="expanded">
          <template #default="slotProps">
            <div data-testid="content">{{ slotProps.isExpanded ? 'expanded' : 'collapsed' }}</div>
          </template>
          <template #footer="slotProps">
            <button data-testid="toggle-btn" @click="slotProps.toggle">
              {{ slotProps.isExpanded ? 'Collapse' : 'Expand' }}
            </button>
          </template>
        </HoneyToast>
      `
    })

    const user = userEvent.setup()
    const { unmount } = render(TestWrapper, {
      container: document.body.appendChild(document.createElement('div'))
    })
    await nextTick()

    expect(screen.getByTestId('content')).toHaveTextContent('collapsed')
    expect(screen.getByTestId('toggle-btn')).toHaveTextContent('Expand')

    await user.click(screen.getByTestId('toggle-btn'))
    await nextTick()

    expect(screen.getByTestId('content')).toHaveTextContent('expanded')
    expect(screen.getByTestId('toggle-btn')).toHaveTextContent('Collapse')

    unmount()
  })
})
