import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { captureWorkshopEvent } from '@/scripts/posthog'
import CatalogueTabs from './CatalogueTabs.vue'

vi.mock(import('@/scripts/posthog'))

describe('CatalogueTabs analytics', () => {
  it('reports a switch to another catalogue but not a click on the open one', async () => {
    const user = userEvent.setup()
    render(
      defineComponent({
        setup: () => () =>
          h(CatalogueTabs, { modelValue: 'models', links: true })
      })
    )

    await user.click(screen.getByTestId('catalogue-tab-models'))
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('catalogue-tab-workflows'))
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'hub_filter_changed',
      properties: {
        surface: 'models',
        filter: 'catalogue',
        value: 'workflows',
        previous_value: 'models'
      }
    })
  })
})
