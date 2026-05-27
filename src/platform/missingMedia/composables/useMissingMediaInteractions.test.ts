import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import {
  getMediaDisplayName,
  useMissingMediaInteractions
} from '@/platform/missingMedia/composables/useMissingMediaInteractions'

const mockedState = vi.hoisted(() => ({
  inputAssetsByFilename: new Map<string, AssetItem>(),
  getNodeByExecutionId: vi.fn(),
  resolveComboValues: vi.fn()
}))

vi.mock('@/stores/assetsStore', () => ({
  useAssetsStore: () => ({
    inputAssetsByFilename: mockedState.inputAssetsByFilename
  })
}))

vi.mock('@/platform/missingMedia/missingMediaStore', () => ({
  useMissingMediaStore: () => ({
    expandState: {},
    pendingSelection: {},
    uploadState: {},
    missingMediaCandidates: null
  })
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: mockedState.getNodeByExecutionId
}))

vi.mock('@/utils/litegraphUtil', () => ({
  resolveComboValues: mockedState.resolveComboValues,
  addToComboValues: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { id: 'mock-graph' }
  }
}))

vi.mock('@/scripts/api', () => ({
  api: { fetchApi: vi.fn() }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
}))

const baseAsset: AssetItem = {
  id: 'asset-1',
  name: '',
  tags: ['input'],
  size: 1024
}

describe('getMediaDisplayName', () => {
  beforeEach(() => {
    mockedState.inputAssetsByFilename.clear()
  })

  it('returns the input string when no matching asset is in the store (OSS pass-through)', () => {
    expect(getMediaDisplayName('sunset.png')).toBe('sunset.png')
  })

  it('returns display_name when the matched asset carries one (Cloud unified shape)', () => {
    const hash = 'blake3:abc1234567890def.png'
    mockedState.inputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'sunset.png'
    })
    expect(getMediaDisplayName(hash)).toBe('sunset.png')
  })

  it('falls back to asset.name when display_name is absent (legacy Cloud asset)', () => {
    const hash = 'blake3:def4567890abc1234.png'
    mockedState.inputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: 'beach.png',
      asset_hash: hash
    })
    expect(getMediaDisplayName(hash)).toBe('beach.png')
  })

  it('prefers metadata.filename over display_name and asset.name (shared helper chain)', () => {
    const hash = 'blake3:fff1111222.png'
    mockedState.inputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'from_display.png',
      metadata: { filename: 'from_metadata.png' }
    })
    expect(getMediaDisplayName(hash)).toBe('from_metadata.png')
  })

  it('falls back to display_name when filename metadata is absent (Cloud hash-keyed asset)', () => {
    const hash = 'blake3:aaa2222333.png'
    mockedState.inputAssetsByFilename.set(hash, {
      ...baseAsset,
      name: hash,
      asset_hash: hash,
      display_name: 'pretty.png'
    })
    expect(getMediaDisplayName(hash)).toBe('pretty.png')
  })
})

describe('getLibraryOptions (integration with getMediaDisplayName)', () => {
  const makeCandidate = (
    overrides: Partial<MissingMediaCandidate> = {}
  ): MissingMediaCandidate => ({
    nodeId: 1,
    nodeType: 'LoadImage',
    widgetName: 'image',
    mediaType: 'image',
    name: 'missing.png',
    isMissing: true,
    ...overrides
  })

  const makeNode = (widgetType: string = 'combo') => ({
    widgets: [
      {
        name: 'image',
        type: widgetType,
        value: '',
        options: {}
      }
    ]
  })

  beforeEach(() => {
    mockedState.inputAssetsByFilename.clear()
    mockedState.getNodeByExecutionId.mockReset()
    mockedState.resolveComboValues.mockReset()
  })

  it('returns empty array when the combo widget cannot be resolved', () => {
    mockedState.getNodeByExecutionId.mockReturnValue(null)
    const { getLibraryOptions } = useMissingMediaInteractions()

    expect(getLibraryOptions(makeCandidate())).toEqual([])
    expect(mockedState.resolveComboValues).not.toHaveBeenCalled()
  })

  it('maps Cloud hash combo values to display_name via the shared helper chain', () => {
    const candidateName = 'blake3:missing.png'
    const hashA = 'blake3:aaa.png'
    const hashB = 'blake3:bbb.png'
    mockedState.inputAssetsByFilename.set(hashA, {
      ...baseAsset,
      name: hashA,
      asset_hash: hashA,
      display_name: 'sunset.png'
    })
    mockedState.inputAssetsByFilename.set(hashB, {
      ...baseAsset,
      name: hashB,
      asset_hash: hashB,
      metadata: { filename: 'beach.png' }
    })
    mockedState.getNodeByExecutionId.mockReturnValue(makeNode())
    mockedState.resolveComboValues.mockReturnValue([
      hashA,
      hashB,
      candidateName
    ])

    const { getLibraryOptions } = useMissingMediaInteractions()
    const options = getLibraryOptions(makeCandidate({ name: candidateName }))

    expect(options).toEqual([
      { name: 'sunset.png', value: hashA },
      { name: 'beach.png', value: hashB }
    ])
  })

  it('passes OSS filename combo values through when no matching asset exists', () => {
    mockedState.getNodeByExecutionId.mockReturnValue(makeNode())
    mockedState.resolveComboValues.mockReturnValue([
      'kitten.png',
      'puppy.png',
      'missing.png'
    ])

    const { getLibraryOptions } = useMissingMediaInteractions()
    const options = getLibraryOptions(makeCandidate({ name: 'missing.png' }))

    expect(options).toEqual([
      { name: 'kitten.png', value: 'kitten.png' },
      { name: 'puppy.png', value: 'puppy.png' }
    ])
  })

  it('filters out the candidate name from the alternatives list', () => {
    mockedState.getNodeByExecutionId.mockReturnValue(makeNode())
    mockedState.resolveComboValues.mockReturnValue([
      'other.png',
      'missing.png',
      'extra.png'
    ])

    const { getLibraryOptions } = useMissingMediaInteractions()
    const options = getLibraryOptions(makeCandidate({ name: 'missing.png' }))

    expect(options.map((o) => o.value)).toEqual(['other.png', 'extra.png'])
  })
})
