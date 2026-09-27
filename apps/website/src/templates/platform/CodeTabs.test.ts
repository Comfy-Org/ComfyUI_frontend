// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import CodeTabs from './CodeTabs.vue'

const tabs = {
  short: { name: 'Short', segments: ['hello()'] },
  tall: {
    name: 'Tall',
    segments: [
      'run("',
      { values: ['model-a', 'model-b'], highlight: true },
      '")\nsecond\nthird'
    ]
  }
}

describe('CodeTabs', () => {
  it('shows the first tab and switches panels on click', async () => {
    render(CodeTabs, { props: { tabs, label: 'Samples' } })

    expect(screen.getByRole('tablist', { name: 'Samples' })).toBeTruthy()
    expect(screen.getByText('hello()')).toBeTruthy()

    await userEvent.click(screen.getByRole('tab', { name: 'Tall' }))

    expect(screen.getByText('model-a')).toBeTruthy()
    expect(screen.queryByText('hello()')).toBeNull()
  })
})
