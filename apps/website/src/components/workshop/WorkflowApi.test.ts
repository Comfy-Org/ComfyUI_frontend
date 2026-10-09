import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'
import { markRaw } from 'vue'

import { initialWorkshopPageState } from '@/config/workshop-page-state'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import {
  snippetGraphFold,
  workflowPython,
  workflowSdkPlan,
  workflowSnippetRequest
} from '@/config/workshop-workflow-snippet'
import WorkflowApi from './WorkflowApi.vue'

const fixture = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(fixture, 'the catalogue no longer carries the fixture workflow')
const model = markRaw(fixture)

// What the page hands this tab: the form as it stands, which on a page nobody
// has touched is the workflow's own defaults.
const values = initialWorkshopPageState(model).values

describe('WorkflowApi', () => {
  it('walks through the key, the SDK and the run, with one key action', () => {
    render(WorkflowApi, { props: { model, values } })

    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Get an API key'),
        expect.stringContaining('Install the SDK'),
        expect.stringContaining('Run it')
      ])
    )
    expect(
      screen.getAllByRole('link', { name: /^Get an API key/ })
    ).toHaveLength(1)
    expect(screen.getAllByText(/paid Cloud plan/)).toHaveLength(1)
    expect(screen.getByText('pip install comfy-sdk==0.4.0')).toBeVisible()
  })

  it('reports the snippet language it copies and Get API key clicks', async () => {
    const { emitted } = render(WorkflowApi, { props: { model, values } })
    const visitor = userEvent.setup()

    await visitor.click(screen.getByRole('tab', { name: 'TypeScript' }))
    await visitor.click(screen.getByRole('button', { name: 'Copy snippet' }))
    const getKey = screen.getByRole('link', { name: /^Get an API key/ })
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

  it('folds the graph JSON behind a band that names its node count', async () => {
    const request = workflowSnippetRequest(model, values)
    const lines = workflowPython(workflowSdkPlan(model, values, request)).split(
      '\n'
    )
    const fold = snippetGraphFold(lines)
    assert(fold, 'the Python snippet no longer carries a graph to fold')
    const graph = lines.slice(fold.start, fold.end).join('\n')
    const nodes = Object.keys(request.prompt).length
    render(WorkflowApi, { props: { model, values } })
    const snippet = screen.getByTestId('workflow-api-snippet')
    const band = screen.getByRole('button', { name: /Show full graph JSON/ })

    expect(band).toHaveAttribute('aria-expanded', 'false')
    expect(band).toHaveTextContent(`${nodes} nodes`)
    expect(snippet.textContent).not.toContain(graph)
    expect(snippet).toHaveTextContent(
      'job = client.run(workflow, api_key=api_key)'
    )

    await userEvent.setup().click(band)

    expect(band).toHaveAttribute('aria-expanded', 'true')
    expect(band).toHaveTextContent('Hide full graph JSON')
    expect(snippet.textContent).toContain(graph)
  })

  it('offers the key and the documentation, and no graph to download', () => {
    render(WorkflowApi, { props: { model, values } })

    const docs = screen.getByRole('link', { name: /^API docs/ })
    expect(docs).toHaveAttribute(
      'href',
      'https://docs.comfy.org/development/cloud/overview#quick-start'
    )
    expect(docs).toHaveAttribute('target', '_blank')
    expect(
      screen.getByRole('link', { name: /^Get an API key/ })
    ).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull()
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
})
