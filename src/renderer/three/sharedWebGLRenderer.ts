import * as THREE from 'three'

import type { FxaaResolve } from './highPrecisionOutput'
import {
  createFxaaResolve,
  createHighPrecisionTarget,
  ensureTargetSize
} from './highPrecisionOutput'

export type RendererViewState = {
  toneMapping: THREE.ToneMapping
  toneMappingExposure: number
  outputColorSpace: THREE.ColorSpace
  clearColor: THREE.Color
  clearAlpha: number
}

export function createRendererViewState(): RendererViewState {
  return {
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
    clearColor: new THREE.Color(0x000000),
    clearAlpha: 0
  }
}

export function applyRendererViewState(
  renderer: THREE.WebGLRenderer,
  state: RendererViewState
): void {
  renderer.toneMapping = state.toneMapping
  renderer.toneMappingExposure = state.toneMappingExposure
  renderer.outputColorSpace = state.outputColorSpace
  renderer.setClearColor(state.clearColor, state.clearAlpha)
}

export type SharedRendererHandle = {
  renderer: THREE.WebGLRenderer
  release: () => void
}

let sharedRenderer: THREE.WebGLRenderer | null = null
let viewCount = 0
let sharedHighPrecisionTarget: THREE.WebGLRenderTarget | null = null
let sharedFxaaResolve: FxaaResolve | null = null

function createSharedRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(1)
  renderer.setSize(300, 300)
  renderer.autoClear = false
  renderer.outputColorSpace = THREE.SRGBColorSpace
  return renderer
}

export function acquireSharedRenderer(): SharedRendererHandle {
  sharedRenderer ??= createSharedRenderer()
  viewCount++
  const renderer = sharedRenderer
  let released = false
  return {
    renderer,
    release() {
      if (released) return
      released = true
      viewCount--
      if (viewCount > 0 || sharedRenderer !== renderer) return
      sharedRenderer = null
      sharedHighPrecisionTarget?.dispose()
      sharedHighPrecisionTarget = null
      sharedFxaaResolve?.dispose()
      sharedFxaaResolve = null
      renderer.forceContextLoss()
      renderer.domElement.dispatchEvent(
        new Event('webglcontextlost', { bubbles: true, cancelable: true })
      )
      renderer.dispose()
    }
  }
}

export function ensureRendererSize(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number
): void {
  const size = renderer.getSize(new THREE.Vector2())
  if (size.width >= width && size.height >= height) return
  renderer.setSize(Math.max(size.width, width), Math.max(size.height, height))
}

export function ensureSharedHighPrecisionTarget(
  width: number,
  height: number
): THREE.WebGLRenderTarget {
  sharedHighPrecisionTarget ??= createHighPrecisionTarget()
  ensureTargetSize(sharedHighPrecisionTarget, width, height)
  return sharedHighPrecisionTarget
}

export function resolveHighPrecisionTarget(
  renderer: THREE.WebGLRenderer,
  source: THREE.WebGLRenderTarget,
  width: number,
  height: number
): void {
  sharedFxaaResolve ??= createFxaaResolve()
  sharedFxaaResolve.render(renderer, source, width, height)
}
