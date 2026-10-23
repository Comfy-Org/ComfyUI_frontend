import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import WorkflowPreview from './WorkflowPreview.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')
const { downloadUrl } = template
assert(downloadUrl, 'the fixture template no longer has a download URL')

const graphJson = () =>
  JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'public/workflow-graphs/animate-reference-sheet.json'
      ),
      'utf8'
    )
  ) as unknown

// Nothing here reaches the network: a test that says nothing about the graph
// still mounts the component that fetches it.
beforeEach(() => {
  respondToFetch({}, () => Response.error())
})

describe('WorkflowPreview', () => {
  it('puts the graph beside what it runs on', () => {
    render(WorkflowPreview, { props: { model } })

    expect(screen.getByTestId('workflow-graph')).toBeTruthy()
    // Panning a graph on a phone is not reading it, so the flat export the
    // page has always published is still one tap away.
    expect(screen.getByTestId('workflow-graph-full').getAttribute('href')).toBe(
      template.previewUrl
    )

    expect(screen.queryByRole('link', { name: 'Try in Cloud' })).toBeNull()
    expect(
      screen.queryByRole('link', { name: 'Download workflow JSON' })
    ).toBeNull()

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(runsOn).toHaveTextContent('Runs on')
    for (const name of template.models) expect(runsOn).toHaveTextContent(name)
  })

  // The frame takes the pointer so a drag pans the graph, and a captured press
  // hands its click to the frame instead of whatever it started on. The way to
  // the full-size export sits inside that frame, so it has to be let through.
  it('lets a press on the full-size link reach the link', () => {
    render(WorkflowPreview, { props: { model } })

    const frame = screen.getByTestId('workflow-graph')
    screen
      .getByTestId('workflow-graph-full')
      .dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })
      )

    expect(frame.className).toContain('cursor-grab')
    expect(frame.className).not.toContain('cursor-grabbing')
  })

  // Three of the design's six facts; the other three — how often it has run,
  // whether its weights are open, and when it was added — have no data behind
  // them anywhere in the catalogue.
  it('names where it runs, what it gives back, and who made it', () => {
    render(WorkflowPreview, { props: { model } })

    const details = screen.getByTestId('workflow-details')
    expect(details).toHaveTextContent('Runs on Comfy Cloud')
    expect(details).toHaveTextContent('Video, 1 per run')
    expect(details).toHaveTextContent(model.author ?? '')
  })

  // A workflow that gives back several of one thing says how many.
  it('counts what a run gives back', () => {
    const several = workflowDetailsBySlug.get('workflows/character-turnaround')
    assert(several, 'the catalogue no longer carries the multi-output fixture')
    expect(several.workflow.outputs).toHaveLength(3)

    render(WorkflowPreview, { props: { model: several } })

    expect(screen.getByTestId('workflow-details')).toHaveTextContent(
      'Image, 3 per run'
    )
  })

  it('keeps the facts it owns when there is no template', () => {
    render(WorkflowPreview, {
      props: {
        model: {
          ...model,
          author: undefined,
          workflow: { ...model.workflow, template: undefined }
        }
      }
    })

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByTestId('workflow-runs-on')).toBeNull()
    expect(screen.getByTestId('workflow-details')).toHaveTextContent(
      'Runs on Comfy Cloud'
    )
    expect(screen.queryByText('Author')).toBeNull()
  })

  // The graph is read from the same JSON the page offers for download, so what
  // it draws is what a reader would get if they took it away.
  it('draws the nodes of the template it downloads', async () => {
    respondToFetch(downloadUrl, () => Response.json(graphJson()))

    render(WorkflowPreview, { props: { model } })

    expect(
      await screen.findByRole('img', { name: /nodes of this workflow/i })
    ).toBeTruthy()
    expect(await screen.findByText('SaveVideo')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(downloadUrl)
  })

  it('waits to download the graph until its tab first opens', async () => {
    respondToFetch(downloadUrl, () => Response.json(graphJson()))
    const { rerender } = render(WorkflowPreview, {
      props: { model, active: false }
    })

    expect(fetch).not.toHaveBeenCalled()

    await rerender({ model, active: true })
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(downloadUrl)

    await rerender({ model, active: false })
    await rerender({ model, active: true })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('replaces the graph when the workflow changes', async () => {
    respondToFetch(downloadUrl, () => Response.json(graphJson()))
    const { rerender } = render(WorkflowPreview, {
      props: { model }
    })
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    const nextUrl = '/workflow-graphs/next-workflow.json'
    await rerender({
      model: {
        ...model,
        slug: 'workflows/next-workflow',
        workflow: {
          ...model.workflow,
          template: { ...template, downloadUrl: nextUrl }
        }
      }
    })

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith(nextUrl)
  })

  // The flat export is what this page showed before, so it is what a graph
  // that cannot be read falls back to.
  it('falls back to the flat export when the template cannot be read', async () => {
    respondToFetch(downloadUrl, () => Response.error())

    render(WorkflowPreview, { props: { model } })

    await waitFor(() =>
      expect(
        screen.getByTestId('workflow-graph-flat').getAttribute('src')
      ).toBe(template.previewUrl)
    )
  })
})
