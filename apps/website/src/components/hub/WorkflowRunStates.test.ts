import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { previewScene } from '../../lib/hub/run-preview'
import { RUN_SCENES } from '../../lib/hub/run-scenes'
import WorkflowRunStates from './WorkflowRunStates.vue'

const EXAMPLES = { cloud: 'a-cloud-one', endpoint: 'an-endpoint-one' }

const openAt = async (search: string) => {
  window.history.replaceState({}, '', `/hub/workflow/x/${search}`)
  render(WorkflowRunStates, { props: { examples: EXAMPLES, hasPanel: true } })
  await nextTick()
  const toggle = screen.queryByTestId('workflow-run-states-toggle')
  if (toggle) await userEvent.setup().click(toggle)
  return toggle
}

afterEach(() => {
  previewScene.value = undefined
})

describe('WorkflowRunStates', () => {
  // A visitor must never meet it. Asking for it in the address is the whole
  // of what turns it on.
  it('stays out of the way until the address asks for it', async () => {
    expect(await openAt('')).toBeNull()
  })

  // Which kind a workflow is decides how its page is built, so the tool walks
  // to a page that is that kind rather than pretending one is another.
  it('offers only the kinds the catalogue actually holds', async () => {
    await openAt('?states')
    const kinds = within(screen.getByTestId('workflow-run-states-kind'))

    expect(
      kinds.getByRole('option', { name: 'Runs on Cloud' }).getAttribute('value')
    ).toBe('/hub/workflow/a-cloud-one/?states')
    expect(
      kinds
        .getByRole('option', { name: 'Needs a server of its own' })
        .getAttribute('value')
    ).toBe('/hub/workflow/an-endpoint-one/?states')
    expect(kinds.queryByRole('option', { name: /Runs here/ })).toBeNull()
  })

  it('hands a chosen state to the panel, and takes it back', async () => {
    await openAt('?states')
    const user = userEvent.setup()
    const states = screen.getByTestId('workflow-run-states-scene')

    await user.selectOptions(states, RUN_SCENES[2].name)
    expect(previewScene.value).toBe(RUN_SCENES[2])

    await user.selectOptions(states, '')
    expect(previewScene.value).toBeUndefined()
  })
})
