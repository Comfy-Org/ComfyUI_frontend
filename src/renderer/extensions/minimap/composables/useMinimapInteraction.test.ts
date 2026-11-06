import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'

import { useMinimapInteraction } from '@/renderer/extensions/minimap/composables/useMinimapInteraction'
import type { MinimapCanvas } from '@/renderer/extensions/minimap/types'

describe('useMinimapInteraction', () => {
  let mockContainer: HTMLDivElement
  let mockCanvas: MinimapCanvas
  let centerViewOnMock: (worldX: number, worldY: number) => void

  beforeEach(() => {
    mockContainer = {
      getBoundingClientRect: vi.fn().mockReturnValue({
        left: 100,
        top: 50,
        width: 250,
        height: 200
      })
    } as Partial<HTMLDivElement> as HTMLDivElement

    mockCanvas = {
      ds: {
        scale: 1,
        offset: [0, 0]
      },
      setDirty: vi.fn()
    } as Partial<MinimapCanvas> as MinimapCanvas

    centerViewOnMock = vi.fn<(worldX: number, worldY: number) => void>()
  })

  it('should initialize with default values', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    expect(interaction.isDragging.value).toBe(false)
    expect(interaction.containerRect.value).toEqual({
      left: 0,
      top: 0,
      width: 250,
      height: 200
    })
  })

  it('should update container rect', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    interaction.updateContainerRect()

    expect(mockContainer.getBoundingClientRect).toHaveBeenCalled()

    expect(interaction.containerRect.value).toEqual({
      left: 100,
      top: 50,
      width: 250,
      height: 200
    })
  })

  it('should handle pointer down and start dragging', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    const event = new PointerEvent('pointerdown', {
      clientX: 150,
      clientY: 100
    })

    interaction.handlePointerDown(event)

    expect(interaction.isDragging.value).toBe(true)
    expect(mockContainer.getBoundingClientRect).toHaveBeenCalled()
    expect(centerViewOnMock).toHaveBeenCalled()
  })

  it('should handle pointer move when dragging', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    interaction.handlePointerDown(
      new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 100
      })
    )

    const moveEvent = new PointerEvent('pointermove', {
      clientX: 200,
      clientY: 150
    })

    interaction.handlePointerMove(moveEvent)

    expect(centerViewOnMock).toHaveBeenCalledTimes(2)

    const x = 200 - 100
    const y = 150 - 50
    const offsetX = (250 - 500 * 0.5) / 2
    const offsetY = (200 - 400 * 0.5) / 2
    const worldX = (x - offsetX) / 0.5 + 0
    const worldY = (y - offsetY) / 0.5 + 0

    expect(centerViewOnMock).toHaveBeenLastCalledWith(worldX, worldY)
  })

  it('should not move when not dragging', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    const moveEvent = new PointerEvent('pointermove', {
      clientX: 200,
      clientY: 150
    })

    interaction.handlePointerMove(moveEvent)

    expect(centerViewOnMock).not.toHaveBeenCalled()
  })

  it('should handle pointer up to stop dragging', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    interaction.handlePointerDown(
      new PointerEvent('pointerdown', {
        clientX: 150,
        clientY: 100
      })
    )

    expect(interaction.isDragging.value).toBe(true)

    interaction.handlePointerUp()

    expect(interaction.isDragging.value).toBe(false)
  })

  it('should handle wheel events for zooming', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      clientX: 200,
      clientY: 150
    })
    wheelEvent.preventDefault = vi.fn()

    interaction.handleWheel(wheelEvent)

    expect(mockCanvas.ds.scale).toBeCloseTo(1.1)
    expect(centerViewOnMock).toHaveBeenCalled()
  })

  it('should respect zoom limits', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    mockCanvas.ds.scale = 0.11

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      clientX: 200,
      clientY: 150
    })
    wheelEvent.preventDefault = vi.fn()

    interaction.handleWheel(wheelEvent)

    expect(mockCanvas.ds.scale).toBe(0.11)
    expect(centerViewOnMock).not.toHaveBeenCalled()
  })

  it('should handle null container gracefully', () => {
    const containerRef = ref<HTMLDivElement | null>(null)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef(mockCanvas)

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    expect(() => interaction.updateContainerRect()).not.toThrow()
    expect(() =>
      interaction.handlePointerDown(new PointerEvent('pointerdown'))
    ).not.toThrow()
  })

  it('should handle an absent canvas gracefully', () => {
    const containerRef = ref(mockContainer)
    const boundsRef = ref({ minX: 0, minY: 0, width: 500, height: 400 })
    const scaleRef = ref(0.5)
    const canvasRef = shallowRef<MinimapCanvas>()

    const interaction = useMinimapInteraction(
      containerRef,
      boundsRef,
      scaleRef,
      250,
      200,
      centerViewOnMock,
      canvasRef
    )

    expect(() =>
      interaction.handlePointerMove(new PointerEvent('pointermove'))
    ).not.toThrow()
    expect(() => interaction.handleWheel(new WheelEvent('wheel'))).not.toThrow()
    expect(centerViewOnMock).not.toHaveBeenCalled()
  })
})
