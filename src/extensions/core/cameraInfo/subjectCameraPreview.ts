import * as THREE from 'three'

export const PREVIEW_WIDTH = 200
export const PREVIEW_HEIGHT = 150
const PREVIEW_PADDING = 8
const PREVIEW_BORDER_COLOR = 0x2a2a2a
const PREVIEW_BACKGROUND_COLOR = 0x0a0a0a

interface Hideable {
  isVisible(): boolean
  setVisible(visible: boolean): void
}

type PreviewRenderer = Pick<
  THREE.WebGLRenderer,
  'setViewport' | 'setScissor' | 'setScissorTest' | 'setClearColor' | 'clear'
> & { render(scene: THREE.Object3D, camera: THREE.Camera): void }

interface InsetPreviewLayout {
  width: number
  height: number
  marginRight: number
  marginBottom: number
}

export interface InsetPreviewTarget {
  renderer: PreviewRenderer
  canvas: { width: number; height: number }
  scene: THREE.Scene
  camera: THREE.Camera
  hidden: readonly Hideable[]
  layout?: Partial<InsetPreviewLayout>
  borderColor?: THREE.ColorRepresentation
  backgroundColor?: THREE.ColorRepresentation
}

export function fitCameraAspect(camera: THREE.Camera, aspect: number): void {
  if (!Number.isFinite(aspect) || aspect <= 0) return
  if (camera instanceof THREE.PerspectiveCamera) {
    if (Math.abs(camera.aspect - aspect) < 1e-4) return
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    return
  }
  if (camera instanceof THREE.OrthographicCamera) {
    const half = (camera.top - camera.bottom) / 2 || 1
    const left = -half * aspect
    const right = half * aspect
    if (
      Math.abs(camera.left - left) < 1e-4 &&
      Math.abs(camera.right - right) < 1e-4
    )
      return
    camera.left = left
    camera.right = right
    camera.updateProjectionMatrix()
  }
}

function withPreviewAspect(
  camera: THREE.Camera,
  aspect: number,
  render: () => void
): void {
  if (camera instanceof THREE.PerspectiveCamera) {
    const saved = camera.aspect
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    render()
    camera.aspect = saved
    camera.updateProjectionMatrix()
    return
  }
  if (camera instanceof THREE.OrthographicCamera) {
    const { left, right, top, bottom } = camera
    const half = (top - bottom) / 2 || 1
    camera.left = -half * aspect
    camera.right = half * aspect
    camera.top = half
    camera.bottom = -half
    camera.updateProjectionMatrix()
    render()
    Object.assign(camera, { left, right, top, bottom })
    camera.updateProjectionMatrix()
    return
  }
  render()
}

export function renderInsetPreview({
  renderer,
  canvas,
  scene,
  camera,
  hidden,
  layout,
  borderColor = PREVIEW_BORDER_COLOR,
  backgroundColor = PREVIEW_BACKGROUND_COLOR
}: InsetPreviewTarget): void {
  const width = layout?.width ?? PREVIEW_WIDTH
  const height = layout?.height ?? PREVIEW_HEIGHT
  const marginRight = layout?.marginRight ?? PREVIEW_PADDING
  const marginBottom = layout?.marginBottom ?? PREVIEW_PADDING
  if (
    width <= 0 ||
    height <= 0 ||
    canvas.width < width + marginRight * 2 ||
    canvas.height < height + marginBottom + PREVIEW_PADDING
  ) {
    return
  }

  const restore = hidden
    .filter((item) => item.isVisible())
    .map((item) => () => item.setVisible(true))
  for (const item of hidden) item.setVisible(false)

  const x = canvas.width - width - marginRight
  const y = marginBottom

  withPreviewAspect(camera, width / height, () => {
    renderer.setViewport(x - 1, y - 1, width + 2, height + 2)
    renderer.setScissor(x - 1, y - 1, width + 2, height + 2)
    renderer.setScissorTest(true)
    renderer.setClearColor(borderColor)
    renderer.clear()

    renderer.setViewport(x, y, width, height)
    renderer.setScissor(x, y, width, height)
    renderer.setClearColor(backgroundColor)
    renderer.clear()
    renderer.render(scene, camera)
  })

  for (const restoreItem of restore) restoreItem()
}
