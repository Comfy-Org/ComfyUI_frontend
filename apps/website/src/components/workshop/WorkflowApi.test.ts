import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { h, markRaw } from 'vue'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import { OBJECT_URL_LIFETIME_MS } from '@/config/workshop-output-download'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import { workflowSnippetRequest } from '@/config/workshop-workflow-snippet'
import { formForWorkflow } from '@/config/workshop-workflow-definition'
import WorkflowApi from './WorkflowApi.vue'

const fixture = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(fixture, 'the catalogue no longer carries the fixture workflow')
const model = markRaw(fixture)

// What the page hands this tab: the form as it stands, which on a page nobody
// has touched is the workflow's own defaults.
const values = initialWorkshopPageState(model).values

describe('WorkflowApi', () => {
  it('does not conceal invalid current inputs behind stored code', () => {
    const invalidValues = Object.fromEntries(
      Object.keys(model.workflow.inputSchema.properties).map((name) => [
        name,
        Number.NaN
      ])
    )
    render(WorkflowApi, {
      props: {
        model: {
          ...model,
          catalogDetails: {
            locale: 'en',
            models: [],
            faqs: [],
            scriptCode: { python: 'STALE_MANUAL_CODE' }
          }
        },
        values: invalidValues
      }
    })
    expect(screen.queryByTestId('workflow-api-snippet')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Fill in the Playground inputs'
    )
    expect(screen.queryByText('STALE_MANUAL_CODE')).toBeNull()
  })
  it('can infer code from a complete graph without editable inputs', () => {
    if (!model.workflow.cloud) throw new Error('Missing fixture graph')
    const workflow = {
      ...model.workflow,
      inputs: {},
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
        additionalProperties: false as const
      },
      cloud: { ...model.workflow.cloud, inputBindings: {} }
    }
    render(WorkflowApi, {
      props: {
        model: {
          ...model,
          workflow,
          form: formForWorkflow(workflow),
          fields: [],
          examples: [],
          defaults: {},
          catalogDetails: {
            locale: 'en',
            models: [],
            faqs: [],
            runnable: false,
            scriptCode: { python: 'STALE_MANUAL_CODE' }
          }
        },
        values: {},
        downloadOnly: true
      }
    })
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      'from comfy_sdk import Comfy'
    )
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      Object.values(workflow.cloud.workflow)[0].class_type
    )
    expect(screen.getByTestId('workflow-api-snippet')).not.toHaveTextContent(
      'STALE_MANUAL_CODE'
    )
  })
  it('prefers inferred code over stale authored snippets', () => {
    render(WorkflowApi, {
      props: {
        model: {
          ...model,
          catalogDetails: {
            locale: 'en',
            models: [],
            faqs: [],
            runnable: false,
            scriptCode: { python: 'STALE_MANUAL_CODE' }
          }
        },
        values,
        downloadOnly: true
      }
    })
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      'from comfy_sdk import Comfy'
    )
    expect(screen.getByTestId('workflow-api-snippet')).not.toHaveTextContent(
      'STALE_MANUAL_CODE'
    )
  })
  it('offers only stored languages when inference is unavailable, without Cloud execution claims', () => {
    render(WorkflowApi, {
      props: {
        model: {
          ...model,
          workflow: { ...model.workflow, cloud: undefined },
          catalogDetails: {
            locale: 'en',
            models: [],
            faqs: [],
            scriptCode: {
              curl: 'curl --fail https://example.com/workflow.json'
            }
          }
        },
        values: {},
        downloadOnly: true
      }
    })
    expect(screen.getByRole('tab', { name: 'cURL' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.queryByRole('tab', { name: 'Python' })).toBeNull()
    expect(screen.getByTestId('workflow-api-snippet')).toHaveTextContent(
      'curl --fail'
    )
    expect(screen.queryByTestId('workflow-api-endpoint')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Download the API graph' })
    ).toBeNull()
    expect(screen.queryByTestId('workflow-api-steps')).toBeNull()
  })
  it('omits the blank download-only API section', () => {
    const { container } = render(WorkflowApi, {
      props: {
        model: { ...model, workflow: { ...model.workflow, cloud: undefined } },
        values: {},
        downloadOnly: true
      }
    })
    expect(container.querySelector('section')).toBeNull()
  })
  // A developer opening this tab wants the address before they want the
  // snippet, and it was only ever readable by picking it out of the cURL.
  it('names the address a cURL run is posted to', async () => {
    render(WorkflowApi, { props: { model, values } })

    await userEvent.setup().click(screen.getByRole('tab', { name: 'cURL' }))

    const endpoint = screen.getByTestId('workflow-api-endpoint')
    expect(endpoint).toHaveTextContent('POST')
    expect(endpoint).toHaveTextContent(`${WORKSHOP_CLOUD_BASE_URL}/api/prompt`)
  })

  it('reports the snippet language it copies and Get API key clicks', async () => {
    const { emitted } = render(WorkflowApi, { props: { model, values } })
    const visitor = userEvent.setup()

    await visitor.click(screen.getByRole('tab', { name: 'TypeScript' }))
    await visitor.click(screen.getByRole('button', { name: 'Copy snippet' }))
    const getKey = screen.getByRole('link', { name: 'Get API key' })
    getKey.addEventListener('click', (event) => event.preventDefault(), {
      once: true
    })
    await visitor.click(getKey)

    expect(emitted('copy')).toEqual([['typescript']])
    expect(emitted('getKey')).toEqual([[]])
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
      shows: ['COMFY_API_KEY', 'Uploaded by the code'],
      hides: ['/api/prompt', 'X-API-Key']
    },
    {
      tab: 'TypeScript',
      shows: ['COMFY_API_KEY', 'Uploaded by the code'],
      hides: ['/api/prompt', 'X-API-Key']
    },
    {
      tab: 'cURL',
      shows: [
        `POST ${WORKSHOP_CLOUD_BASE_URL}/api/prompt`,
        'X-API-Key + extra_data.api_key_comfy_org',
        'Uploaded before the call'
      ],
      hides: ['Uploaded by the code']
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

  it('shows the manual upload and polling steps only for cURL', async () => {
    render(WorkflowApi, { props: { model, values } })
    const visitor = userEvent.setup()

    expect(screen.queryByTestId('workflow-api-steps')).toBeNull()

    await visitor.click(screen.getByRole('tab', { name: 'cURL' }))
    expect(screen.getByTestId('workflow-api-steps')).toHaveTextContent(
      'POST /api/inputs/upload-url'
    )

    await visitor.click(screen.getByRole('tab', { name: 'TypeScript' }))
    expect(screen.queryByTestId('workflow-api-steps')).toBeNull()
  })

  describe('downloading the API graph', () => {
    it('hands over the same graph the snippet posts', async () => {
      const blobs: Blob[] = []
      vi.spyOn(URL, 'createObjectURL').mockImplementation((source) => {
        if (source instanceof Blob) blobs.push(source)
        return 'blob:graph'
      })
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      render({ setup: () => () => h(WorkflowApi, { model, values }) })

      await userEvent.click(
        screen.getByRole('button', { name: 'Download the API graph' })
      )

      expect(JSON.parse(await blobs[0].text())).toEqual(
        workflowSnippetRequest(model, values).prompt
      )
    })

    it('leaves the graph readable while the browser takes it', async () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:graph')
      const revoke = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => {})
      render({ setup: () => () => h(WorkflowApi, { model, values }) })

      await userEvent.click(
        screen.getByRole('button', { name: 'Download the API graph' })
      )
      expect(revoke).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(OBJECT_URL_LIFETIME_MS)
      expect(revoke).toHaveBeenCalledWith('blob:graph')
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
