import { createTestingPinia } from '@pinia/testing'
import { clone } from 'es-toolkit/compat'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { mergeCustomNodesI18n, setActiveLocale } from '@/i18n'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

function def(overrides: Partial<ComfyNodeDefV1>): ComfyNodeDefV1 {
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

// `KSampler` is chosen because the shipped zh bundle translates both fields and
// neither translation contains vue-i18n syntax, so a compile failure cannot be
// mistaken for a passing assertion.
const KSAMPLER_EN = 'KSampler'
const KSAMPLER_ZH = 'K采样器'

describe('ComfyNodeDefImpl node text', () => {
  afterEach(async () => {
    await setActiveLocale('en')
    mergeCustomNodesI18n({})
  })

  it('resolves display_name and description against the active locale on every read', async () => {
    const nodeDef = new ComfyNodeDefImpl(
      def({
        name: 'KSampler',
        display_name: KSAMPLER_EN,
        description: 'Backend description'
      })
    )

    expect(nodeDef.display_name).toBe(KSAMPLER_EN)
    expect(nodeDef.description).toBe('Backend description')

    await setActiveLocale('zh')

    // Same instance, never rebuilt from a fresh /object_info fetch.
    expect(nodeDef.display_name).toBe(KSAMPLER_ZH)
    expect(nodeDef.description).toMatch(/^使用提供的模型/)
  })

  // `mergeCustomNodesI18n` merges into the vue-i18n message tree, which clearing
  // the side map does not undo, so this uses a name no other test resolves.
  it('keeps custom-node translations ahead of the backend value', () => {
    mergeCustomNodesI18n({
      en: { nodeDefs: { CustomNode: { display_name: 'Translated Name' } } }
    })

    const nodeDef = new ComfyNodeDefImpl(
      def({ name: 'CustomNode', display_name: 'Object Info Display Name' })
    )

    expect(nodeDef.display_name).toBe('Translated Name')
  })

  it('resolves dotted node names against the normalized key', () => {
    mergeCustomNodesI18n({
      en: { nodeDefs: { my_node: { display_name: 'Dotted Translated' } } }
    })

    const nodeDef = new ComfyNodeDefImpl(
      def({ name: 'my.node', display_name: 'My Node' })
    )

    expect(nodeDef.display_name).toBe('Dotted Translated')
  })

  it('returns an English backend value verbatim rather than compiling it', () => {
    const nodeDef = new ComfyNodeDefImpl(
      def({ display_name: 'Load Image {batch} | v2' })
    )

    expect(nodeDef.display_name).toBe('Load Image {batch} | v2')
  })

  it('falls back to the node name when the backend sends no display_name', () => {
    expect(new ComfyNodeDefImpl(def({ display_name: '' })).display_name).toBe(
      'TestNode'
    )
    expect(new ComfyNodeDefImpl(def({ description: '' })).description).toBe('')
  })

  it('prefers the bundled snapshot when the backend omits the field', () => {
    const nodeDef = new ComfyNodeDefImpl(
      def({ name: 'CLIPTextEncode', display_name: '', description: '' })
    )

    expect(nodeDef.display_name).toBe('CLIP Text Encode (Prompt)')
    expect(nodeDef.description).toMatch(/^Encodes a text prompt/)
  })

  it('constructs from a def carrying display_name without assigning the accessor', () => {
    const build = () =>
      new ComfyNodeDefImpl(
        def({ display_name: 'Assignable?', search_aliases: ['alias'] })
      )

    expect(build).not.toThrow()
    expect(build().search_aliases).toEqual(['alias'])
  })

  // `nodeBookmarkStore.buildBookmarkTree` re-categorises defs via es-toolkit's
  // `clone`. That keeps the prototype, so the accessors survive; a copy that
  // drops it (spread, structuredClone) would blank every bookmark label.
  it('still resolves text after a prototype-preserving clone', () => {
    const nodeDef = new ComfyNodeDefImpl(
      def({ name: 'KSampler', display_name: KSAMPLER_EN })
    )

    const copy = clone(nodeDef)
    copy.category = 'bookmarks'

    expect(copy.display_name).toBe(KSAMPLER_EN)
    expect(copy.nodePath).toBe('bookmarks/KSampler')
  })
})

describe('useNodeDefStore locale reactivity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(async () => {
    await setActiveLocale('en')
  })

  it('re-resolves the search index when the locale changes', async () => {
    const store = useNodeDefStore()
    store.updateNodeDefs([def({ name: 'KSampler', display_name: KSAMPLER_EN })])

    expect(store.nodeSearchService.searchNode(KSAMPLER_EN)).toHaveLength(1)
    expect(store.nodeSearchService.searchNode(KSAMPLER_ZH)).toHaveLength(0)

    await setActiveLocale('zh')

    expect(store.nodeSearchService.searchNode(KSAMPLER_ZH)).toHaveLength(1)
  })

  it('keys nodeDefsByDisplayName by the resolved name', async () => {
    const store = useNodeDefStore()
    await setActiveLocale('zh')
    store.updateNodeDefs([def({ name: 'KSampler', display_name: KSAMPLER_EN })])

    expect(Object.keys(store.nodeDefsByDisplayName)).toEqual([KSAMPLER_ZH])
  })

  it('re-keys nodeDefsByDisplayName when the locale changes after updateNodeDefs', async () => {
    const store = useNodeDefStore()
    store.updateNodeDefs([def({ name: 'KSampler', display_name: KSAMPLER_EN })])

    expect(store.nodeDefsByDisplayName[KSAMPLER_EN]?.name).toBe('KSampler')
    expect(store.nodeDefsByDisplayName[KSAMPLER_ZH]).toBeUndefined()

    await setActiveLocale('zh')

    expect(store.nodeDefsByDisplayName[KSAMPLER_ZH]?.name).toBe('KSampler')
    expect(store.nodeDefsByDisplayName[KSAMPLER_EN]).toBeUndefined()
  })

  it('re-keys allNodeDefsByDisplayName when the locale changes', async () => {
    const store = useNodeDefStore()
    store.updateNodeDefs([def({ name: 'KSampler', display_name: KSAMPLER_EN })])

    expect(store.allNodeDefsByDisplayName[KSAMPLER_EN]?.name).toBe('KSampler')

    await setActiveLocale('zh')

    expect(store.allNodeDefsByDisplayName[KSAMPLER_ZH]?.name).toBe('KSampler')
  })
})
