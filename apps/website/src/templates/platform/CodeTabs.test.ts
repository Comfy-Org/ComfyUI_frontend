import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { CodeTab } from './CodeTabs.vue'
import CodeTabs from './CodeTabs.vue'

const tabs: Record<string, CodeTab> = {
  short: { name: 'Short', lang: 'python', segments: ['hello()'] },
  tall: {
    name: 'Tall',
    lang: 'python',
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
    expect(screen.getByRole('tabpanel')).toHaveTextContent('hello()')

    await userEvent.click(screen.getByRole('tab', { name: 'Tall' }))

    expect(screen.getByRole('tabpanel')).toHaveTextContent('run("model-a")')
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('hello()')
  })

  it('switches panels from a dropdown when asked for one', async () => {
    const user = userEvent.setup()
    render(CodeTabs, { props: { tabs, label: 'Samples', picker: 'dropdown' } })

    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('hello()')

    await user.click(screen.getByRole('button', { name: 'Short' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Tall' }))

    expect(screen.getByRole('button', { name: 'Tall' })).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('run("model-a")')
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('hello()')
  })

  it('pins cycling segments to the selected index', async () => {
    render(CodeTabs, { props: { tabs, label: 'Samples', selectedIndex: 1 } })

    await userEvent.click(screen.getByRole('tab', { name: 'Tall' }))

    expect(screen.getByText('model-b')).toBeTruthy()
    expect(screen.queryByText('model-a')).toBeNull()
  })

  it('renders no copy button unless labels are given', () => {
    render(CodeTabs, { props: { tabs, label: 'Samples' } })

    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })

  it('copies the active sample with its cycling values filled in', async () => {
    const user = userEvent.setup()
    render(CodeTabs, {
      props: {
        tabs,
        label: 'Samples',
        copyLabel: 'Copy',
        copiedLabel: 'Copied'
      }
    })

    await user.click(screen.getByRole('tab', { name: 'Tall' }))
    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(await navigator.clipboard.readText()).toBe(
      'run("model-a")\nsecond\nthird'
    )
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(screen.queryByText('Copied')).toBeNull()
  })

  it('does not carry the copied state over to another tab', async () => {
    const user = userEvent.setup()
    render(CodeTabs, {
      props: {
        tabs,
        label: 'Samples',
        copyLabel: 'Copy',
        copiedLabel: 'Copied'
      }
    })

    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await user.click(screen.getByRole('tab', { name: 'Tall' }))

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
  })
})
