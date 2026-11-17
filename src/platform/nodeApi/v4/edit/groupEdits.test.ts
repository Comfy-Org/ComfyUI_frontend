import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, GroupHandle } from '@/platform/nodeApi/v4/types'

describe('group edits', () => {
  let graph: LGraph
  let comfy: Comfy
  let host: ComfyApiHost
  let steps: string[]

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    ;({ comfy, host } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
  })

  function addGroup(
    [x, y, width, height]: number[],
    into: LGraph = graph
  ): LGraphGroup {
    const group = new LGraphGroup('Group')
    group.pos = [x, y]
    group.size = [width, height]
    into.add(group)
    return group
  }

  function handleOf(group: LGraphGroup, of = comfy.graph.groups()) {
    const handle = of?.find((each) => each.id === String(group.id))
    assert(handle)
    return handle
  }

  function boundsOf(group: LGraphGroup) {
    return Array.from(group.boundingRect)
  }

  describe('setBounds', () => {
    it.for([false, true])(
      'moves and resizes the group as one undo step, with Vue nodes %s',
      (vueNodes) => {
        LiteGraph.vueNodesMode = vueNodes
        onTestFinished(() => {
          LiteGraph.vueNodesMode = false
        })
        const group = addGroup([0, 0, 200, 100])
        const version = graph._version

        expect(
          handleOf(group).setBounds({ x: 40, y: 50, width: 300, height: 220 })
        ).toBe(true)

        expect(boundsOf(group)).toEqual([40, 50, 300, 220])
        expect(graph.serialize().groups[0].bounding).toEqual([40, 50, 300, 220])
        expect(handleOf(group).getBounds()).toEqual({
          x: 40,
          y: 50,
          width: 300,
          height: 220
        })
        expect(steps).toEqual(['before', 'after'])
        expect(graph._version).toBeGreaterThan(version)
      }
    )

    it('leaves the nodes inside where they are, and the group’s own list of them, as the editor’s own group resize does', () => {
      const group = addGroup([0, 0, 400, 400])
      const node = new LGraphNode('Inside')
      node.pos = [50, 100]
      node.size = [100, 50]
      graph.add(node)
      const handle = handleOf(group)
      group.recomputeInsideNodes()
      group.move(5, 5)
      expect(Array.from(node.pos)).toEqual([55, 105])
      expect(handle.nodes()?.map((each) => each.getTitle())).toEqual(['Inside'])

      handle.setBounds({ x: 1000, y: 1000, width: 400, height: 400 })

      expect(Array.from(node.pos)).toEqual([55, 105])
      expect(handle.nodes()).toEqual([])
      expect(group.nodes).toEqual([node])

      group.recomputeInsideNodes()
      expect(group.nodes).toEqual([])
    })

    it('raises a size below the editor’s minimum group size to it, as the editor’s resize does', () => {
      const group = addGroup([0, 0, 300, 300])
      const resizedByEditor = addGroup([0, 0, 300, 300])
      resizedByEditor.resize(0, 10)

      expect(
        handleOf(group).setBounds({ x: 1, y: 2, width: 0, height: 10 })
      ).toBe(true)

      expect(boundsOf(group)).toEqual([
        1,
        2,
        LGraphGroup.minWidth,
        LGraphGroup.minHeight
      ])
      expect(boundsOf(group).slice(2)).toEqual(
        boundsOf(resizedByEditor).slice(2)
      )
    })

    it('moves a pinned group, which the editor’s pointer cannot', () => {
      const group = addGroup([0, 0, 200, 100])
      group.pin(true)

      expect(group.resize(500, 500)).toBe(false)
      expect(
        handleOf(group).setBounds({ x: 9, y: 8, width: 500, height: 400 })
      ).toBe(true)
      expect(boundsOf(group)).toEqual([9, 8, 500, 400])
    })

    it('reads each field of the bounds once', () => {
      const group = addGroup([0, 0, 200, 100])
      let reads = 0
      const bounds = {
        get x() {
          reads++
          return reads === 1 ? 10 : Number.NaN
        },
        y: 20,
        width: 300,
        height: 200
      }

      expect(handleOf(group).setBounds(bounds)).toBe(true)
      expect(boundsOf(group)).toEqual([10, 20, 300, 200])
      expect(reads).toBe(1)
    })

    it('edits a group in a subgraph that is not on screen, and not the group on screen', () => {
      const onScreen = addGroup([0, 0, 200, 100])
      const subgraph = createTestSubgraph({ rootGraph: graph })
      graph.subgraphs.set(subgraph.id, subgraph)
      const inner = addGroup([0, 0, 200, 100], subgraph)
      const [scope] = comfy.graph.subgraphs()
      const subgraphVersion = subgraph._version

      expect(
        handleOf(inner, scope.groups()).setBounds({
          x: 70,
          y: 80,
          width: 250,
          height: 150
        })
      ).toBe(true)

      expect(boundsOf(inner)).toEqual([70, 80, 250, 150])
      expect(boundsOf(onScreen)).toEqual([0, 0, 200, 100])
      expect(subgraph._version).toBeGreaterThan(subgraphVersion)
    })
  })

  describe('updateGroup', () => {
    it('is the call setBounds makes', () => {
      const group = addGroup([0, 0, 200, 100])

      expect(
        comfy.edit.updateGroup(handleOf(group), {
          bounds: { x: 3, y: 4, width: 150, height: 90 }
        })
      ).toBe(true)
      expect(boundsOf(group)).toEqual([3, 4, 150, 90])
      expect(steps).toEqual(['before', 'after'])
    })

    it('changes nothing for an empty patch, and says it applied', () => {
      const group = addGroup([5, 6, 200, 100])

      expect(comfy.edit.updateGroup(handleOf(group), {})).toBe(true)
      expect(boundsOf(group)).toEqual([5, 6, 200, 100])
    })
  })

  describe('refusals', () => {
    const fine = { x: 0, y: 0, width: 10, height: 10 }
    const unusable: [string, unknown][] = [
      ['no patch', undefined],
      ['a null patch', null],
      ['a patch that is an array', []],
      ['an unknown field', { title: 'x' }],
      ['bounds left undefined', { bounds: undefined }],
      ['null bounds', { bounds: null }],
      ['bounds that are a number', { bounds: 4 }],
      ['an x that is not finite', { bounds: { ...fine, x: Number.NaN } }],
      ['a y that is not finite', { bounds: { ...fine, y: Infinity } }],
      ['a width that is a string', { bounds: { ...fine, width: '10' } }],
      ['a negative width', { bounds: { ...fine, width: -1 } }],
      ['a negative height', { bounds: { ...fine, height: -0.5 } }],
      ['a missing height', { bounds: { x: 0, y: 0, width: 10 } }]
    ]

    it.for(unusable)('refuses %s before changing anything', ([, patch]) => {
      const group = addGroup([1, 2, 200, 100])
      const version = graph._version

      expect(() =>
        Reflect.apply(comfy.edit.updateGroup, undefined, [
          handleOf(group),
          patch
        ])
      ).toThrow(TypeError)
      expect(boundsOf(group)).toEqual([1, 2, 200, 100])
      expect(graph._version).toBe(version)
      expect(steps).toEqual([])
    })

    it('names the call and the value it could not use', () => {
      const handle = handleOf(addGroup([0, 0, 200, 100]))

      expect(() =>
        Reflect.apply(handle.setBounds, undefined, [{ ...fine, width: -1 }])
      ).toThrow('setBounds needs bounds.width of zero or more, not -1.')
      expect(() =>
        Reflect.apply(handle.setBounds, undefined, [{ ...fine, height: -2 }])
      ).toThrow('setBounds needs bounds.height of zero or more, not -2.')
      expect(() => Reflect.apply(handle.setBounds, undefined, [null])).toThrow(
        'setBounds needs bounds as an object, not null.'
      )
      expect(() =>
        comfy.edit.updateGroup(handle, {
          bounds: { ...fine, y: Number.NaN }
        })
      ).toThrow('updateGroup needs bounds.y as a finite number, not NaN.')
      expect(() =>
        Reflect.apply(comfy.edit.updateGroup, undefined, [
          handle,
          { bounds: fine, color: 'red' }
        ])
      ).toThrow("updateGroup needs fields among bounds, not 'color'.")
    })

    it.for([
      ['nothing', undefined],
      ['an id', '1'],
      ['a look-alike object', { id: '1', isDeleted: false }]
    ])('refuses %s in place of a group handle', ([, notAHandle]) => {
      addGroup([0, 0, 200, 100])

      expect(() =>
        Reflect.apply(comfy.edit.updateGroup, undefined, [
          notAHandle,
          { bounds: fine }
        ])
      ).toThrow('updateGroup needs a group handle')
    })

    it('refuses a node handle, and a group handle another API made', () => {
      const group = addGroup([0, 0, 200, 100])
      const node = new LGraphNode('Node')
      graph.add(node)
      const nodeHandle = comfy.graph.node(String(node.id))
      const other = createComfyApi({ getGraph: () => graph }).comfy

      expect(() =>
        Reflect.apply(comfy.edit.updateGroup, undefined, [
          nodeHandle,
          { bounds: fine }
        ])
      ).toThrow(TypeError)
      expect(() =>
        other.edit.updateGroup(handleOf(group), { bounds: fine })
      ).toThrow(TypeError)
      expect(boundsOf(group)).toEqual([0, 0, 200, 100])
    })
  })

  describe('a group that is gone', () => {
    function removed(): { handle: GroupHandle; kept: LGraphGroup } {
      const group = addGroup([0, 0, 200, 100])
      const kept = addGroup([300, 0, 200, 100])
      const handle = handleOf(group)
      graph.remove(group)
      return { handle, kept }
    }

    it('changes nothing and says so', () => {
      const { handle, kept } = removed()
      const version = graph._version

      expect(handle.setBounds({ x: 9, y: 9, width: 9, height: 9 })).toBe(false)
      expect(boundsOf(kept)).toEqual([300, 0, 200, 100])
      expect(graph._version).toBe(version)
      expect(steps).toEqual([])
    })

    it('still refuses unusable bounds', () => {
      const { handle } = removed()

      expect(() =>
        handle.setBounds({ x: 0, y: 0, width: -1, height: 0 })
      ).toThrow(TypeError)
    })

    it('does not edit another document’s group that reuses its id', () => {
      const group = addGroup([0, 0, 200, 100])
      const handle = handleOf(group)
      graph.remove(group)
      host.beginDocument()
      const reuse = new LGraphGroup('Next', group.id)
      graph.add(reuse)
      reuse.pos = [10, 10]

      expect(handle.setBounds({ x: 50, y: 50, width: 300, height: 300 })).toBe(
        false
      )
      expect(String(reuse.id)).toBe(handle.id)
      expect(boundsOf(reuse).slice(0, 2)).toEqual([10, 10])
      expect(
        handleOf(reuse).setBounds({ x: 50, y: 50, width: 300, height: 300 })
      ).toBe(true)
      expect(boundsOf(reuse)).toEqual([50, 50, 300, 300])
    })
  })
})
