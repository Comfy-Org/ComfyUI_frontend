import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import Load3DMenuBar from '@/components/load3d/Load3DMenuBar.vue'
import type {
  CameraConfig,
  LightConfig,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function makeSceneConfig(): SceneConfig {
  return {
    showGrid: true,
    backgroundColor: '#000000',
    backgroundImage: '',
    backgroundRenderMode: 'tiled'
  }
}

function makeModelConfig(): ModelConfig {
  return {
    upDirection: 'original',
    materialMode: 'original',
    showSkeleton: false,
    gizmo: {
      enabled: false,
      mode: 'translate',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }
}

function makeCameraConfig(): CameraConfig {
  return { cameraType: 'perspective', fov: 75 }
}

function makeLightConfig(): LightConfig {
  return {
    intensity: 5,
    hdri: {
      enabled: false,
      hdriPath: '',
      showAsBackground: false,
      intensity: 1
    }
  }
}

type RenderProps = Partial<ComponentProps<typeof Load3DMenuBar>>

function renderMenuBar(overrides: RenderProps = {}) {
  const result = render(Load3DMenuBar, {
    props: {
      sceneConfig: makeSceneConfig(),
      modelConfig: makeModelConfig(),
      cameraConfig: makeCameraConfig(),
      lightConfig: makeLightConfig(),
      ...overrides
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })
  return { ...result, user: userEvent.setup() }
}

async function selectCategory(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await openCategoryMenu(user)
  await user.click(screen.getByRole('button', { name: label }))
}

async function openCategoryMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Scene/ }))
}

describe('Load3DMenuBar', () => {
  it('shows scene controls by default', () => {
    renderMenuBar()
    expect(
      screen.getByRole('button', { name: 'Show grid' })
    ).toBeInTheDocument()
  })

  it('toggles showGrid on the bound config when the grid button is clicked', async () => {
    const sceneConfig = makeSceneConfig()
    const { user } = renderMenuBar({ sceneConfig })

    await user.click(screen.getByRole('button', { name: 'Show grid' }))

    expect(sceneConfig.showGrid).toBe(false)
  })

  it('emits fitToViewer when the fit button is clicked', async () => {
    const onFitToViewer = vi.fn()
    const { user } = renderMenuBar({ onFitToViewer })

    await user.click(screen.getByRole('button', { name: 'Fit to Viewer' }))

    expect(onFitToViewer).toHaveBeenCalledOnce()
  })

  it('emits centerCamera when the center button is clicked', async () => {
    const onCenterCamera = vi.fn()
    const { user } = renderMenuBar({ onCenterCamera })

    await user.click(
      screen.getByRole('button', { name: 'Center Camera on Model' })
    )

    expect(onCenterCamera).toHaveBeenCalledOnce()
  })

  it('hides the center button when canCenterCameraOnModel is false', () => {
    renderMenuBar({ canCenterCameraOnModel: false })

    expect(
      screen.queryByRole('button', { name: 'Center Camera on Model' })
    ).not.toBeInTheDocument()
  })

  it('toggles the gizmo and reveals the mode controls inline', async () => {
    const onToggleGizmo = vi.fn()
    const onSetGizmoMode = vi.fn()
    const { user } = renderMenuBar({ onToggleGizmo, onSetGizmoMode })

    await selectCategory(user, 'Gizmo')
    // The chip and the enable toggle share the 'Gizmo' name; click the toggle.
    const gizmoButtons = screen.getAllByRole('button', { name: 'Gizmo' })
    await user.click(gizmoButtons[gizmoButtons.length - 1])
    expect(onToggleGizmo).toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: 'Rotate' }))
    expect(onSetGizmoMode).toHaveBeenCalledWith('rotate')
  })

  it('shows the hdri upload inline without an extra popover', async () => {
    const { user } = renderMenuBar()

    await selectCategory(user, 'HDRI')

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it('forwards removeHdri as updateHdriFile(null) when a file is loaded', async () => {
    const onUpdateHdriFile = vi.fn()
    const lightConfig = makeLightConfig()
    lightConfig.hdri = {
      enabled: true,
      hdriPath: 'env.hdr',
      showAsBackground: false,
      intensity: 1
    }
    const { user } = renderMenuBar({ lightConfig, onUpdateHdriFile })

    await selectCategory(user, 'HDRI')
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onUpdateHdriFile).toHaveBeenCalledWith(null)
  })

  it('emits startRecording when the record button is clicked', async () => {
    const onStartRecording = vi.fn()
    const { user } = renderMenuBar({ onStartRecording })

    await user.click(screen.getByRole('button', { name: 'Record' }))

    expect(onStartRecording).toHaveBeenCalledOnce()
  })

  it('forwards exportRecording from the recording menu once a recording exists', async () => {
    const onExportRecording = vi.fn()
    const { user } = renderMenuBar({
      hasRecording: true,
      isRecording: false,
      onExportRecording
    })

    await user.click(
      screen.getByRole('button', { name: 'Video recording of the scene [mp4]' })
    )
    await user.click(screen.getByRole('button', { name: 'Download Recording' }))

    expect(onExportRecording).toHaveBeenCalledOnce()
  })

  it('omits the gizmo category when canUseGizmo is false', async () => {
    const { user } = renderMenuBar({ canUseGizmo: false })
    await openCategoryMenu(user)

    expect(
      screen.queryByRole('button', { name: 'Gizmo' })
    ).not.toBeInTheDocument()
  })

  it('switches to the camera category and shows its controls', async () => {
    const { user } = renderMenuBar()
    await openCategoryMenu(user)

    await user.click(screen.getByRole('button', { name: 'Camera' }))

    expect(
      screen.getByRole('button', { name: 'Perspective' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Show grid' })
    ).not.toBeInTheDocument()
  })

  it('omits the light category when canUseLighting is false', async () => {
    const { user } = renderMenuBar({ canUseLighting: false })
    await openCategoryMenu(user)

    expect(
      screen.queryByRole('button', { name: 'Light' })
    ).not.toBeInTheDocument()
  })

  it('hides scene controls when sceneConfig is undefined', () => {
    renderMenuBar({ sceneConfig: undefined })

    expect(
      screen.queryByRole('button', { name: 'Show grid' })
    ).not.toBeInTheDocument()
  })
})
