import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowHowItWorks from './WorkflowHowItWorks.vue'

const props = (overrides = {}) => ({
  brings: [],
  models: [],
  produces: [{ media: 'image', count: 1 }],
  ...overrides
})

describe('WorkflowHowItWorks', () => {
  // A graph that loads nothing off disk still takes the words you type, and
  // an empty "You bring" would read as a graph that takes nothing at all.
  it('says a prompt is what you bring when the graph loads nothing', () => {
    render(WorkflowHowItWorks, { props: props() })

    expect(screen.getByTestId('workflow-brings').textContent).toMatch(
      /Just a prompt/
    )
  })

  it.for([
    [1, /Image.*1 per run/s],
    [3, /Image.*3 per run/s]
  ] as const)('counts what it loads per run', ([count, shown]) => {
    render(WorkflowHowItWorks, {
      props: props({ brings: [{ media: 'image', count }] })
    })

    expect(screen.getByTestId('workflow-brings').textContent).toMatch(shown)
  })

  it('names what it produces and how much of it', () => {
    render(WorkflowHowItWorks, {
      props: props({ produces: [{ media: 'video', count: 2 }] })
    })

    expect(screen.getByTestId('workflow-outputs').textContent).toMatch(
      /Video.*2 per run/s
    )
  })

  // A name the catalogue carries opens; one it does not stays a name.
  it.for([
    [{ name: 'Wan 2.2', model: { href: '/playground/model/wan/' } }, true],
    [{ name: 'Unknown', model: undefined }, false]
  ] as const)(
    'links a model only where the catalogue has it',
    ([ref, linked]) => {
      render(WorkflowHowItWorks, { props: props({ models: [ref] }) })

      expect(screen.queryByRole('link', { name: ref.name }) !== null).toBe(
        linked
      )
      expect(screen.queryByTestId('workflow-model-unlinked') === null).toBe(
        linked
      )
    }
  )

  it('leaves out the models row when the workflow names none', () => {
    render(WorkflowHowItWorks, { props: props() })

    expect(screen.queryByTestId('workflow-runs-on')).toBeNull()
  })
})
