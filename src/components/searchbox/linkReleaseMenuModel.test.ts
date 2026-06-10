import type { MenuItem } from 'primevue/menuitem'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'

import {
  buildLinkReleaseMenuItems,
  getLinkReleaseHeaderLabel
} from './linkReleaseMenuModel'
import type {
  LinkReleaseContext,
  LinkReleaseMenuHandlers
} from './linkReleaseMenuModel'

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

function createHandlers(): LinkReleaseMenuHandlers {
  return {
    selectNode: vi.fn(),
    addReroute: vi.fn()
  }
}

const identityT = (key: string) => key

const labelOf = (item: MenuItem) => item.label

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

describe('buildLinkReleaseMenuItems', () => {
  function build(
    options: {
      context?: LinkReleaseContext
      compatibleNodes?: ComfyNodeDefImpl[]
      defaultNodeDefs?: ComfyNodeDefImpl[]
      query?: string
      searchResults?: ComfyNodeDefImpl[]
      handlers?: LinkReleaseMenuHandlers
    } = {}
  ) {
    const handlers = options.handlers ?? createHandlers()
    const items = buildLinkReleaseMenuItems({
      context: options.context ?? createContext(),
      compatibleNodes: options.compatibleNodes ?? [],
      defaultNodeDefs: options.defaultNodeDefs ?? [],
      query: options.query ?? '',
      searchResults: options.searchResults ?? [],
      t: identityT,
      handlers
    })
    return { items, handlers }
  }

  it('renders a disabled slot-type header as the first entry', () => {
    const { items } = build()
    expect(items[0]).toMatchObject({
      label: 'model | MODEL',
      isHeader: true,
      disabled: true
    })
  })

  it('renders a separator then search field after the header', () => {
    const { items } = build()
    expect(items[1]).toMatchObject({ separator: true })
    expect(items[2]).toMatchObject({ isSearch: true })
    expect(items[3]).toMatchObject({ separator: true })
  })

  it('always has Add Reroute as the last item', () => {
    const { items } = build()
    expect(items.at(-1)?.label).toBe('contextMenu.Add Reroute')
  })

  it('Add Reroute remains last when query is non-empty', () => {
    const { items } = build({ query: 'ksampler', searchResults: [ksampler] })
    expect(items.at(-1)?.label).toBe('contextMenu.Add Reroute')
  })

  it('groups Reroute node def immediately before Add Reroute', () => {
    const { items, handlers } = build({
      defaultNodeDefs: [vaeDecode, rerouteNode]
    })
    expect(items.at(-1)?.label).toBe('contextMenu.Add Reroute')
    expect(items.at(-2)?.label).toBe('Reroute')
    expect(items.at(-3)?.separator).toBe(true)

    items.at(-2)?.command?.({} as never)
    expect(handlers.selectNode).toHaveBeenCalledWith(rerouteNode)
  })

  it('excludes Reroute node def from the suggestions section', () => {
    const { items } = build({ defaultNodeDefs: [rerouteNode, vaeDecode] })
    const addRerouteIdx = items.findIndex(
      (i) => i.label === 'contextMenu.Add Reroute'
    )
    const rerouteNodeIdx = items.findIndex((i) => i.label === 'Reroute')
    expect(rerouteNodeIdx).toBeGreaterThan(0)
    expect(rerouteNodeIdx).toBeLessThan(addRerouteIdx)
    expect(items.at(-2)?.label).toBe('Reroute')
  })

  it('groups compatible nodes by source under Comfy Nodes, Extensions, Partner Nodes', () => {
    const ext = customNode('ExtNode', 'Ext Node')
    const partner = partnerNode('PartnerNode', 'Partner Node')

    const { items, handlers } = build({
      compatibleNodes: [ksampler, ext, partner]
    })

    const comfyGroup = items.find((i) => i.label === 'contextMenu.Comfy Nodes')
    const extGroup = items.find((i) => i.label === 'contextMenu.Extensions')
    const partnerGroup = items.find(
      (i) => i.label === 'contextMenu.Partner Nodes'
    )

    expect(comfyGroup?.items?.map((i) => i.label)).toContain('KSampler')
    expect(extGroup?.items?.map((i) => i.label)).toContain('Ext Node')
    expect(partnerGroup?.items?.map((i) => i.label)).toContain('Partner Node')

    comfyGroup?.items
      ?.find((i) => i.label === 'KSampler')
      ?.command?.({} as never)
    expect(handlers.selectNode).toHaveBeenCalledWith(ksampler)
  })

  it('omits empty source groups', () => {
    const { items } = build({ compatibleNodes: [ksampler] })
    const labels = items.map(labelOf)
    expect(labels).toContain('contextMenu.Comfy Nodes')
    expect(labels).not.toContain('contextMenu.Extensions')
    expect(labels).not.toContain('contextMenu.Partner Nodes')
  })

  it('sorts nodes alphabetically within each group', () => {
    const nodeB = coreNode('B')
    const nodeA = coreNode('A')
    const { items } = build({ compatibleNodes: [nodeB, nodeA] })
    const comfyGroup = items.find((i) => i.label === 'contextMenu.Comfy Nodes')
    expect(comfyGroup?.items?.[0]?.label).toBe('A')
    expect(comfyGroup?.items?.[1]?.label).toBe('B')
  })

  it('wires Add Reroute to its handler', () => {
    const { items, handlers } = build()
    items
      .find((i) => i.label === 'contextMenu.Add Reroute')
      ?.command?.({} as never)
    expect(handlers.addReroute).toHaveBeenCalledOnce()
  })

  it('lists suggestions before compatible node groups', () => {
    const { items, handlers } = build({
      defaultNodeDefs: [vaeDecode],
      compatibleNodes: [ksampler]
    })
    const suggestionIdx = items.findIndex((i) => i.label === 'VAE Decode')
    const comfyGroupIdx = items.findIndex(
      (i) => i.label === 'contextMenu.Comfy Nodes'
    )
    const rerouteIdx = items.findIndex(
      (i) => i.label === 'contextMenu.Add Reroute'
    )

    expect(suggestionIdx).toBeGreaterThan(0)
    expect(suggestionIdx).toBeLessThan(comfyGroupIdx)
    expect(comfyGroupIdx).toBeLessThan(rerouteIdx)

    items[suggestionIdx].command?.({} as never)
    expect(handlers.selectNode).toHaveBeenCalledWith(vaeDecode)
  })

  it('has 3 separators with no compatible nodes, 4 with', () => {
    const { items: noCompat } = build({ compatibleNodes: [] })
    expect(noCompat.filter((i) => i.separator).length).toBe(3)

    const { items: withCompat } = build({ compatibleNodes: [ksampler] })
    expect(withCompat.filter((i) => i.separator).length).toBe(4)
  })

  it('shows search results when query is non-empty', () => {
    const { items, handlers } = build({
      query: 'ksampler',
      searchResults: [ksampler]
    })
    const labels = items.map(labelOf)
    expect(labels).not.toContain('contextMenu.Comfy Nodes')
    expect(labels).toContain('KSampler')

    items.find((i) => i.label === 'KSampler')?.command?.({} as never)
    expect(handlers.selectNode).toHaveBeenCalledWith(ksampler)
  })

  it('shows a disabled no-results row when query has no matches', () => {
    const { items } = build({ query: 'nonexistent', searchResults: [] })
    const noResults = items.find((i) => i.label === 'g.noResults')
    expect(noResults).toMatchObject({ disabled: true })
  })
})
