// @vitest-environment happy-dom
import { LayoutGrid, Video } from '@lucide/vue'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import HubFilterTabs from './HubFilterTabs.vue'

const items = [
  { value: 'all', label: 'ALL', icon: LayoutGrid },
  { value: 'video', label: 'Video', icon: Video }
]

function renderFilterTabs() {
  return render({
    components: { HubFilterTabs },
    setup() {
      const selection = ref('all')
      return { items, selection }
    },
    template:
      '<HubFilterTabs v-model="selection" label="Model categories" :items="items" />'
  })
}

describe('HubFilterTabs', () => {
  it('selects one website filter tab at a time', async () => {
    renderFilterTabs()

    await userEvent.click(screen.getByRole('tab', { name: 'Video' }))

    expect(
      screen.getByRole('tab', { name: 'Video' }).getAttribute('aria-selected')
    ).toBe('true')
    expect(
      screen.getByRole('tab', { name: 'ALL' }).getAttribute('aria-selected')
    ).toBe('false')
  })
})
