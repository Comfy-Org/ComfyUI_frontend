import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { h, markRaw } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '../../config/workshop-env'
import { initialWorkshopPageState } from '../../config/workshop-page-state'
import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import { workflowSnippetRequest } from '../../config/workshop-workflow-snippet'
import WorkflowApi from './WorkflowApi.vue'

const fixture = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(fixture, 'the catalogue no longer carries the fixture workflow')
const model = markRaw(fixture)

// What the page hands this tab: the form as it stands, which on a page nobody
// has touched is the workflow's own defaults.
const values = initialWorkshopPageState(model).values

describe('WorkflowApi', () => {
  // A developer opening this tab wants the address before they want the
  // snippet, and it was only ever readable by picking it out of the cURL.
  it('names the address a cURL run is posted to', async () => {
    render(WorkflowApi, { props: { model, values } })

    await userEvent.setup().click(screen.getByRole('tab', { name: 'cURL' }))

    const endpoint = screen.getByTestId('workflow-api-endpoint')
    expect(endpoint).toHaveTextContent('POST')
    expect(endpoint).toHaveTextContent(`${WORKSHOP_CLOUD_BASE_URL}/api/prompt`)
  })

  it.for([
    { tab: 'Python', opening: '# Python 3.10+: pip install comfy-sdk' },
    { tab: 'TypeScript', opening: '// Node 22+: npm install @comfyorg/sdk' },
    { tab: 'cURL', opening: '# Replace YOUR_API_KEY' }
  ])('shows the $tab snippet on its tab', async ({ tab, opening }) => {
    render(WorkflowApi, { props: { model, values } })

    await userEvent.setup().click(screen.getByRole('tab', { name: tab }))

    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(
      screen.getByTestId('workflow-api-snippet').textContent.startsWith(opening)
    ).toBe(true)
  })

  it.for([
    {
      tab: 'Python',
      shows: [
        'Comfy(api_key=…) + run(workflow, api_key=…)',
        'client.assets.from_url(url)'
      ],
      hides: ['/api/prompt', 'X-API-Key']
    },
    {
      tab: 'TypeScript',
      shows: [
        'new Comfy({ apiKey }) + run(workflow, { apiKey })',
        'client.assets.fromUrl(url)'
      ],
      hides: ['/api/prompt', 'X-API-Key']
    },
    {
      tab: 'cURL',
      shows: [
        `POST ${WORKSHOP_CLOUD_BASE_URL}/api/prompt`,
        'X-API-Key + extra_data.api_key_comfy_org',
        'Uploaded before the call'
      ],
      hides: ['assets.from']
    }
  ])(
    'lists what the $tab code needs beside it',
    async ({ tab, shows, hides }) => {
      render(WorkflowApi, { props: { model, values } })

      await userEvent.setup().click(screen.getByRole('tab', { name: tab }))

      const facts = screen.getByTestId('api-facts')
      for (const text of shows) expect(facts).toHaveTextContent(text)
      for (const text of hides) expect(facts).not.toHaveTextContent(text)
    }
  )

  it('offers the key and the documentation', () => {
    render(WorkflowApi, { props: { model, values } })

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

    it('offers no graph when the workflow cannot be posted to Cloud', () => {
      render(WorkflowApi, {
        props: { model: { ...model, type: 'SERVERLESS' }, values }
      })

      expect(
        screen.queryByRole('button', { name: 'Download the API graph' })
      ).toBeNull()
    })
  })
})
