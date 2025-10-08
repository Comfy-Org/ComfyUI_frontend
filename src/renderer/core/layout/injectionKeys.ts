import type { InjectionKey } from 'vue'

import type { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

/**
 * Lightweight, injectable transform state used by layout-aware components.
 *
 * Consumers use this interface to convert coordinates between LiteGraph's
 * canvas space and the DOM's screen space, access the current pan/zoom
 * (camera), and perform basic viewport culling checks.
 *
 * Coordinate mapping:
 * - screen = (canvas + offset) * scale
 * - canvas = screen / scale - offset
 *
 * The full implementation and additional helpers live in
 * `useTransformState()`. This interface deliberately exposes only the
 * minimal surface needed outside that composable.
 *
 * @example
 * const state = inject(TransformStateKey)!
 * const screen = state.canvasToScreen({ x: 100, y: 50 })
 */
export interface TransformState
  extends Pick<
    ReturnType<typeof useTransformState>,
    'screenToCanvas' | 'canvasToScreen' | 'camera' | 'isNodeInViewport'
  > {}

export const TransformStateKey: InjectionKey<TransformState> =
  Symbol('transformState')
