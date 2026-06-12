import { describe, expect, it } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

import {
  buildLinkReleaseNodeCategories,
  buildLinkReleaseSearchSections,
  computeSubmenuAlignOffset,
  computeSubmenuMaxHeight,
  filterNodesByName,
  getLinkReleaseHeaderLabel,
  getLinkReleaseSuggestions
} from './linkReleaseMenuModel'
import type { LinkReleaseContext } from './linkReleaseMenuModel'

function coreNode(name: string, display_name = name): ComfyNodeDefImpl {
  return {
    name,
    display_name,
    nodeSource: { type: NodeSourceType.Core },
    api_node: false
  } as ComfyNodeDefImpl
}

function customNode(name: string, display_name = name): ComfyNodeDefImpl {
  return {
    name,
    display_name,
    nodeSource: { type: NodeSourceType.CustomNodes },
    api_node: false
  } as ComfyNodeDefImpl
}

function partnerNode(name: string, display_name = name): ComfyNodeDefImpl {
  return {
    name,
    display_name,
    nodeSource: { type: NodeSourceType.Core },
    api_node: true
  } as ComfyNodeDefImpl
}

const ksampler = coreNode('KSampler')
const vaeDecode = coreNode('VAEDecode', 'VAE Decode')
const rerouteNode = coreNode('Reroute')

function createContext(
  overrides: Partial<LinkReleaseContext> = {}
): LinkReleaseContext {
  return {
    dataType: 'MODEL',
    slotName: 'model',
    isFromOutput: true,
    ...overrides
  }
}

describe('getLinkReleaseHeaderLabel', () => {
  it('combines slot name and data type', () => {
    const label = getLinkReleaseHeaderLabel(
      createContext({ slotName: 'model', dataType: 'MODEL' })
    )
    expect(label).toBe('model | MODEL')
  })

  it('falls back to whichever value is present', () => {
    const onlyType = getLinkReleaseHeaderLabel(
      createContext({ slotName: '', dataType: 'IMAGE' })
    )
    const onlyName = getLinkReleaseHeaderLabel(
      createContext({ slotName: 'clip', dataType: '' })
    )
    expect(onlyType).toBe('IMAGE')
    expect(onlyName).toBe('clip')
  })
})

describe('getLinkReleaseSuggestions', () => {
  it('excludes the Reroute node', () => {
    const suggestions = getLinkReleaseSuggestions([rerouteNode, vaeDecode])
    expect(suggestions.map((n) => n.name)).toEqual(['VAEDecode'])
  })

  it('preserves the incoming order of remaining nodes', () => {
    const suggestions = getLinkReleaseSuggestions([vaeDecode, ksampler])
    expect(suggestions.map((n) => n.name)).toEqual(['VAEDecode', 'KSampler'])
  })
})

describe('buildLinkReleaseNodeCategories', () => {
  it('groups nodes by source into comfy, extensions and partner buckets', () => {
    const ext = customNode('ExtNode', 'Ext Node')
    const partner = partnerNode('PartnerNode', 'Partner Node')

    const categories = buildLinkReleaseNodeCategories([ksampler, ext, partner])
    const byKey = Object.fromEntries(categories.map((c) => [c.key, c]))

    expect(byKey.comfy.nodes.map((n) => n.name)).toContain('KSampler')
    expect(byKey.extensions.nodes.map((n) => n.name)).toContain('ExtNode')
    expect(byKey.partner.nodes.map((n) => n.name)).toContain('PartnerNode')
  })

  it('omits empty buckets', () => {
    const categories = buildLinkReleaseNodeCategories([ksampler])
    expect(categories.map((c) => c.key)).toEqual(['comfy'])
  })

  it('orders buckets comfy, extensions, partner', () => {
    const categories = buildLinkReleaseNodeCategories([
      partnerNode('P'),
      customNode('E'),
      coreNode('C')
    ])
    expect(categories.map((c) => c.key)).toEqual([
      'comfy',
      'extensions',
      'partner'
    ])
  })

  it('sorts nodes alphabetically by display name within a bucket', () => {
    const categories = buildLinkReleaseNodeCategories([
      coreNode('B'),
      coreNode('A')
    ])
    expect(categories[0].nodes.map((n) => n.display_name)).toEqual(['A', 'B'])
  })

  it('classifies api-category nodes as partner', () => {
    const apiNode = {
      name: 'ApiThing',
      display_name: 'Api Thing',
      nodeSource: { type: NodeSourceType.Core },
      api_node: false,
      category: 'api node/openai'
    } as ComfyNodeDefImpl

    const categories = buildLinkReleaseNodeCategories([apiNode])
    expect(categories.map((c) => c.key)).toEqual(['partner'])
  })
})

