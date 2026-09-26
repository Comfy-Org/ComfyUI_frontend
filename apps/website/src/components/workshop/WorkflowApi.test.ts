import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowApi from './WorkflowApi.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')

// What the page hands this tab: the form as it stands, which on a page nobody
// has touched is the workflow's own defaults.
const values = initialWorkshopPageState(model).values

describe('WorkflowApi', () => {
  // A developer opening this tab wants the address before they want the
  // snippet, and it was only ever readable by picking it out of the cURL.
  it('names the address a run is posted to', () => {
    render(WorkflowApi, { props: { model, values } })

    const endpoint = screen.getByTestId('workflow-api-endpoint')
    expect(endpoint).toHaveTextContent('POST')
    expect(endpoint).toHaveTextContent(`${WORKSHOP_CLOUD_BASE_URL}/api/prompt`)
  })

  it('offers the key and the documentation', () => {
    render(WorkflowApi, { props: { model, values } })

    expect(
      screen
        .getByRole('link', { name: 'API documentation' })
        .getAttribute('href')
    ).toBe('https://docs.comfy.org/development/cloud/overview#quick-start')
    expect(screen.getByRole('link', { name: /API key/i })).toBeTruthy()
  })
})
