import { describe, expect, it } from 'vitest'

import {
  countMissingModels,
  groupMissingModelCandidates
} from '@/platform/workflowErrors/missingModel/missingModelGrouping'
import type {
  MissingModelCandidate,
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/workflowErrors/missingModel/types'

function makeModel(name: string): MissingModelViewModel {
  return {
    name,
    representative: {
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name,
      isAssetSupported: false,
      isMissing: true
    },
    referencingNodes: [{ nodeId: '1', widgetName: 'ckpt_name' }]
  }
}

function makeGroup(
  directory: string | null,
  modelNames: string[]
): MissingModelGroup {
  return {
    directory,
    isAssetSupported: false,
    models: modelNames.map(makeModel)
  }
}

function makeCandidate(
  name: string,
  directory: string | undefined,
  isAssetSupported: boolean
): MissingModelCandidate {
  return {
    nodeId: '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    name,
    directory,
    isAssetSupported,
    isMissing: true
  }
}

function summarizeGroups(groups: MissingModelGroup[]) {
  return groups.map((group) => ({
    directory: group.directory,
    isAssetSupported: group.isAssetSupported,
    modelNames: group.models.map((model) => model.name)
  }))
}

describe('countMissingModels', () => {
  it('returns 0 for no groups', () => {
    expect(countMissingModels([])).toBe(0)
  })

  it('counts every model file within a single directory group', () => {
    expect(
      countMissingModels([
        makeGroup('checkpoints', ['a.safetensors', 'b.safetensors'])
      ])
    ).toBe(2)
  })

  it('sums model files across multiple directory groups', () => {
    expect(
      countMissingModels([
        makeGroup('checkpoints', ['a.safetensors', 'b.safetensors']),
        makeGroup('loras', ['c.safetensors']),
        makeGroup(null, ['d.safetensors'])
      ])
    ).toBe(4)
  })
})

describe('groupMissingModelCandidates', () => {
  it('returns no groups without candidates', () => {
    expect(groupMissingModelCandidates(null, true)).toEqual([])
    expect(groupMissingModelCandidates(undefined, true)).toEqual([])
    expect(groupMissingModelCandidates([], true)).toEqual([])
  })

  it('keeps cloud import-supported candidates grouped by directory', () => {
    expect(
      summarizeGroups(
        groupMissingModelCandidates(
          [
            makeCandidate('checkpoint.safetensors', 'checkpoints', true),
            makeCandidate('lora.safetensors', 'loras', true)
          ],
          true
        )
      )
    ).toEqual([
      {
        directory: 'checkpoints',
        isAssetSupported: true,
        modelNames: ['checkpoint.safetensors']
      },
      {
        directory: 'loras',
        isAssetSupported: true,
        modelNames: ['lora.safetensors']
      }
    ])
  })

  it('moves cloud import-unsupported candidates into the unknown section', () => {
    expect(
      summarizeGroups(
        groupMissingModelCandidates(
          [
            makeCandidate('supported.safetensors', 'loras', true),
            makeCandidate('unsupported.safetensors', 'text_encoders', false)
          ],
          true
        )
      )
    ).toEqual([
      {
        directory: 'loras',
        isAssetSupported: true,
        modelNames: ['supported.safetensors']
      },
      {
        directory: null,
        isAssetSupported: false,
        modelNames: ['unsupported.safetensors']
      }
    ])
  })

  it('keeps OSS candidates grouped by directory regardless of asset support', () => {
    expect(
      summarizeGroups(
        groupMissingModelCandidates(
          [makeCandidate('local.safetensors', 'text_encoders', false)],
          false
        )
      )
    ).toEqual([
      {
        directory: 'text_encoders',
        isAssetSupported: false,
        modelNames: ['local.safetensors']
      }
    ])
  })

  it('offers only the replacements every reference of a model accepts', () => {
    const [group] = groupMissingModelCandidates(
      [
        {
          ...makeCandidate('m_fp16.safetensors', 'checkpoints', false),
          replacements: ['sub/m_fp16.safetensors', 'm_bf16.safetensors']
        },
        {
          ...makeCandidate('m_fp16.safetensors', 'checkpoints', false),
          nodeId: '2',
          replacements: ['m_bf16.safetensors', 'm_fp8.safetensors']
        },
        {
          ...makeCandidate('other.safetensors', 'checkpoints', false),
          replacements: ['sub/other.safetensors']
        }
      ],
      false
    )

    expect(group.models.map((model) => model.replacements)).toEqual([
      ['m_bf16.safetensors'],
      ['sub/other.safetensors']
    ])
  })

  it('offers no replacements when one reference has none', () => {
    const [group] = groupMissingModelCandidates(
      [
        {
          ...makeCandidate('m_fp16.safetensors', 'checkpoints', false),
          replacements: ['m_bf16.safetensors']
        },
        {
          ...makeCandidate('m_fp16.safetensors', 'checkpoints', false),
          nodeId: '2'
        }
      ],
      false
    )

    expect(group.models[0].replacements).toEqual([])
  })
})
