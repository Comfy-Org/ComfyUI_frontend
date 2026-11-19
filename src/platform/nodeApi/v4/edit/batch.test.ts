import { assert, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { EditCore } from '@/platform/nodeApi/v4/edit/edits'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('batch', () => {
  let graph: LGraph
  let comfy: Comfy
  let edit: EditCore
  let handle: NodeHandle
  let node: LGraphNode
  let steps: string[]
  let open: number

  beforeEach(() => {
    graph = new LGraph()
    steps = []
    open = 0
    ;({ comfy, edit } = createComfyApi({
      getGraph: () => graph,
      history: () => ({
        beforeChange: () => {
          if (open++ === 0) steps.push('open')
        },
        afterChange: () => {
          if (--open === 0) steps.push(`capture ${node.title}`)
        }
      })
    }))
    node = new LGraphNode('Start', 'TestNode')
    graph.add(node)
    const found = comfy.graph.node(String(node.id))
    assert(found)
    handle = found
  })

  it('makes one undo step of several edits, captured once they are all made', () => {
    edit.batch(() => {
      handle.setTitle('One')
      handle.setColor('#1')
      handle.setTitle('Two')
    })

    expect(steps).toEqual(['open', 'capture Two'])
  })

  it('returns what the edits return', () => {
    expect(edit.batch(() => handle.setTitle('Done'))).toBe(true)
  })

  it('closes the step and passes the error on when the edits throw, keeping what they did', () => {
    const failure = new Error('pack failed')

    expect(() =>
      edit.batch(() => {
        handle.setTitle('Kept')
        throw failure
      })
    ).toThrow(failure)
    expect(node.title).toBe('Kept')
    expect(steps).toEqual(['open', 'capture Kept'])
    expect(open).toBe(0)
  })

  it('nests inside another batch as part of its step', () => {
    edit.batch(() => {
      edit.batch(() => handle.setTitle('Inner'))
      handle.setTitle('Outer')
    })

    expect(steps).toEqual(['open', 'capture Outer'])
  })

  it.for([
    ['an async function', async () => {}],
    ['nothing', undefined],
    ['a value', 3]
  ])('refuses %s before running anything', ([, edits]) => {
    expect(() => Reflect.apply(edit.batch, undefined, [edits])).toThrow(
      TypeError
    )
    expect(steps).toEqual([])
    expect(open).toBe(0)
  })

  it('keeps edits made before a returned promise, and leaves later ones out of the step', async () => {
    const result = edit.batch(() => {
      handle.setTitle('Before')
      return Promise.resolve().then(() => handle.setTitle('After'))
    })

    expect(steps).toEqual(['open', 'capture Before'])
    await result
    expect(steps).toEqual(['open', 'capture Before', 'open', 'capture After'])
  })

  it('applies edits with no undo history when the host has none', () => {
    const bare = createComfyApi({ getGraph: () => graph })
    const bareHandle = bare.comfy.graph.node(String(node.id))
    assert(bareHandle)

    bare.edit.batch(() => bareHandle.setTitle('Applied'))

    expect(node.title).toBe('Applied')
  })
})
