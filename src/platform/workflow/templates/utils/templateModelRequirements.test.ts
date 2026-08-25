import { describe, expect, it } from 'vitest'

import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  extractTemplateModelRequirementDetails,
  extractTemplateModelRequirements
} from './templateModelRequirements'

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
  it('extracts selected node declarations before top-level declarations', () => {
    const nodeModel = model('shared.safetensors', 'checkpoints', 'node-version')
    const topLevelDuplicate = model(
      'shared.safetensors',
      'checkpoints',
      'top-level-version'
    )
    const topLevelModel = model('top-level.safetensors', 'loras')

    expect(
      extractTemplateModelRequirements({
        nodes: [node(1, [nodeModel], [nodeModel.name])],
        models: [topLevelDuplicate, topLevelModel]
      })
    ).toEqual([nodeModel, topLevelModel])
  })

  it('only extracts node declarations selected by serialized widget values', () => {
    const selected = model('selected.safetensors', 'checkpoints')
    const selectedByName = model('selected-by-name.safetensors', 'loras')
    const stale = model('stale.safetensors', 'checkpoints')

    expect(
      extractTemplateModelRequirements({
        nodes: [
          node(1, [selected, stale], [selected.name]),
          node(2, [selectedByName, stale], {
            model_name: selectedByName.name
          })
        ]
      })
    ).toEqual([selected, selectedByName])
  })

  it('extracts declarations from instantiated nested subgraphs', () => {
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
      extractTemplateModelRequirements({
        nodes: [{ id: 1, type: 'outer' }],
        definitions: { subgraphs: [outerDefinition] }
      })
    ).toEqual([nestedModel])
  })

  it('does not extract declarations from uninstantiated subgraph definitions', () => {
    const unusedModel = model('unused.safetensors', 'checkpoints')

    expect(
      extractTemplateModelRequirements({
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

  it('keeps same-name declarations in different directories', () => {
    const checkpoint = model('shared.safetensors', 'checkpoints')
    const lora = model('shared.safetensors', 'loras')

    expect(
      extractTemplateModelRequirements({ models: [checkpoint, lora] })
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
  ])('ignores absent or malformed model declarations in %j', (workflow) => {
    expect(extractTemplateModelRequirements(workflow)).toEqual([])
  })

  it.for([
    {
      name: 'top-level',
      workflow: {
        models: [
          {
            ...model('invalid-top-level.safetensors', 'checkpoints'),
            url: 'not-a-url'
          }
        ]
      }
    },
    {
      name: 'node',
      workflow: {
        nodes: [
          node(
            1,
            [
              {
                ...model('invalid-node.safetensors', 'checkpoints'),
                url: 'not-a-url'
              }
            ],
            ['invalid-node.safetensors']
          )
        ]
      }
    }
  ])('ignores $name declarations with invalid URLs', ({ workflow }) => {
    expect(extractTemplateModelRequirements(workflow)).toEqual([])
  })
})

describe('extractTemplateModelRequirementDetails', () => {
  it('keeps first model metadata while merging stable flattened-node usage', () => {
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

    expect(extractTemplateModelRequirementDetails(workflow)).toEqual([
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
    expect(extractTemplateModelRequirements(workflow)).toEqual([first])
  })

  it('keeps top-level-only same-name models in separate directories', () => {
    const checkpoint = model('shared.safetensors', 'checkpoints')
    const lora = model('shared.safetensors', 'loras')

    expect(
      extractTemplateModelRequirementDetails({
        models: [checkpoint, lora]
      })
    ).toEqual([
      { model: checkpoint, usedBy: [] },
      { model: lora, usedBy: [] }
    ])
  })
})
