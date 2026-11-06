import { describe, expect, it } from 'vitest'

import type {
  BuildCustomNode,
  NodePack
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import {
  buildEntryFor,
  defaultVersionChoice,
  isCommitHash,
  toBuildCustomNode
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'

const REPOSITORY = 'https://github.com/ltdrdata/ComfyUI-Impact-Pack'

const IMPACT: NodePack = {
  id: 'comfyui-impact-pack',
  name: 'ComfyUI Impact Pack',
  publisher: 'Dr.Lt.Data',
  installs: 3_600_000,
  stars: 3300,
  license: 'GPL-3.0',
  repository: REPOSITORY,
  latestVersion: '8.30.0'
}

describe('toBuildCustomNode', () => {
  it.for<{
    name: string
    choice: NodePackVersionChoice
    entry: BuildCustomNode
  }>([
    {
      name: 'the latest version pins that registry version',
      choice: { kind: 'latest', version: '8.30.0' },
      entry: { name: IMPACT.name, id: IMPACT.id, registryVersion: '8.30.0' }
    },
    {
      name: 'a chosen version pins it',
      choice: { kind: 'version', version: '8.29.1' },
      entry: { name: IMPACT.name, id: IMPACT.id, registryVersion: '8.29.1' }
    },
    {
      name: 'a commit hash installs that commit from the repository',
      choice: { kind: 'commit', hash: 'a1f3c9e', repository: REPOSITORY },
      entry: {
        name: IMPACT.name,
        id: IMPACT.id,
        repository: REPOSITORY,
        commit: 'a1f3c9e'
      }
    },
    {
      name: 'the default branch installs the repository head',
      choice: { kind: 'defaultBranch', repository: REPOSITORY },
      entry: { name: IMPACT.name, id: IMPACT.id, repository: REPOSITORY }
    }
  ])('$name', ({ choice, entry }) => {
    expect(toBuildCustomNode({ pack: IMPACT, choice })).toEqual(entry)
  })
})

describe('defaultVersionChoice', () => {
  it('starts on the latest registry version, then the default branch, else nothing installable', () => {
    expect(defaultVersionChoice(IMPACT)).toEqual({
      kind: 'latest',
      version: '8.30.0'
    })
    expect(
      defaultVersionChoice({ ...IMPACT, latestVersion: undefined })
    ).toEqual({ kind: 'defaultBranch', repository: REPOSITORY })
    expect(
      defaultVersionChoice({
        ...IMPACT,
        latestVersion: undefined,
        repository: undefined
      })
    ).toBeNull()
  })
})

describe('buildEntryFor', () => {
  it('finds the Build entry by registry id, or by repository for a git entry', () => {
    const byId: BuildCustomNode = {
      name: 'Impact',
      id: IMPACT.id,
      registryVersion: '8.0.0'
    }
    const byRepository: BuildCustomNode = {
      name: 'Impact',
      repository: `${REPOSITORY.toLowerCase()}.git/`
    }

    expect(buildEntryFor(IMPACT, [byId])).toBe(byId)
    expect(buildEntryFor(IMPACT, [byRepository])).toBe(byRepository)
    expect(
      buildEntryFor(IMPACT, [{ name: 'Other', blobId: 'blob-1' }])
    ).toBeUndefined()
  })
})

describe('isCommitHash', () => {
  it.for([
    ['a1f3c9e', true],
    ['5e1b0c2a9f4d7e3b8c6a1d2f0e9b7c5a3d1f8e6b', true],
    ['a1f3c9', false],
    ['main', false],
    ['zzzzzzz', false]
  ] as const)('%s is a commit hash: %s', ([value, expected]) => {
    expect(isCommitHash(value)).toBe(expected)
  })
})
