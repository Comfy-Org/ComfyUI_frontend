import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WorkflowDetails from './WorkflowDetails.vue'

const props = (overrides = {}) => ({
  author: 'ComfyUI',
  usage: 25423,
  produces: [{ media: 'video', count: 1 }],
  runsHere: false,
  added: '2026-08-02',
  ...overrides
})

describe('WorkflowDetails', () => {
  it('reads the facts the registry knows', () => {
    render(WorkflowDetails, { props: props() })

    const details = screen.getByTestId('workflow-details').textContent
    expect(details).toMatch(/by ComfyUI/)
    expect(details).toMatch(/25,423 runs/)
    expect(details).toMatch(/Video, 1 per run/)
    expect(details).toMatch(/Aug.*2026/)
  })

  // Where the model runs decides what the reader has to have, so the row says
  // Cloud for the workflows this page can run and a machine for the rest.
  it.for([
    [true, /Comfy Cloud/],
    [false, /your machine/]
  ] as const)('says where it runs', ([runsHere, shown]) => {
    render(WorkflowDetails, { props: props({ runsHere }) })

    expect(screen.getByTestId('workflow-details').textContent).toMatch(shown)
  })

  it('leaves out a run count the registry never recorded', () => {
    render(WorkflowDetails, { props: props({ usage: 0 }) })

    expect(screen.queryByTestId('workflow-usage')).toBeNull()
  })
})
