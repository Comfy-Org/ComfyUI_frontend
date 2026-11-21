import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { API_VERSION } from './apiVersion'
import { createComfyApi } from './comfyApi'

describe('the node API root', () => {
  it('reports its version and compares against one', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })
    const [major, minor, patch] = API_VERSION

    expect(comfy.getApiVersion()).toEqual([major, minor, patch])
    expect(comfy.isApiVersionAtLeast(`v${major}.${minor}.${patch}`)).toBe(true)
    expect(comfy.isApiVersionAtLeast(`v${major + 1}.0.0`)).toBe(false)
  })

  it('tells a pack when the host says the app is ready', () => {
    const { comfy, host } = createComfyApi({ getGraph: () => null })
    const listener = vi.fn()
    comfy.onReady(listener)

    host.markReady()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('cannot be changed by a pack', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(Object.isFrozen(comfy)).toBe(true)
    expect(Object.isFrozen(comfy.getApiVersion())).toBe(true)
  })

  it('shares no mutable object between packs through its members', () => {
    const { comfy } = createComfyApi({ getGraph: () => null })

    expect(Reflect.get(comfy.isApiVersionAtLeast, 'prototype')).toBeUndefined()
    expect(() =>
      Reflect.construct(comfy.isApiVersionAtLeast, ['v4.0.0'])
    ).toThrow(TypeError)
  })

  it('gives each instance its own readiness', () => {
    const first = createComfyApi({ getGraph: () => null })
    const second = createComfyApi({ getGraph: () => null })
    const listener = vi.fn()
    second.comfy.onReady(listener)

    first.host.markReady()

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('comparing handles', () => {
  it('says whether two handles are the same entity', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('first'))
    graph.add(new LGraphNode('second'))
    const { comfy } = createComfyApi({ getGraph: () => graph })
    const [first, second] = comfy.graph.nodes()

    expect(comfy.sameEntity(first, comfy.graph.node(first.id))).toBe(true)
    expect(comfy.sameEntity(first, second)).toBe(false)
  })

  it('says no for anything that is not one of its handles', () => {
    const graph = new LGraph()
    graph.add(new LGraphNode('node'))
    const { comfy } = createComfyApi({ getGraph: () => graph })
    const other = createComfyApi({ getGraph: () => graph }).comfy
    const lookalike = { id: '1', graphId: graph.id }

    expect(comfy.sameEntity(lookalike, lookalike)).toBe(false)
    expect(comfy.sameEntity('1', '1')).toBe(false)
    expect(comfy.sameEntity(undefined, undefined)).toBe(false)
    expect(
      comfy.sameEntity(other.graph.nodes()[0], other.graph.nodes()[0])
    ).toBe(false)
  })
})
