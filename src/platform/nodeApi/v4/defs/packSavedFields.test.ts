import { assert, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'
import type { PackId } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { moduleUrl } from '@/platform/nodeApi/v4/__tests__/testPack'
import { hostNodeDef, registerHostType } from './__fixtures__/hostNodeTypes'

const HOST_TYPE = 'Host/Sampler'

const ALPHA: ServedPack = {
  segment: 'alpha',
  id: 'pack-alpha',
  version: '2.1.0'
}
const BETA: ServedPack = { segment: 'Beta_Folder', id: 'beta', version: null }

describe('a pack’s saved fields and identity', () => {
  let graph: LGraph
  let api: ComfyApi

  beforeEach(() => {
    graph = new LGraph()
    api = createComfyApi({ getGraph: () => graph })
    registerHostType(api.host.nodeTypeHooks, hostNodeDef(HOST_TYPE))
  })

  function served(...packs: ServedPack[]): PackId[] {
    api.host.providePacks(packs)
    return packs.map(({ segment }) =>
      api.comfy.registerPack({ url: moduleUrl(segment) })
    )
  }

  function added(type: string, target = graph): LGraphNode {
    const node = LiteGraph.createNode(type)
    assert(node)
    target.add(node)
    return node
  }

  function reloaded(from = graph): LGraph {
    const saved = JSON.parse(JSON.stringify(from.serialize()))
    const loaded = new LGraph()
    loaded.configure(saved)
    return loaded
  }

  function onlyNode(of: LGraph): LGraphNode {
    const [node] = of.nodes
    assert(node)
    return node
  }

  describe('saved fields', () => {
    it('saves under the pack’s id and gives each pack the saved node with only its own fields', () => {
      const [alpha, beta] = served(ALPHA, BETA)
      const received: Record<string, Readonly<Record<string, unknown>>[]> = {
        alpha: [],
        beta: []
      }
      api.comfy.defs.extend(alpha, HOST_TYPE, (builder) => {
        builder.onSerialize(() => ({ state: 'from alpha' }))
        builder.onConfigured((_, data) => received.alpha.push(data))
      })
      api.comfy.defs.extend(beta, HOST_TYPE, (builder) => {
        builder.onSerialize(() => ({ state: 'from beta' }))
        builder.onConfigured((_, data) => received.beta.push(data))
      })
      added(HOST_TYPE)

      const [saved] = graph.serialize().nodes
      reloaded()

      expect(saved.extensions).toEqual({
        'pack-alpha': { state: 'from alpha' },
        beta: { state: 'from beta' }
      })
      expect(saved).not.toHaveProperty('state')
      expect(received.alpha).toEqual([
        expect.objectContaining({ type: HOST_TYPE, state: 'from alpha' })
      ])
      expect(received.beta).toEqual([
        expect.objectContaining({ type: HOST_TYPE, state: 'from beta' })
      ])
      for (const data of [...received.alpha, ...received.beta]) {
        expect(data).not.toHaveProperty('extensions')
        expect(data).not.toHaveProperty('pack-alpha')
        expect(data).not.toHaveProperty('beta')
      }
    })

    it('keeps saved fields off the node, so they cannot change what it is', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.extend(alpha, HOST_TYPE, (builder) =>
        builder.onSerialize(() => ({
          isVirtualNode: true,
          comfyClass: 'Other',
          resizable: false
        }))
      )
      added(HOST_TYPE)

      const node = onlyNode(reloaded())

      expect(node.isVirtualNode).not.toBe(true)
      expect(node.comfyClass).not.toBe('Other')
      expect(node.resizable).not.toBe(false)
      expect(node.serialize().extensions).toEqual({
        'pack-alpha': {
          isVirtualNode: true,
          comfyClass: 'Other',
          resizable: false
        }
      })
    })

    it('keeps a defined type unresizable through a save and a load, whatever a pack saves', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.define(alpha, {
        type: 'Alpha/Fixed',
        presentation: { resizable: false }
      })
      api.comfy.defs.extend(alpha, 'Alpha/Fixed', (builder) =>
        builder.onSerialize(() => ({ resizable: true }))
      )
      expect(added('Alpha/Fixed').resizable).toBe(false)

      const node = onlyNode(reloaded())

      expect(node.resizable).toBe(false)
      expect(onlyNode(reloaded(reloaded())).resizable).toBe(false)
    })

    it('finds fields an older backend saved under the folder, and saves them under the id', () => {
      const [beta] = served(BETA)
      const received: unknown[] = []
      api.comfy.defs.extend(beta, HOST_TYPE, (builder) => {
        builder.onConfigured((_, data) => {
          received.push(data)
        })
        builder.onSerialize(() => ({ state: 'now' }))
      })
      const node = added(HOST_TYPE)

      node.configure({
        ...node.serialize(),
        extensions: { beta_folder: { state: 'saved by folder' } }
      })

      expect(received).toEqual([
        expect.objectContaining({ type: HOST_TYPE, state: 'saved by folder' })
      ])
      expect(node.serialize().extensions).toMatchObject({
        beta: { state: 'now' }
      })
    })

    it('prefers the entry under the id to the one under the folder', () => {
      const [beta] = served(BETA)
      const received: unknown[] = []
      api.comfy.defs.extend(beta, HOST_TYPE, (builder) =>
        builder.onConfigured((_, data) => received.push(data))
      )
      const node = added(HOST_TYPE)

      node.configure({
        ...node.serialize(),
        extensions: { beta_folder: { from: 'folder' }, beta: { from: 'id' } }
      })

      expect(received).toEqual([expect.objectContaining({ from: 'id' })])
    })

    it('gives a pack converted from V1 what its V1 version saved on the node, and saves its own under its id', () => {
      const [alpha] = served(ALPHA)
      const received: Readonly<Record<string, unknown>>[] = []
      api.comfy.defs.extend(alpha, HOST_TYPE, (builder) => {
        builder.onConfigured((_, data) => received.push(data))
        builder.onSerialize(() => ({ converted: true }))
      })
      const old = new LGraph()
      added(HOST_TYPE, old)
      const workflow = JSON.parse(JSON.stringify(old.serialize()))
      workflow.nodes[0].myState = { level: 3 }
      delete workflow.nodes[0].extensions
      const loaded = new LGraph()

      loaded.configure(workflow)

      expect(received).toEqual([
        expect.objectContaining({ type: HOST_TYPE, myState: { level: 3 } })
      ])
      expect(received[0]).not.toHaveProperty('extensions')
      const saved = onlyNode(loaded).serialize()
      expect(saved).toHaveProperty('myState', { level: 3 })
      expect(saved.extensions).toMatchObject({
        'pack-alpha': { converted: true }
      })
    })

    it('lets a pack’s own entry override a legacy field, and the node’s own fields win over both', () => {
      const [alpha] = served(ALPHA)
      const received: Readonly<Record<string, unknown>>[] = []
      api.comfy.defs.extend(alpha, HOST_TYPE, (builder) =>
        builder.onConfigured((_, data) => received.push(data))
      )
      const node = added(HOST_TYPE)

      const saved = {
        ...node.serialize(),
        title: 'Own',
        myState: 'from V1',
        legacyOnly: 1,
        extensions: {
          'pack-alpha': { myState: 'from V4', title: 'not the node’s' },
          other: { secret: true }
        }
      }

      node.configure(saved)

      expect(received[0]).toMatchObject({
        title: 'Own',
        myState: 'from V4',
        legacyOnly: 1
      })
      expect(received[0]).not.toHaveProperty('other')
      expect(received[0]).not.toHaveProperty('secret')
      expect(received[0]).not.toHaveProperty('extensions')
    })

    it('keeps the entry of a pack that is not loaded through a save and a load', () => {
      added(HOST_TYPE)
      const saved = graph.serialize()
      saved.nodes[0].extensions = { absent: { kept: true } }
      const loaded = new LGraph()
      loaded.configure(saved)

      expect(onlyNode(loaded).serialize().extensions).toEqual({
        absent: { kept: true }
      })
      expect(onlyNode(loaded)).not.toHaveProperty('kept')
    })
  })

  describe('stamping a defined type’s nodes', () => {
    it('stamps the pack’s id and version on each node as it is made', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.define(alpha, { type: 'Alpha/Stamped' })

      expect(added('Alpha/Stamped').properties).toMatchObject({
        cnr_id: 'pack-alpha',
        ver: '2.1.0'
      })
    })

    it('stamps no version for a pack whose pyproject has none', () => {
      const [beta] = served(BETA)
      api.comfy.defs.define(beta, { type: 'Beta/Stamped' })

      const { properties } = added('Beta/Stamped')

      expect(properties.cnr_id).toBe('beta')
      expect(properties).not.toHaveProperty('ver')
    })

    it('lets a saved workflow’s values replace the stamp on load', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.define(alpha, { type: 'Alpha/Stamped' })
      added('Alpha/Stamped')
      const saved = graph.serialize()
      saved.nodes[0].properties = { cnr_id: 'older-name', ver: '0.9.0' }
      const loaded = new LGraph()

      loaded.configure(saved)

      expect(onlyNode(loaded).properties).toMatchObject({
        cnr_id: 'older-name',
        ver: '0.9.0'
      })
    })

    it('stamps nothing for a pack the backend did not verify', () => {
      api.host.providePacks(undefined)
      const packId = api.comfy.registerPack({ url: moduleUrl('Unverified') })
      api.comfy.defs.define(packId, { type: 'Unverified/Node' })

      const { properties } = added('Unverified/Node')

      expect(properties).not.toHaveProperty('cnr_id')
      expect(properties).not.toHaveProperty('ver')
    })
  })

  describe('the properties that name a pack', () => {
    it.for(['cnr_id', 'aux_id', 'ver'])(
      'refuses a pack’s setProperty of %s and leaves it',
      (name) => {
        const [alpha] = served(ALPHA)
        api.comfy.defs.define(alpha, { type: 'Alpha/Guarded' })
        const node = added('Alpha/Guarded')
        const handle = api.comfy.graph.node(String(node.id))
        assert(handle)
        const before = { ...node.properties }

        expectRefusal(() => handle.setProperty(name, 'edited'), 'setProperty')
        expectRefusal(() => handle.setProperty(name, undefined), 'setProperty')
        expect(node.properties).toEqual(before)
      }
    )

    it('refuses a hook’s setValue of a restored pack property', () => {
      const [alpha] = served(ALPHA)
      const refusals: unknown[] = []
      api.comfy.defs.define(alpha, {
        type: 'Alpha/Guarded',
        onPropertyChanged(_, event) {
          if (event.name !== 'cnr_id') return
          try {
            event.setValue('edited')
          } catch (error) {
            refusals.push(error)
          }
        }
      })
      const node = added('Alpha/Guarded')

      node.configure({ ...node.serialize(), properties: { cnr_id: 'saved' } })

      expect(refusals).toEqual([expect.any(TypeError)])
      expect(node.properties.cnr_id).toBe('saved')
    })
  })
})
