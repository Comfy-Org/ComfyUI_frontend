import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { previewScene } from '../../lib/hub/run-preview'
import { RUN_SCENES } from '../../lib/hub/run-scenes'
import WorkflowRunStates from './WorkflowRunStates.vue'

const EXAMPLES = { cloud: 'a-cloud-one', endpoint: 'an-endpoint-one' }

const open = async () => {
  render(WorkflowRunStates, { props: { examples: EXAMPLES, hasPanel: true } })
  await nextTick()
  await userEvent
    .setup()
    .click(screen.getByTestId('workflow-run-states-toggle'))
}

afterEach(() => {
  previewScene.value = undefined
})

describe('WorkflowRunStates', () => {
  // It is a tool, not a panel: it waits closed in the corner until asked.
  it('shows nothing but its own handle until it is opened', async () => {
    render(WorkflowRunStates, { props: { examples: EXAMPLES, hasPanel: true } })
    await nextTick()

    expect(screen.getByTestId('workflow-run-states-toggle')).toBeTruthy()
    expect(screen.queryByTestId('workflow-run-states-scene')).toBeNull()
  })

  // Which kind a workflow is decides how its page is built, so the tool walks
  // to a page that is that kind rather than pretending one is another.
  it('offers only the kinds the catalogue actually holds', async () => {
    await open()
    const kinds = within(screen.getByTestId('workflow-run-states-kind'))

    expect(
      kinds.getByRole('option', { name: 'Runs on Cloud' }).getAttribute('value')
    ).toBe('/hub/workflow/a-cloud-one/')
    expect(
      kinds
        .getByRole('option', { name: 'Needs a server of its own' })
        .getAttribute('value')
    ).toBe('/hub/workflow/an-endpoint-one/')
    expect(kinds.queryByRole('option', { name: /Runs here/ })).toBeNull()
  })

  it('hands a chosen state to the panel, and takes it back', async () => {
    await open()
    const user = userEvent.setup()
    const states = screen.getByTestId('workflow-run-states-scene')

    await user.selectOptions(states, RUN_SCENES[2].name)
    expect(previewScene.value).toBe(RUN_SCENES[2])

    await user.selectOptions(states, '')
    expect(previewScene.value).toBeUndefined()
  })
})
