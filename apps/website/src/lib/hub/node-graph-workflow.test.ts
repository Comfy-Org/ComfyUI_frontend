import { assert, describe, expect, it } from 'vitest'

import type { PlaygroundExample } from '@/config/workshop-playground'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'

import { nodeGraphWorkflowFromModel, sampleMedia } from './node-graph-workflow'

const sample = (
  outputUrl: string,
  mediaKind?: PlaygroundExample['mediaKind']
) => ({
  id: 'sample',
  title: 'Sample',
  specs: [],
  values: {},
  outputUrl,
  sampleOnly: true,
  ...(mediaKind ? { mediaKind } : {})
})

describe('sampleMedia', () => {
  it.for([
    {
      name: 'trusts a declared kind',
      example: sample('/a.png', 'audio'),
      media: 'audio'
    },
    {
      name: 'reads a video URL',
      example: sample('/clip.mp4?v=2'),
      media: 'video'
    },
    {
      name: 'reads an audio URL',
      example: sample('/voice.mp3'),
      media: 'audio'
    },
    {
      name: 'falls back to an image',
      example: sample('/sheet.webp'),
      media: 'image'
    }
  ])('$name', ({ example, media }) => {
    expect(sampleMedia(example)).toBe(media)
  })
})

const model = workflowDetailsBySlug.get('workflows/remove-background')
assert(model, 'the catalogue no longer carries the fixture workflow')

describe('nodeGraphWorkflowFromModel', () => {
  it('takes the catalog description, models and author over the static ones', () => {
    const workflow = nodeGraphWorkflowFromModel(
      {
        ...model,
        catalogDetails: {
          locale: 'en',
          faqs: [],
          models: [{ uid: 'm1', name: 'Catalog model' }],
          longDescription: 'First paragraph.\n\n  Second paragraph.  ',
          author: 'catalog author',
          outputType: 'image'
        }
      },
      { downloadUrl: '/graph.json', cloudHref: 'https://cloud.comfy.org/' }
    )

    expect({
      description: workflow.description,
      models: workflow.models,
      author: workflow.author,
      output: workflow.output,
      graphSource: workflow.graphSource,
      cloudHref: workflow.cloudHref
    }).toEqual({
      description: ['First paragraph.', 'Second paragraph.'],
      models: ['Catalog model'],
      author: 'catalog author',
      output: 'image',
      graphSource: '/graph.json',
      cloudHref: 'https://cloud.comfy.org/'
    })
  })

  it('falls back to the summary and static models without catalog details', () => {
    const workflow = nodeGraphWorkflowFromModel(
      { ...model, catalogDetails: undefined },
      {}
    )

    expect({
      description: workflow.description,
      models: workflow.models,
      cloudHref: workflow.cloudHref
    }).toEqual({
      description: [model.summary],
      models: model.models ?? [],
      cloudHref: undefined
    })
  })
})
