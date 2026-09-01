import { describe, expect, it } from 'vitest'

import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { extractTemplateModelRequirementDetails } from './templateModelRequirements'

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
    mode,
    title,
    type = 'CheckpointLoaderSimple'
  }: { mode?: LGraphEventMode; title?: unknown; type?: string } = {}
) {
  return {
    id,
    type,
    ...(mode !== undefined && { mode }),
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

describe('extractTemplateModelRequirementDetails', () => {
  it('uses workflow-level metadata only to enrich active node selections', () => {
    const topLevelSelected = model(
      'shared.safetensors',
      'checkpoints',
      'top-level-version'
    )
    const topLevelModel = model('top-level.safetensors', 'loras')

    expect(
      extractTemplateModelRequirementDetails({
        nodes: [node(1, [], [topLevelSelected.name])],
        models: [topLevelSelected, topLevelModel]
      })
    ).toEqual([{ model: topLevelSelected, usedBy: ['CheckpointLoaderSimple'] }])
  })

  it('only extracts node declarations selected by serialized widget values', () => {
    const selected = model('selected.safetensors', 'checkpoints')
    const selectedByName = model('selected-by-name.safetensors', 'loras')
    const stale = model('stale.safetensors', 'checkpoints')

    expect(
      extractTemplateModelRequirementDetails({
        nodes: [
          node(1, [selected, stale], [selected.name]),
          node(2, [selectedByName, stale], {
            model_name: selectedByName.name
          })
        ]
      })
    ).toEqual([
      { model: selected, usedBy: ['CheckpointLoaderSimple'] },
      { model: selectedByName, usedBy: ['CheckpointLoaderSimple'] }
    ])
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
      extractTemplateModelRequirementDetails({
        nodes: [{ id: 1, type: 'outer' }],
        definitions: { subgraphs: [outerDefinition] }
      })
    ).toEqual([{ model: nestedModel, usedBy: ['CheckpointLoaderSimple'] }])
  })

  it('does not extract declarations from uninstantiated subgraph definitions', () => {
    const unusedModel = model('unused.safetensors', 'checkpoints')

    expect(
      extractTemplateModelRequirementDetails({
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

  it.for([LGraphEventMode.NEVER, LGraphEventMode.BYPASS])(
    'excludes selected models on inactive nodes in mode %s',
    (mode) => {
      const inactiveModel = model('inactive.safetensors', 'checkpoints')

      expect(
        extractTemplateModelRequirementDetails({
          nodes: [node(1, [inactiveModel], [inactiveModel.name], { mode })]
        })
      ).toEqual([])
    }
  )

  it.for([LGraphEventMode.NEVER, LGraphEventMode.BYPASS])(
    'excludes selected models below an inactive subgraph in mode %s',
    (mode) => {
      const nestedModel = model('nested.safetensors', 'checkpoints')
      const definition = subgraphDefinition('inactive-subgraph', [
        node(2, [nestedModel], [nestedModel.name])
      ])

      expect(
        extractTemplateModelRequirementDetails({
          nodes: [{ id: 1, type: 'inactive-subgraph', mode }],
          definitions: { subgraphs: [definition] }
        })
      ).toEqual([])
    }
  )

  it('keeps only active usage when active and inactive nodes select the same model', () => {
    const sharedModel = model('shared.safetensors', 'checkpoints')

    expect(
      extractTemplateModelRequirementDetails({
        nodes: [
          node(1, [sharedModel], [sharedModel.name], {
            title: 'Active loader'
          }),
          node(2, [sharedModel], [sharedModel.name], {
            mode: LGraphEventMode.BYPASS,
            title: 'Bypassed loader'
          })
        ]
      })
    ).toEqual([{ model: sharedModel, usedBy: ['Active loader'] }])
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
    expect(extractTemplateModelRequirementDetails(workflow)).toEqual([])
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
    expect(extractTemplateModelRequirementDetails(workflow)).toEqual([])
  })

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
  })

  it('does not infer requirements from workflow-level metadata alone', () => {
    const checkpoint = model('shared.safetensors', 'checkpoints')
    const lora = model('shared.safetensors', 'loras')

    expect(
      extractTemplateModelRequirementDetails({
        models: [checkpoint, lora]
      })
    ).toEqual([])
  })
})
