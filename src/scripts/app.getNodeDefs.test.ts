import { beforeEach, describe, expect, test, vi } from 'vitest'

import { mergeCustomNodesI18n, resolveNodeDefText } from '@/i18n'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

vi.mock('@/scripts/api', () => ({
  api: {
    getNodeDefs: vi.fn(),
    apiURL: vi.fn((path: string) => path),
    addEventListener: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn()
  }
}))

function nodeDef(overrides: Partial<ComfyNodeDefV1>): ComfyNodeDefV1 {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    description: '',
    input: {},
    output: [],
    output_node: false,
    python_module: 'test.module',
    ...overrides
  } as ComfyNodeDefV1
}

function mockDefs(...defs: ComfyNodeDefV1[]) {
  const record = Object.fromEntries(defs.map((def) => [def.name, def]))
  vi.mocked(api.getNodeDefs).mockResolvedValue(record)
  return record
}

describe('ComfyApp.getNodeDefs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mergeCustomNodesI18n({})
  })

  test('uses the display name the backend submitted', async () => {
    mockDefs(nodeDef({ display_name: 'Custom Display Name' }))

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Custom Display Name')
  })

  test('leaves an empty display_name unresolved for the store to fill in', async () => {
    mockDefs(nodeDef({ display_name: '' }))

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('')
  })

  test('renders backend names containing i18n syntax verbatim', async () => {
    mockDefs(nodeDef({ display_name: 'Load Image {batch} | v2' }))

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Load Image {batch} | v2')
  })

  // Resolution happens on read, in ComfyNodeDefImpl — see
  // nodeDefStore.nodeText.test.ts. Baking it in here is what froze the text to
  // the fetch-time locale, so the raw value has to survive this layer intact.
  test('hands the store raw text rather than a translation', async () => {
    mergeCustomNodesI18n({
      en: { nodeDefs: { TestNode: { display_name: 'Translated Name' } } }
    })
    mockDefs(nodeDef({ display_name: 'Object Info Display Name' }))

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Object Info Display Name')
  })

  test('publishes backend text for consumers that only know the node name', async () => {
    mockDefs(
      nodeDef({ display_name: 'Published Name', description: 'Published desc' })
    )

    await comfyApp.getNodeDefs()

    expect(resolveNodeDefText('display_name', 'TestNode')).toBe(
      'Published Name'
    )
    expect(resolveNodeDefText('description', 'TestNode')).toBe('Published desc')
  })

  test.for([[null], [undefined], ['a string'], [['x']], [42], [true]])(
    'tolerates a node-def response of %j',
    async ([response]) => {
      vi.mocked(api.getNodeDefs).mockResolvedValue(
        response as unknown as Record<string, ComfyNodeDefV1>
      )

      await expect(comfyApp.getNodeDefs()).resolves.toEqual({})
    }
  )

  test('does not substitute the bundled snapshot for an omitted field', async () => {
    mockDefs(
      nodeDef({
        name: 'CLIPTextEncode',
        display_name: undefined,
        description: ''
      })
    )

    const result = await comfyApp.getNodeDefs()

    expect(result.CLIPTextEncode.display_name).toBeUndefined()
    expect(result.CLIPTextEncode.description).toBe('')
  })

  test('resolves a def without a category to an empty category', async () => {
    mockDefs(nodeDef({ category: undefined as unknown as string }))

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.category).toBe('')
  })

  test('discards malformed entries inside an otherwise valid response', async () => {
    vi.mocked(api.getNodeDefs).mockResolvedValue({
      TestNode: nodeDef({ display_name: 'Good Node' }),
      NullEntry: null,
      NumericCategory: { name: 'NumericCategory', category: 1 },
      NamelessEntry: { category: 'test' },
      StringEntry: 'nope'
    } as unknown as Record<string, ComfyNodeDefV1>)

    const result = await comfyApp.getNodeDefs()

    expect(result.TestNode.display_name).toBe('Good Node')
    expect(result.NumericCategory.category).toBe('')
    expect(Object.keys(result).sort()).toEqual(['NumericCategory', 'TestNode'])
  })
})
