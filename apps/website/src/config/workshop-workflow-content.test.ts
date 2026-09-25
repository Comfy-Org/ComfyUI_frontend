import { assert, describe, expect, it } from 'vitest'

import displayJson from '../content/workshop-display.json'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import { workshopExecutionId } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'
import { urlUploadField, validateForm } from './workshop-playground'
import {
  getWorkshopPageDetail,
  workshopPagePaths,
  workshopPages
} from './workshop-page-content'
import { workflowCatalog } from './workshop-workflow-catalog'
import { workflowPagesFor } from './workshop-workflow-content'

const pages = workshopDisplayEntriesSchema.parse(displayJson)
const source = pages.find((page) => page.slug === 'workflows/change-material')
if (!source) throw new Error('Missing curated workflow page')
const page = source
const workflows = workshopPages.filter((model) => model.type === 'CLOUD')

describe('curated workflow pages', () => {
  it('pairs the original portrait input with one background-removed example', () => {
    const detail = getWorkshopPageDetail('workflows/remove-background')
    assert.exists(detail)
    expect(detail.examples).toHaveLength(1)
    expect(detail.examples[0]).toMatchObject({
      thumbnailUrl:
        'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/90c71fb78b3726392d010ff62a8e79e92d7296ad/templates/utility_birefnet_remove_background-1.webp',
      sampleOnly: false
    })
    const state = initialWorkshopPageState(detail)
    expect(state.values.image).toBe(
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/90c71fb78b3726392d010ff62a8e79e92d7296ad/input/the_lily_veil.png'
    )
    expect(validateForm(state.schema, state.values)).toEqual({})
  })

  it('uses the master INPUTS widgets and prepared defaults in the shared form', () => {
    const detail = getWorkshopPageDetail(page.slug)
    if (!detail) throw new Error('Missing workflow detail')
    const state = initialWorkshopPageState(detail)

    expect(
      state.schema.map((field) => {
        const { name, label, kind } = urlUploadField(field) ?? field
        return { name, label, kind }
      })
    ).toEqual([
      { name: 'image1', label: 'Your original image', kind: 'file' },
      { name: 'image2', label: 'Material reference', kind: 'file' },
      { name: 'prompt', label: 'What should change?', kind: 'text' }
    ])
    expect(state.values.prompt).toBe(
      'Change the furniture leather difference in image 1 to the fur material in image 2.'
    )
    expect(validateForm(state.schema, state.values)).toEqual({
      image1: 'required',
      image2: 'required'
    })
  })

  it.for([
    { name: 'no master page', pages: [], catalog: workflowCatalog },
    { name: 'no execution entry', pages: [page], catalog: [] },
    {
      name: 'wrong execution type',
      pages: [{ ...page, type: 'SERVERLESS' as const }],
      catalog: workflowCatalog
    },
    {
      name: 'unavailable page',
      pages: [{ ...page, status: 'unavailable' as const }],
      catalog: workflowCatalog
    }
  ])('withholds a page with $name', ({ pages, catalog }) => {
    expect(workflowPagesFor(pages, catalog)).toEqual([])
  })

  it('rejects missing input mappings and incompatible controls', () => {
    expect(() =>
      workflowPagesFor([{ ...page, inputs: {} }], workflowCatalog)
    ).toThrow('Workflow page inputs do not match')
    expect(() =>
      workflowPagesFor(
        [
          {
            ...page,
            inputs: {
              ...page.inputs,
              prompt: {
                label: 'What should change?',
                help: '',
                hidden: false,
                advanced: false,
                control: 'toggle'
              }
            }
          }
        ],
        workflowCatalog
      )
    ).toThrow('Input control does not match its declared type: prompt')
  })

  it('uses the same matched entries for discovery and detail routes', () => {
    expect(
      workflows.map(workshopExecutionId).sort((a, b) => a.localeCompare(b))
    ).toEqual(
      workflowCatalog
        .map((entry) => entry.id)
        .sort((a, b) => a.localeCompare(b))
    )
    expect(getWorkshopPageDetail('workflows/not-published')).toBeUndefined()
    expect(workshopPagePaths).not.toContain('workflows/not-published')
  })

  it.for(workflows)(
    'serves the prepared Cloud request only in the detail for $slug',
    (model) => {
      expect(workshopPagePaths).toContain(model.slug)
      expect(JSON.stringify(model)).not.toContain('class_type')
      expect(JSON.stringify(model)).not.toContain('inputBindings')
      const detail = getWorkshopPageDetail(model.slug)
      expect(detail).toMatchObject({
        type: 'CLOUD',
        workflow: {
          id: model.workflowId,
          definitionVersion: '1',
          cloud: {
            workflow: expect.any(Object),
            inputBindings: expect.any(Object)
          }
        }
      })
      expect(detail).not.toHaveProperty('routerId')
    }
  )
})
