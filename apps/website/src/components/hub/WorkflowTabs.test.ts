import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import WorkflowTabs from './WorkflowTabs.vue'

const mount = (runs: boolean) =>
  render(WorkflowTabs, {
    props: { runs },
    slots: {
      playground: () => h('p', 'the form'),
      details: () => h('p', 'how it is built')
    }
  })

describe('WorkflowTabs', () => {
  // The page opens on the thing to do, and how the workflow is built waits
  // behind its own tab rather than sitting under the form.
  it('opens on the playground and keeps the details behind their tab', async () => {
    mount(true)

    expect(screen.getByText('the form')).toBeTruthy()
    expect(screen.queryByText('how it is built')).toBeNull()

    await userEvent.setup().click(screen.getByTestId('tab-details'))

    expect(screen.queryByText('the form')).toBeNull()
    expect(screen.getByText('how it is built')).toBeTruthy()
  })

  // A workflow nothing shared can run has no playground to offer. An empty
  // tab would still promise one, so the tab goes and the page opens on the
  // half that has something to say.
  it('drops the playground tab when nothing can run it', () => {
    mount(false)

    expect(screen.queryByTestId('tab-playground')).toBeNull()
    expect(screen.getByTestId('tab-details')).toBeTruthy()
    expect(screen.getByText('how it is built')).toBeTruthy()
  })
})
