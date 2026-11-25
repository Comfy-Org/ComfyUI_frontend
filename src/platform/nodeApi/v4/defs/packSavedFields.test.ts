import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
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

    it('finds fields saved without verification under its folder, and moves them to the id on save', () => {
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
        extensions: { 'folder:Beta_Folder': { state: 'saved by folder' } }
      })

      expect(received).toEqual([
        expect.objectContaining({ type: HOST_TYPE, state: 'saved by folder' })
      ])
      expect(node.serialize().extensions).toEqual({ beta: { state: 'now' } })
    })

    it('moves a folder entry it read to the id when a save writes nothing new, and the reopened workflow reads it there', () => {
      const [beta] = served(BETA)
      const received: unknown[] = []
      api.comfy.defs.extend(beta, HOST_TYPE, (builder) =>
        builder.onConfigured((_, data) => received.push(data.state))
      )
      const node = added(HOST_TYPE)
      node.configure({
        ...node.serialize(),
        extensions: { 'folder:Beta_Folder': { state: 'saved by folder' } }
      })

      const saved = JSON.parse(JSON.stringify(node.serialize()))
      added(HOST_TYPE).configure(saved)

      expect(saved.extensions).toEqual({ beta: { state: 'saved by folder' } })
      expect(received).toEqual(['saved by folder', 'saved by folder'])
    })

    it.for([
      {
        name: 'a pack that is not installed, named like this pack’s folder',
        extensions: { beta_folder: { owner: 'an absent pack' } }
      },
      {
        name: 'another verified pack, named like this pack’s folder',
        extensions: { beta_folder: { owner: 'the other pack' } },
        others: [{ segment: 'other', id: 'beta_folder', version: null }]
      },
      {
        name: 'the folder in another case',
        extensions: { 'folder:beta_folder': { owner: 'another folder' } }
      }
    ])(
      'neither reads nor moves the entry of $name',
      ({ extensions, others = [] }) => {
        const [beta] = served(BETA, ...others)
        const received: Readonly<Record<string, unknown>>[] = []
        api.comfy.defs.extend(beta, HOST_TYPE, (builder) => {
          builder.onConfigured((_, data) => received.push(data))
          builder.onSerialize(() => ({ state: 'beta' }))
        })
        const node = added(HOST_TYPE)

        node.configure({ ...node.serialize(), extensions })

        expect(received).toHaveLength(1)
        expect(received[0]).not.toHaveProperty('owner')
        expect(node.serialize().extensions).toEqual({
          ...extensions,
          beta: { state: 'beta' }
        })
      }
    )

    it('saves under the folder as served against a backend that does not verify, apart from a folder named in another case', () => {
      api.host.providePacks(undefined)
      const saves = ['Beta_Folder', 'beta_folder'].map((segment) => {
        const packId = api.comfy.registerPack({ url: moduleUrl(segment) })
        api.comfy.defs.extend(packId, HOST_TYPE, (builder) =>
          builder.onSerialize(() => ({ state: segment }))
        )
        return packId
      })

      expect(saves[0]).not.toBe(saves[1])
      expect(added(HOST_TYPE).serialize().extensions).toEqual({
        'folder:Beta_Folder': { state: 'Beta_Folder' },
        'folder:beta_folder': { state: 'beta_folder' }
      })
    })

    it('reads, without verification, only the entry its own folder saved', () => {
      api.host.providePacks(undefined)
      const packId = api.comfy.registerPack({ url: moduleUrl('Beta_Folder') })
      const received: unknown[] = []
      api.comfy.defs.extend(packId, HOST_TYPE, (builder) =>
        builder.onConfigured((_, data) => received.push(data.state))
      )
      const node = added(HOST_TYPE)

      node.configure({
        ...node.serialize(),
        extensions: {
          beta_folder: { state: 'a pack with that id' },
          'folder:beta_folder': { state: 'another folder' },
          'folder:Beta_Folder': { state: 'its own' }
        }
      })

      expect(received).toEqual(['its own'])
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
        extensions: {
          'folder:Beta_Folder': { from: 'folder' },
          beta: { from: 'id' }
        }
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

    it('lets a pack’s own entry override the node’s fields and a legacy field in its own view only', () => {
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
        title: 'not the node’s',
        myState: 'from V4',
        legacyOnly: 1
      })
      expect(node.title).toBe('Own')
      expect(received[0]).not.toHaveProperty('other')
      expect(received[0]).not.toHaveProperty('secret')
      expect(received[0]).not.toHaveProperty('extensions')
    })

    it('keeps saving a field the host later starts to save on the node, as showAdvanced', () => {
      const [beta] = served(BETA)
      let level = 2
      const heard: unknown[] = []
      api.comfy.defs.extend(beta, HOST_TYPE, (builder) => {
        builder.onSerialize(() => ({ level, showAdvanced: 'mine' }))
        builder.onConfigured((_, data) =>
          heard.push([data.level, data.showAdvanced])
        )
      })
      const node = added(HOST_TYPE)
      node.configure({
        ...node.serialize(),
        extensions: { beta: { level: 1, showAdvanced: 'mine' } }
      })
      level = 3

      const saved = node.serialize()

      expect(heard).toEqual([[1, 'mine']])
      expect(saved.extensions).toEqual({
        beta: { level: 3, showAdvanced: 'mine' }
      })
      expect(saved.showAdvanced).not.toBe('mine')
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

    it.for(['7.8', '0.0.1.0'])(
      'stamps no version %s the workflow schema refuses, so the saved workflow still validates',
      async (version) => {
        const [gamma] = served({ segment: 'gamma', id: 'gamma', version })
        api.comfy.defs.define(gamma, { type: 'Gamma/Stamped' })
        const { properties } = added('Gamma/Stamped')

        const saved = JSON.parse(JSON.stringify(graph.serialize()))

        expect(properties.cnr_id).toBe('gamma')
        expect(properties).not.toHaveProperty('ver')
        expect(await validateComfyWorkflow(saved)).not.toBeNull()
      }
    )

    it('keeps the pack properties a workflow saved as one unit, adding no stamped one it lacks', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.define(alpha, { type: 'Alpha/Stamped' })
      added('Alpha/Stamped')
      const saved = graph.serialize()
      saved.nodes[0].properties = { cnr_id: 'renamed-pack' }
      const loaded = new LGraph()

      loaded.configure(saved)

      expect(onlyNode(loaded).properties).toEqual({ cnr_id: 'renamed-pack' })
    })

    it('gives onConfigured the pack properties the workflow saved, without a stamped one it lacks', () => {
      const [alpha] = served(ALPHA)
      const read: unknown[] = []
      api.comfy.defs.define(alpha, {
        type: 'Alpha/Stamped',
        onConfigured: (node) => read.push(node.getProperties())
      })
      added('Alpha/Stamped')
      const saved = graph.serialize()
      saved.nodes[0].properties = { cnr_id: 'renamed-pack' }

      new LGraph().configure(saved)

      expect(read).toEqual([{ cnr_id: 'renamed-pack' }])
    })

    it('fills the stamp into a node a workflow saved with no pack property', () => {
      const [alpha] = served(ALPHA)
      api.comfy.defs.define(alpha, { type: 'Alpha/Stamped' })
      added('Alpha/Stamped')
      const saved = graph.serialize()
      saved.nodes[0].properties = {}
      const loaded = new LGraph()

      loaded.configure(saved)

      expect(onlyNode(loaded).properties).toEqual({
        cnr_id: 'pack-alpha',
        ver: '2.1.0'
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
