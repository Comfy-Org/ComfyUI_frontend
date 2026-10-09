import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { assert, describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'
import displayJson from '@/content/workshop-display.json'
import categories from '@/content/workshop-workflow-categories.json'
import { workshopDisplayEntriesSchema } from '@/content/workshop-display.schema'
import { modelTitle } from '@/lib/workshop/model-title'
import { workshopExecutionId } from './models-catalogue'
import { initialWorkshopPageState } from './workshop-page-state'
import { urlUploadField, validateForm } from './workshop-playground'
import {
  getWorkshopPageDetail,
  workshopPagePaths,
  workshopPages
} from './workshop-page-content'
import { workflowCatalog } from './workshop-workflow-catalog'
import {
  workflowDetailsBySlug,
  workflowPagesFor
} from './workshop-workflow-content'
import { prepareWorkflowRender } from './workflow-render'
import { workflowCloudRequest } from './workshop-workflow-api'

const pages = workshopDisplayEntriesSchema.parse(displayJson)
const source = pages.find((page) => page.slug === 'workflows/change-material')
if (!source) throw new Error('Missing curated workflow page')
const page = source
const workflows = workshopPages.filter((model) => model.routerId === undefined)
const publicDirectory = join(websiteRoot, 'public')

describe('curated workflow pages', () => {
  it.for(workflows)(
    'opens $slug with its example in the shared form',
    (model) => {
      const detail = getWorkshopPageDetail(model.slug)
      assert.exists(detail)
      const state = initialWorkshopPageState(detail)
      expect(validateForm(state.schema, state.values)).toEqual({})
    }
  )

  it.for(workflows)(
    'serves the $slug graph files from a website-owned path',
    (model) => {
      const detail = getWorkshopPageDetail(model.slug)
      assert.exists(detail)
      assert(detail.workflow)
      const { previewUrl, downloadUrl } = detail.workflow.template ?? {}
      for (const url of [previewUrl, downloadUrl]) {
        assert(url)
        expect(url).toMatch(/^\/workflow-graphs\//)
        expect(existsSync(join(publicDirectory, url))).toBe(true)
      }
    }
  )

  it('runs the Bria example with its website-owned apple mask', () => {
    const detail = getWorkshopPageDetail('workflows/remove-object')
    assert.exists(detail)
    const { mask } = initialWorkshopPageState(detail).values
    expect(mask).toBe(
      'https://comfy.org/workflow-inputs/remove-object-apple-mask.png'
    )
    expect(
      existsSync(
        join(publicDirectory, 'workflow-inputs/remove-object-apple-mask.png')
      )
    ).toBe(true)
  })

  it('opens the inpainting example with the original image and its transparency mask', () => {
    const detail = getWorkshopPageDetail('workflows/edit-selected-region')
    assert.exists(detail)
    const state = initialWorkshopPageState(detail)

    expect(state.values).toMatchObject({
      image:
        'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@90c71fb78b3726392d010ff62a8e79e92d7296ad/input/flux_fill_inpaint_example_input_image.png',
      mask: state.values.image,
      mask_format: 'alpha'
    })
    expect(validateForm(state.schema, state.values)).toEqual({})
  })

  it.for(['red', 'alpha'])(
    'binds the selected %s mask format into the Cloud render request',
    async (channel) => {
      const detail = workflowDetailsBySlug.get('workflows/edit-selected-region')
      assert.exists(detail)
      const prepared = await prepareWorkflowRender(
        detail,
        { mask_format: channel },
        new AbortController().signal,
        async () => 'uploaded-image'
      )

      expect(workflowCloudRequest(detail.workflow, prepared)).toMatchObject({
        prompt: {
          'workshop-mask': {
            class_type: 'LoadImageMask',
            inputs: { image: 'uploaded-image', channel }
          }
        }
      })
    }
  )

  it('files every published workflow under one listed category', () => {
    expect(
      Object.fromEntries(
        Object.entries(
          Object.groupBy(workflows, (workflow) => workflow.category ?? '')
        ).map(([category, listed]) => [category, listed?.length])
      )
    ).toEqual({
      'image-to-image': 6,
      'image-to-video': 2,
      'reference-to-video': 2,
      'video-to-video': 5,
      upscale: 6,
      audio: 2,
      characters: 1,
      product: 4,
      tools: 2
    })
    expect(categories.map((category) => category.id)).toEqual([
      'image-to-image',
      'image-to-video',
      'reference-to-video',
      'video-to-video',
      'upscale',
      'audio',
      'characters',
      'product',
      'tools'
    ])
    expect(workflows).toHaveLength(30)
  })

  it.for([
    {
      slug: 'workflows/edit-selected-region',
      inputs: ['image'],
      output: 'image'
    },
    { slug: 'workflows/upscale-video', inputs: ['video'], output: 'video' },
    {
      slug: 'workflows/motion-transfer',
      inputs: ['image', 'video'],
      output: 'video'
    },
    {
      slug: 'workflows/talking-character',
      inputs: ['image', 'audio'],
      output: 'video'
    },
    {
      slug: 'workflows/character-turnaround',
      inputs: ['image'],
      output: 'image'
    }
  ])(
    'reads $slug as $inputs in, $output out from its uploads and results',
    ({ slug, inputs, output }) => {
      const model = workflows.find((workflow) => workflow.slug === slug)
      expect(model).toMatchObject({ inputKinds: inputs, modality: output })
    }
  )

  it('starts a workflow with no visible upload from text', () => {
    const [projected] = workflowPagesFor(
      [
        {
          ...page,
          inputs: Object.fromEntries(
            Object.entries(page.inputs ?? {}).map(([name, input]) => [
              name,
              input.control === 'media' ? { ...input, hidden: true } : input
            ])
          )
        }
      ],
      workflowCatalog
    )
    expect(projected.model.inputKinds).toEqual(['text'])
  })

  it.for(categories)('highlights one published workflow in $id', (category) => {
    expect(
      workflows
        .filter(
          (model) => model.category === category.id && model.categoryHighlight
        )
        .map(workshopExecutionId)
    ).toEqual([category.highlight])
  })

  it.for([undefined, 'unknown-category'])(
    'leaves unknown category %s without an editorial order',
    (category) => {
      const [projected] = workflowPagesFor(
        [{ ...page, category }],
        workflowCatalog
      )
      expect(projected.model.categoryOrder).toBeUndefined()
    }
  )

  it('pairs the original portrait input with one background-removed example', () => {
    const detail = getWorkshopPageDetail('workflows/remove-background')
    assert.exists(detail)
    expect(detail.examples).toHaveLength(1)
    expect(detail.examples[0]).toMatchObject({
      thumbnailUrl:
        'https://media.comfy.org/website/workshop/workflows/remove-background/lily-veil-cutout.webp',
      sampleOnly: false
    })
    const state = initialWorkshopPageState(detail)
    expect(state.values.image).toBe(
      'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@90c71fb78b3726392d010ff62a8e79e92d7296ad/input/the_lily_veil.png'
    )
    expect(validateForm(state.schema, state.values)).toEqual({})
  })

  it('keeps every audited material example with the form-facing prompt copy', () => {
    const detail = getWorkshopPageDetail('workflows/change-material')
    assert.exists(detail)

    expect(detail.examples.map(({ title }) => title)).toEqual([
      'A softer finish for a leather sofa',
      'A camper van woven from rattan',
      'Enamel cherries in amber glass',
      'A sports car in celadon porcelain'
    ])
    expect(detail.examples[0]?.values.prompt).toBe(
      'Give the sofa the fur texture from the material reference instead of its leather.'
    )
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
      { name: 'prompt', label: 'What should change?', kind: 'text' },
      { name: 'negative_prompt', label: 'Avoid', kind: 'text' },
      { name: 'fast_mode', label: 'Fast mode', kind: 'toggle' },
      { name: 'seed', label: 'Seed', kind: 'number' }
    ])
    expect(state.values.seed).toBeUndefined()
    expect(state.values.prompt).toBe(
      'Give the sofa the fur texture from the material reference instead of its leather.'
    )
    expect(state.values).toMatchObject({
      image1:
        'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@90c71fb78b3726392d010ff62a8e79e92d7296ad/input/leather_sofa.png',
      image2:
        'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@90c71fb78b3726392d010ff62a8e79e92d7296ad/input/texture_fur.png'
    })
    expect(validateForm(state.schema, state.values)).toEqual({})
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

describe('workshop pages', () => {
  it('gives every model and workflow page its own title', () => {
    const titles = workshopPages.map((model) => modelTitle(model))
    expect(new Set(titles).size).toBe(titles.length)
  })
})
