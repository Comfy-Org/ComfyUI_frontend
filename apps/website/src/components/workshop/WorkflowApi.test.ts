import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import { workflowSnippetRequest } from '../../config/workshop-workflow-snippet'
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

    const facts = screen.getByTestId('api-facts')
    expect(facts).toHaveTextContent('X-API-Key')
    expect(facts).toHaveTextContent('extra_data.api_key_comfy_org')
    expect(
      screen
        .getByRole('link', { name: 'API documentation' })
        .getAttribute('href')
    ).toBe('https://docs.comfy.org/development/cloud/overview#quick-start')
    expect(screen.getByRole('link', { name: /API key/i })).toBeTruthy()
  })
  describe('downloading the API graph', () => {
    const { createObjectURL, revokeObjectURL } = URL
    afterEach(() => {
      URL.createObjectURL = createObjectURL
      URL.revokeObjectURL = revokeObjectURL
    })

    it('hands over the same graph the snippet posts', async () => {
      const blobs: Blob[] = []
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blobs.push(blob)
        return 'blob:graph'
      })
      URL.revokeObjectURL = vi.fn()
      render({ setup: () => () => h(WorkflowApi, { model, values }) })

      await userEvent.click(
        screen.getByRole('button', { name: 'Download the API graph' })
      )

      expect(JSON.parse(await blobs[0].text())).toEqual(
        workflowSnippetRequest(model, values).prompt
      )
    })
  })
})
