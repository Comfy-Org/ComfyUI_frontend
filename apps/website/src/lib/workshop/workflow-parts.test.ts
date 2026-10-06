import { assert, describe, expect, it } from 'vitest'

import type {
  WorkflowWorkshopModelDetail,
  WorkshopModel
} from '@/config/models-catalogue'
import { workflowDetailsBySlug } from '@/config/workshop-workflow-content'
import { workflowParts } from './workflow-parts'

function loadFixture(): WorkflowWorkshopModelDetail {
  const detail = workflowDetailsBySlug.get('workflows/remove-background')
  assert(detail, 'the catalogue no longer carries the fixture workflow')
  return detail
}

const fixture = loadFixture()

function workflowWith(
  models: readonly string[],
  inputs: readonly Record<string, string | number>[] = []
): WorkflowWorkshopModelDetail {
  return {
    ...fixture,
    useCases: ['edit-images'],
    workflow: {
      ...fixture.workflow,
      template: fixture.workflow.template && {
        ...fixture.workflow.template,
        models: [...models]
      },
      cloud: fixture.workflow.cloud && {
        ...fixture.workflow.cloud,
        workflow: Object.fromEntries(
          inputs.map((values, index) => [
            String(index),
            { class_type: 'Loader', inputs: values }
          ])
        )
      }
    }
  }
}

function hosted(
  name: string,
  useCase: 'edit-images' | 'edit-videos' | 'generate-images'
): WorkshopModel {
  const slug = name.toLowerCase().replaceAll(' ', '-')
  return {
    slug,
    name,
    href: `/hub/models/${slug}/`,
    routerId: slug,
    workflowCount: 0,
    capabilities: [],
    useCases: [useCase]
  }
}

const noFiles = () => undefined

describe('workflowParts runs on', () => {
  it.for([
    {
      case: 'the one hosted page for the workflow task',
      models: ['Nano Banana Pro Image Edit', 'Nano Banana Pro Text-to-Image'],
      useCases: ['edit-images', 'generate-images'] as const,
      href: '/hub/models/nano-banana-pro-image-edit/'
    },
    {
      case: 'nothing when the only page does another task',
      models: ['Nano Banana Pro Text-to-Image'],
      useCases: ['generate-images'] as const,
      href: undefined
    },
    {
      case: 'nothing when two pages do the same task',
      models: ['Nano Banana Pro Image Edit', 'Nano Banana Pro Image Edit Fast'],
      useCases: ['edit-images', 'edit-images'] as const,
      href: undefined
    }
  ])('links $case', ({ models, useCases, href }) => {
    const pages = models.map((name, index) => hosted(name, useCases[index]))

    const { runsOn } = workflowParts(
      workflowWith(['Nano Banana Pro']),
      pages,
      noFiles
    )

    expect(runsOn).toEqual([
      href ? { name: 'Nano Banana Pro', href } : { name: 'Nano Banana Pro' }
    ])
  })

  it('never links a bare brand to one of its releases', () => {
    const { runsOn } = workflowParts(
      workflowWith(['Seedream']),
      [hosted('Seedream 4.5 Image Edit', 'edit-images')],
      noFiles
    )

    expect(runsOn).toEqual([{ name: 'Seedream' }])
  })
})

describe('workflowParts files', () => {
  it('lists each model file the graph loads once, in load order, with its page', () => {
    const { files } = workflowParts(
      workflowWith(
        [],
        [
          { unet_name: 'flux1-fill-dev.safetensors', steps: 20 },
          { vae_name: 'ae.safetensors', prompt: 'a cat.png' },
          { unet_name: 'flux1-fill-dev.safetensors' },
          { lora_name: 'private.pth' }
        ]
      ),
      [],
      (name) =>
        name === 'private.pth'
          ? undefined
          : { directory: 'vae', href: `/p/supported-models/${name}/` }
    )

    expect(files).toEqual([
      {
        name: 'flux1-fill-dev.safetensors',
        directory: 'vae',
        href: '/p/supported-models/flux1-fill-dev.safetensors/'
      },
      {
        name: 'ae.safetensors',
        directory: 'vae',
        href: '/p/supported-models/ae.safetensors/'
      },
      { name: 'private.pth' }
    ])
  })

  it('needs no files for a graph that only calls hosted nodes', () => {
    expect(
      workflowParts(workflowWith([], [{ prompt: 'a cat' }]), [], noFiles).files
    ).toEqual([])
  })
})
