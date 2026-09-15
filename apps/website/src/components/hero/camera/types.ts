/**
 * Vendored from jtydhr88/ComfyUI-qwenmultiangle (MIT) — src/types.ts.
 * ComfyUI-specific types removed; `palette` added (local modification).
 */

export interface CameraState {
  azimuth: number
  elevation: number
  distance: number
  imageUrl: string | null
}

/**
 * Colours and toggles for the scene. Defaults reproduce the upstream
 * ComfyUI look; the marketing hero overrides them for a quieter palette.
 */
export interface CameraPalette {
  azimuth: number
  elevation: number
  distance: number
  camera: number
  fill: number
  frame: number
  cardFront: number
  background: number | null
  showGrid: boolean
  showGlowRing: boolean
  showGlows: boolean
}

export interface CameraWidgetOptions {
  container: HTMLElement
  initialState?: Partial<CameraState>
  onStateChange?: (state: CameraState) => void
  palette?: Partial<CameraPalette>
}
