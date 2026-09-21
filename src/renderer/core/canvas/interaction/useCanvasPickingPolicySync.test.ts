import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useCommandPolicyStore } from '@/stores/commandPolicyStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import { useCanvasPickingPolicySync } from './useCanvasPickingPolicySync'

function createCanvas(
  draw: () => void = vi.fn(),
  selectOnly = false
): LGraphCanvas {
  return fromPartial<LGraphCanvas>({ draw, read_only: false, selectOnly })
}

describe('useCanvasPickingPolicySync', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = false
  })

  afterEach(() => scope.stop())

  it('does not make slot reads during drawing reactive dependencies', async () => {
    const node = new LGraphNode('test')
    const slot = node.addInput('input', '*')
    const draw = vi.fn(() => slot.pos)
    useCanvasStore().canvas = createCanvas(draw)

    scope.run(useCanvasPickingPolicySync)

    expect(draw).toHaveBeenCalledOnce()

    slot.pos = [10, 20]
    await nextTick()

    expect(draw).toHaveBeenCalledOnce()
  })

  it('redraws when CanvasInfo or the canvas changes', async () => {
    const firstDraw = vi.fn()
    const secondDraw = vi.fn()
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    canvasStore.canvas = createCanvas(firstDraw)

    scope.run(useCanvasPickingPolicySync)
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(true)
    expect(firstDraw).toHaveBeenCalledTimes(2)

    canvasStore.canvas = createCanvas(secondDraw)
    await nextTick()

    expect(canvasStore.canvas.show_info).toBe(true)
    expect(secondDraw).toHaveBeenCalledOnce()
  })

  it('projects picking onto selectOnly, hides the canvas info and redraws once per change', () => {
    const draw = vi.fn()
    const canvasStore = useCanvasStore()
    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = true
    canvasStore.canvas = createCanvas(draw)
    scope.run(useCanvasPickingPolicySync)
    draw.mockClear()

    useAgentNodeSelectionStore().isActive = true

    expect(canvasStore.canvas.selectOnly).toBe(true)
    expect(canvasStore.canvas.show_info).toBe(false)
    expect(draw).toHaveBeenCalledOnce()

    useAgentNodeSelectionStore().isActive = false

    expect(canvasStore.canvas.selectOnly).toBe(false)
    expect(canvasStore.canvas.show_info).toBe(true)
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('locks graph mutations for the command store exactly while picking', () => {
    useCanvasStore().canvas = createCanvas()
    scope.run(useCanvasPickingPolicySync)

    useAgentNodeSelectionStore().isActive = true

    expect(useCommandPolicyStore().graphMutationsLocked).toBe(true)

    useAgentNodeSelectionStore().isActive = false

    expect(useCommandPolicyStore().graphMutationsLocked).toBe(false)
  })

  it('honours a CanvasInfo toggle made while picking once the mode ends', () => {
    const canvasStore = useCanvasStore()
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = true
    canvasStore.canvas = createCanvas()
    scope.run(useCanvasPickingPolicySync)

    useAgentNodeSelectionStore().isActive = true
    settingStore.settingValues['Comfy.Graph.CanvasInfo'] = false
    useAgentNodeSelectionStore().isActive = false

    expect(canvasStore.canvas.show_info).toBe(false)
  })

  it('keeps the projection and skips redraws when read-only flips mid-pick', () => {
    const draw = vi.fn()
    const canvasStore = useCanvasStore()
    useSettingStore().settingValues['Comfy.Graph.CanvasInfo'] = true
    canvasStore.canvas = createCanvas(draw)
    scope.run(useCanvasPickingPolicySync)
    useAgentNodeSelectionStore().isActive = true
    draw.mockClear()

    canvasStore.isReadOnly = true
    canvasStore.isReadOnly = false

    expect(canvasStore.canvas.selectOnly).toBe(true)
    expect(canvasStore.canvas.show_info).toBe(false)
    expect(draw).not.toHaveBeenCalled()
  })

  it.for([{ initial: false }, { initial: true }])(
    'restores selectOnly=$initial once picking ends',
    ({ initial }) => {
      const canvasStore = useCanvasStore()
      canvasStore.canvas = createCanvas(vi.fn(), initial)
      scope.run(useCanvasPickingPolicySync)

      useAgentNodeSelectionStore().isActive = true

      expect(canvasStore.canvas.selectOnly).toBe(true)

      useAgentNodeSelectionStore().isActive = false

      expect(canvasStore.canvas.selectOnly).toBe(initial)
    }
  )

  it('restores the replaced canvas and pins the new one mid-pick', () => {
    const canvasStore = useCanvasStore()
    const first = createCanvas(vi.fn(), false)
    const second = createCanvas(vi.fn(), true)
    canvasStore.canvas = first
    scope.run(useCanvasPickingPolicySync)
    useAgentNodeSelectionStore().isActive = true

    canvasStore.canvas = second

    expect(first.selectOnly).toBe(false)
    expect(second.selectOnly).toBe(true)

    useAgentNodeSelectionStore().isActive = false

    expect(second.selectOnly).toBe(true)
  })

  it('restores the pre-pick value when two live instances pin the same canvas', () => {
    const canvasStore = useCanvasStore()
    canvasStore.canvas = createCanvas(vi.fn(), false)
    const secondScope = effectScope()
    scope.run(useCanvasPickingPolicySync)
    secondScope.run(useCanvasPickingPolicySync)

    useAgentNodeSelectionStore().isActive = true
    useAgentNodeSelectionStore().isActive = false
    secondScope.stop()

    expect(canvasStore.canvas.selectOnly).toBe(false)
  })

  it('keeps the pin while another live instance still owns it', () => {
    const canvasStore = useCanvasStore()
    canvasStore.canvas = createCanvas(vi.fn(), false)
    const secondScope = effectScope()
    scope.run(useCanvasPickingPolicySync)
    secondScope.run(useCanvasPickingPolicySync)
    useAgentNodeSelectionStore().isActive = true

    scope.stop()

    expect(canvasStore.canvas.selectOnly).toBe(true)

    secondScope.stop()

    expect(canvasStore.canvas.selectOnly).toBe(false)
  })

  it.for([
    { initial: true, written: false },
    { initial: false, written: true }
  ])(
    'reads true after an outside write of $written mid-pick and restores that write on exit',
    ({ initial, written }) => {
      const canvasStore = useCanvasStore()
      canvasStore.canvas = createCanvas(vi.fn(), initial)
      scope.run(useCanvasPickingPolicySync)
      useAgentNodeSelectionStore().isActive = true

      canvasStore.canvas.selectOnly = written

      expect(canvasStore.canvas.selectOnly).toBe(true)

      useAgentNodeSelectionStore().isActive = false

      expect(canvasStore.canvas.selectOnly).toBe(written)
    }
  )

  it('hands selectOnly back to the canvas state once picking ends', () => {
    const canvasElement = document.createElement('canvas')
    canvasElement.getContext = vi
      .fn()
      .mockReturnValue(createMockCanvasRenderingContext2D())
    const canvas = new LGraphCanvas(canvasElement, new LGraph(), {
      skip_render: true
    })
    vi.spyOn(canvas, 'draw').mockImplementation(() => {})
    const canvasStore = useCanvasStore()
    canvasStore.canvas = canvas
    scope.run(useCanvasPickingPolicySync)
    useAgentNodeSelectionStore().isActive = true

    canvas.selectOnly = false

    expect(canvas.selectOnly).toBe(true)
    expect(Object.getOwnPropertyDescriptor(canvas, 'selectOnly')).toBeDefined()

    useAgentNodeSelectionStore().isActive = false
    canvas.selectOnly = true

    expect(
      Object.getOwnPropertyDescriptor(canvas, 'selectOnly')
    ).toBeUndefined()
    expect(canvas.state.selectOnly).toBe(true)
  })

  it('restores selectOnly when the scope stops mid-pick', () => {
    const canvasStore = useCanvasStore()
    canvasStore.canvas = createCanvas()
    scope.run(useCanvasPickingPolicySync)
    useAgentNodeSelectionStore().isActive = true

    scope.stop()

    expect(canvasStore.canvas.selectOnly).toBe(false)
  })
})
