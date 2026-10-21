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
  it('takes the catalog description, files and Cloud flag', () => {
    const workflow = nodeGraphWorkflowFromModel(
      {
        ...model,
        catalogDetails: {
          locale: 'en',
          faqs: [],
          models: [],
          longDescription: 'First paragraph.\n\n  Second paragraph.  ',
          worksOnCloud: false,
          workflowFiles: [
            {
              name: 'v1',
              uid: '3f6c2b1e-8d4a-4f6e-9c2b-1a7d5e9f0b42',
              href: '/workflow-graphs/remove-background.json'
            }
          ]
        }
      },
      { downloadUrl: '/graph.json', downloadName: 'graph.json' }
    )

    expect({
      description: workflow.description,
      files: workflow.files,
      graphSource: workflow.graphSource,
      graphFallback: workflow.graphFallback,
      downloadName: workflow.downloadName,
      worksOnCloud: workflow.worksOnCloud
    }).toEqual({
      description: ['First paragraph.', 'Second paragraph.'],
      files: [{ name: 'v1', href: '/workflow-graphs/remove-background.json' }],
      graphSource: '/graph.json',
      graphFallback: undefined,
      downloadName: 'graph.json',
      worksOnCloud: false
    })
  })

  it('falls back to the summary and the template preview without catalog details', () => {
    const workflow = nodeGraphWorkflowFromModel(
      { ...model, catalogDetails: undefined },
      {}
    )

    expect({
      description: workflow.description,
      graphFallback: workflow.graphFallback,
      cloudHref: workflow.cloudHref
    }).toEqual({
      description: [model.summary],
      graphFallback: model.workflow.template?.previewUrl,
      cloudHref: undefined
    })
  })

  it('falls back to the summary when the catalog description is blank', () => {
    const workflow = nodeGraphWorkflowFromModel(
      {
        ...model,
        catalogDetails: {
          locale: 'en',
          faqs: [],
          models: [],
          longDescription: '   '
        }
      },
      {}
    )

    expect(workflow.description).toEqual([model.summary])
  })
})
