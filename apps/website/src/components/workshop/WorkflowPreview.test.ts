import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { getWorkshopPageDetail } from '@/config/workshop-page-content'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import WorkflowPreview from './WorkflowPreview.vue'

vi.mock(import('@/scripts/posthog'))

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
  it('puts the graph beside what it runs on, leaving the ways out to the page', () => {
    render(WorkflowPreview, { props: { model } })

    expect(screen.getByTestId('workflow-graph')).toBeTruthy()
    // Panning a graph on a phone is not reading it, so the flat export the
    // page has always published is still one tap away.
    expect(screen.getByTestId('workflow-graph-full').getAttribute('href')).toBe(
      template.previewUrl
    )

    expect(screen.queryByTestId('workflow-actions')).toBeNull()
    expect(screen.getAllByRole('link')).toEqual([
      screen.getByTestId('workflow-graph-full')
    ])

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

  it('links each model it runs on to its Hub page, where one exists', () => {
    const seedance = getWorkshopPageDetail('workflows/change-video-background')
    assert(seedance && 'parts' in seedance && seedance.parts)
    render(WorkflowPreview, { props: { model: seedance } })

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(
      within(runsOn).getByRole('link', { name: 'Seedance 2.5' })
    ).toHaveAttribute('href', '/hub/models/seedance-2-5-video-edit/')
  })

  it('names a model with no Hub page without linking it', () => {
    const ltx = getWorkshopPageDetail('workflows/animate-reference-sheet')
    assert(ltx && 'parts' in ltx && ltx.parts)
    render(WorkflowPreview, { props: { model: ltx } })

    const runsOn = screen.getByTestId('workflow-runs-on')
    expect(runsOn).toHaveTextContent('LTX-2.3')
    expect(within(runsOn).queryByRole('link')).toBeNull()
  })

  it('opens on Comfy Cloud, where there is nothing to download', () => {
    const ltx = getWorkshopPageDetail('workflows/remove-object-from-video')
    assert(ltx && 'parts' in ltx && ltx.parts.files.length > 0)
    render(WorkflowPreview, { props: { model: ltx } })

    expect(
      screen.getByRole('tab', { name: 'Comfy Cloud', selected: true })
    ).toBeTruthy()
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Nothing to download — Comfy Cloud already has every file.'
    )
    expect(screen.queryByTestId('workflow-files')).toBeNull()
  })

  it('opens on Your machine for a workflow that does not run on Comfy Cloud', () => {
    render(WorkflowPreview, {
      props: { model: { ...model, type: 'SERVERLESS' } }
    })

    expect(
      screen.getByRole('tab', { name: 'Your machine', selected: true })
    ).toBeTruthy()
  })

  it('moves between the tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(WorkflowPreview, { props: { model } })

    await user.click(screen.getByRole('tab', { name: 'Comfy Cloud' }))
    await user.keyboard('{ArrowRight}')

    const machine = screen.getByRole('tab', { name: 'Your machine' })
    expect(machine).toHaveFocus()
    expect(machine).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      machine.id
    )
  })

  it('puts each file in its ComfyUI folder, with a download where the data has one', async () => {
    const user = userEvent.setup()
    const ltx = getWorkshopPageDetail('workflows/remove-object-from-video')
    assert(ltx && 'parts' in ltx && ltx.parts)
    render(WorkflowPreview, { props: { model: ltx } })
    await user.click(screen.getByRole('tab', { name: 'Your machine' }))

    const encoder = within(screen.getByTestId('workflow-files'))
      .getAllByTestId('workflow-file')
      .find((row) => row.textContent.includes('gemma_3_12B_it_fp4_mixed'))
    assert(encoder, 'the fixture no longer loads the Gemma text encoder')
    expect(
      within(encoder).getByTestId('workflow-file-place')
    ).toHaveTextContent('Text encoder · models/text_encoders/')
    expect(
      within(encoder).getByRole('link', {
        name: 'Download gemma_3_12B_it_fp4_mixed.safetensors'
      })
    ).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/huggingface\.co\//)
    )
  })

  it('lists the model files it loads, linking those with a page', async () => {
    const user = userEvent.setup()
    const ltx = getWorkshopPageDetail('workflows/remove-object-from-video')
    assert(ltx && 'parts' in ltx && ltx.parts)
    render(WorkflowPreview, { props: { model: ltx } })
    await user.click(screen.getByRole('tab', { name: 'Your machine' }))

    const files = screen.getByTestId('workflow-files')
    expect(files).toHaveTextContent('Files it needs')
    const encoder = within(files).getByRole('link', {
      name: /^gemma_3_12B_it_fp4_mixed\.safetensors/
    })
    expect(encoder).toHaveAttribute(
      'href',
      '/hub/models/local/gemma-3-12b-it-fp4-mixed/'
    )
    expect(encoder).toHaveTextContent('Text encoder')
    expect(files).toHaveTextContent('LTX23_video_vae_bf16.safetensors')
    expect(
      within(files).queryByRole('link', { name: /^LTX23_video_vae_bf16/ })
    ).toBeNull()
  })

  it('says there is nothing to download for a workflow that loads no files', async () => {
    const user = userEvent.setup()
    const seedance = getWorkshopPageDetail('workflows/change-video-background')
    assert(seedance && 'parts' in seedance)
    render(WorkflowPreview, { props: { model: seedance } })
    await user.click(screen.getByRole('tab', { name: 'Your machine' }))

    expect(screen.queryByTestId('workflow-files')).toBeNull()
    expect(screen.getByTestId('workflow-no-files')).toHaveTextContent(
      'It loads no model files, so there is nothing to download.'
    )
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

  it('waits to download the graph until its section is first reached', async () => {
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