describe('filterNodesByName', () => {
  it('returns all nodes when query is blank', () => {
    expect(filterNodesByName([ksampler, vaeDecode], '  ')).toHaveLength(2)
  })

  it('matches display name case-insensitively', () => {
    const result = filterNodesByName([ksampler, vaeDecode], 'vae')
    expect(result.map((n) => n.name)).toEqual(['VAEDecode'])
  })
})

describe('buildLinkReleaseSearchSections', () => {
  const loadImage = coreNode('LoadImage', 'Load Image')
  const suggestions = getLinkReleaseSuggestions([loadImage, ksampler])
  const categories = buildLinkReleaseNodeCategories([
    loadImage,
    customNode('ImageBlend', 'Image Blend'),
    partnerNode('ImageGen', 'Image Gen'),
    ksampler
  ])

  it('returns no sections for a blank query', () => {
    expect(
      buildLinkReleaseSearchSections(suggestions, categories, '  ')
    ).toEqual([])
  })

  it('shows a node in both Most Relevant and its category section', () => {
    const sections = buildLinkReleaseSearchSections(
      suggestions,
      categories,
      'load image'
    )
    expect(sections[0].key).toBe('suggestions')
    expect(sections[0].nodes.map((n) => n.name)).toContain('LoadImage')
    const comfy = sections.find((s) => s.key === 'comfy')
    expect(comfy?.nodes.map((n) => n.name)).toContain('LoadImage')
  })

  it('orders sections Most Relevant then comfy, extensions, partner', () => {
    const sections = buildLinkReleaseSearchSections(
      suggestions,
      categories,
      'image'
    )
    expect(sections.map((s) => s.key)).toEqual([
      'suggestions',
      'comfy',
      'extensions',
      'partner'
    ])
  })

  it('omits empty sections and returns nothing when no match', () => {
    const sections = buildLinkReleaseSearchSections(
      suggestions,
      categories,
      'ksampler'
    )
    expect(sections.map((s) => s.key)).toEqual(['suggestions', 'comfy'])
    expect(
      buildLinkReleaseSearchSections(suggestions, categories, 'zzz')
    ).toEqual([])
  })
})

describe('computeSubmenuAlignOffset', () => {
  it('lifts the submenu up to the root search field for a trigger below it', () => {
    const offset = computeSubmenuAlignOffset({
      triggerTop: 200,
      rootSearchTop: 48,
      contentPaddingTop: 4
    })
    expect(offset).toBe(-156)
  })

  it('offsets only by the content padding when the trigger sits at the search field', () => {
    const offset = computeSubmenuAlignOffset({
      triggerTop: 48,
      rootSearchTop: 48,
      contentPaddingTop: 4
    })
    expect(offset).toBe(-4)
  })
})

describe('computeSubmenuMaxHeight', () => {
  it('grows to the space below when there is ample room', () => {
    const height = computeSubmenuMaxHeight({
      submenuTop: 100,
      contextMenuHeight: 420,
      viewportHeight: 1000,
      margin: 8
    })
    expect(height).toBe(892)
  })

  it('floors at the context menu height when room below is smaller', () => {
    const height = computeSubmenuMaxHeight({
      submenuTop: 600,
      contextMenuHeight: 420,
      viewportHeight: 1000,
      margin: 8
    })
    expect(height).toBe(420)
  })
})
