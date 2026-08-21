import { describe, expect, it } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'

const modulePath = './templateModelRequirements'

type TemplateModelRequirementDetail = {
  model: ModelFile
  usedBy: readonly string[]
}

type ModelRequirementsModule = {
  extractTemplateModelRequirements: (workflow: unknown) => readonly ModelFile[]
  extractTemplateModelRequirementDetails: (
    workflow: unknown
  ) => readonly TemplateModelRequirementDetail[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isModelRequirementsModule(
  value: unknown
): value is ModelRequirementsModule {
  return (
    isRecord(value) &&
    typeof value.extractTemplateModelRequirements === 'function' &&
    typeof value.extractTemplateModelRequirementDetails === 'function'
  )
}

async function loadModelRequirementsModule(): Promise<ModelRequirementsModule | null> {
  try {
    const module: unknown = await import(modulePath)
    return isModelRequirementsModule(module) ? module : null
  } catch {
    return null
  }
}

async function extractTemplateModelRequirements(
  workflow: unknown
): Promise<readonly ModelFile[]> {
  return (
    (await loadModelRequirementsModule())?.extractTemplateModelRequirements(
      workflow
    ) ?? []
  )
}

async function extractTemplateModelRequirementDetails(
  workflow: unknown
): Promise<readonly TemplateModelRequirementDetail[]> {
  return (
    (
      await loadModelRequirementsModule()
    )?.extractTemplateModelRequirementDetails(workflow) ?? []
  )
}

function model(name: string, directory: string, urlSuffix = name): ModelFile {
  return {
    name,
    directory,
    url: `https://example.com/${urlSuffix}`
  }
}

function node(
  id: number,
  models: readonly unknown[],
  selectedModelNames: readonly string[] | Record<string, unknown>,
  {
    title,
    type = 'CheckpointLoaderSimple'
  }: { title?: unknown; type?: string } = {}
) {
  return {
    id,
    type,
    ...(title !== undefined && { title }),
    properties: { models },
    widgets_values: selectedModelNames
  }
}

function subgraphDefinition(
  id: string,
  nodes: readonly unknown[],
  nestedDefinitions: readonly unknown[] = []
) {
  return {
    id,
    name: id,
    nodes,
    definitions: { subgraphs: nestedDefinitions },
    inputNode: {},
    outputNode: {}
  }
}

describe('extractTemplateModelRequirements', () => {
  it('extracts selected node declarations before top-level declarations', async () => {
    const nodeModel = model('shared.safetensors', 'checkpoints', 'node-version')
    const topLevelDuplicate = model(
      'shared.safetensors',
      'checkpoints',
      'top-level-version'
    )
    const topLevelModel = model('top-level.safetensors', 'loras')

    expect(
      await extractTemplateModelRequirements({
        nodes: [node(1, [nodeModel], [nodeModel.name])],
        models: [topLevelDuplicate, topLevelModel]
      })
    ).toEqual([nodeModel, topLevelModel])
  })

  it('only extracts node declarations selected by serialized widget values', async () => {
    const selected = model('selected.safetensors', 'checkpoints')
    const selectedByName = model('selected-by-name.safetensors', 'loras')
    const stale = model('stale.safetensors', 'checkpoints')

    expect(
      await extractTemplateModelRequirements({
        nodes: [
          node(1, [selected, stale], [selected.name]),
          node(2, [selectedByName, stale], {
            model_name: selectedByName.name
          })
        ]
      })
    ).toEqual([selected, selectedByName])
  })

  it('extracts declarations from instantiated nested subgraphs', async () => {
    const nestedModel = model('nested.safetensors', 'diffusion_models')
    const innerDefinition = subgraphDefinition('inner', [
      node(3, [nestedModel], [nestedModel.name])
    ])
    const outerDefinition = subgraphDefinition(
      'outer',
      [{ id: 2, type: 'inner' }],
      [innerDefinition]
    )

    expect(
      await extractTemplateModelRequirements({
        nodes: [{ id: 1, type: 'outer' }],
        definitions: { subgraphs: [outerDefinition] }
      })
    ).toEqual([nestedModel])
  })

  it('does not extract declarations from uninstantiated subgraph definitions', async () => {
    const unusedModel = model('unused.safetensors', 'checkpoints')

    expect(
      await extractTemplateModelRequirements({
        nodes: [],
        definitions: {
          subgraphs: [
            subgraphDefinition('unused', [
              node(2, [unusedModel], [unusedModel.name])
            ])
          ]
        }
      })
    ).toEqual([])
  })

  it('keeps same-name declarations in different directories', async () => {
    const checkpoint = model('shared.safetensors', 'checkpoints')
    const lora = model('shared.safetensors', 'loras')

    expect(
      await extractTemplateModelRequirements({ models: [checkpoint, lora] })
    ).toEqual([checkpoint, lora])
  })

  it.for([
    null,
    {},
    { models: 'not-an-array' },
    {
      nodes: [
        {
          id: 1,
          type: 'CheckpointLoaderSimple',
          properties: { models: 'not-an-array' },
          widgets_values: ['ignored.safetensors']
        }
      ]
    },
    { models: [null, {}, { name: 'incomplete.safetensors' }] }
  ])(
    'ignores absent or malformed model declarations in %j',
    async (workflow) => {
      expect(await extractTemplateModelRequirements(workflow)).toEqual([])
    }
  )
})

describe('extractTemplateModelRequirementDetails', () => {
  it('keeps first model metadata while merging stable flattened-node usage', async () => {
    const first = model('shared.safetensors', 'checkpoints', 'first-version')
    const later = model('shared.safetensors', 'checkpoints', 'later-version')
    const topLevel = model(
      'shared.safetensors',
      'checkpoints',
      'top-level-version'
    )
    const nested = model('shared.safetensors', 'checkpoints', 'nested-version')
    const innerDefinition = subgraphDefinition('inner', [
      node(7, [nested], [nested.name], { title: 'Nested loader' })
    ])
    const workflow = {
      nodes: [
        node(1, [first], [first.name], { title: 'Primary loader' }),
        node(2, [later], [later.name], { title: 'Primary loader' }),
        node(3, [later], [later.name], {
          title: '   ',
          type: 'BlankTitleLoader'
        }),
        node(4, [later], [later.name], {
          title: 42,
          type: 'InvalidTitleLoader'
        }),
        { id: 5, type: 'inner' }
      ],
      definitions: { subgraphs: [innerDefinition] },
      models: [topLevel]
    }

    expect(await extractTemplateModelRequirementDetails(workflow)).toEqual([
      {
        model: first,
        usedBy: [
          'Primary loader',
          'BlankTitleLoader',
          'InvalidTitleLoader',
          'Nested loader'
        ]
      }
    ])
    expect(await extractTemplateModelRequirements(workflow)).toEqual([first])
  })

  it('keeps top-level-only same-name models in separate directories', async () => {
    const checkpoint = model('shared.safetensors', 'checkpoints')
    const lora = model('shared.safetensors', 'loras')

    expect(
      await extractTemplateModelRequirementDetails({
        models: [checkpoint, lora]
      })
    ).toEqual([
      { model: checkpoint, usedBy: [] },
      { model: lora, usedBy: [] }
    ])
  })
})
