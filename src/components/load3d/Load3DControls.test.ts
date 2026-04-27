import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import Load3DControls from '@/components/load3d/Load3DControls.vue'
import type {
  CameraConfig,
  LightConfig,
  MaterialMode,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'

vi.mock('@/composables/useDismissableOverlay', () => ({
  useDismissableOverlay: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      menu: { showMenu: 'Show menu' },
      load3d: {
        scene: 'Scene',
        model: 'Model',
        camera: 'Camera',
        light: 'Light',
        gizmo: { label: 'Gizmo' },
        export: 'Export'
      }
    }
  }
})

const childStubs = {
  SceneControls: {
    name: 'SceneControls',
    emits: ['update-background-image'],
    template: `<div data-testid="scene-controls">
      <button data-testid="scene-emit-bg" @click="$emit('update-background-image', null)" />
    </div>`
  },
  ModelControls: {
    name: 'ModelControls',
    template: '<div data-testid="model-controls" />'
  },
  CameraControls: {
    name: 'CameraControls',
    template: '<div data-testid="camera-controls" />'
  },
  LightControls: {
    name: 'LightControls',
    template: '<div data-testid="light-controls" />'
  },
  HDRIControls: {
    name: 'HDRIControls',
    emits: ['update-hdri-file'],
    template: `<div data-testid="hdri-controls">
      <button data-testid="hdri-emit-file" @click="$emit('update-hdri-file', null)" />
    </div>`
  },
  ExportControls: {
    name: 'ExportControls',
    emits: ['export-model'],
    template: `<div data-testid="export-controls">
      <button data-testid="export-emit-glb" @click="$emit('export-model', 'glb')" />
    </div>`
  },
  GizmoControls: {
    name: 'GizmoControls',
    emits: ['toggle-gizmo', 'set-gizmo-mode', 'reset-gizmo-transform'],
    template: `<div data-testid="gizmo-controls">
      <button data-testid="gizmo-emit-toggle" @click="$emit('toggle-gizmo', true)" />
      <button data-testid="gizmo-emit-mode" @click="$emit('set-gizmo-mode', 'rotate')" />
      <button data-testid="gizmo-emit-reset" @click="$emit('reset-gizmo-transform')" />
    </div>`
  }
}

const defaultSceneConfig: SceneConfig = {
  showGrid: true,
  backgroundColor: '#000000',
  backgroundImage: '',
  backgroundRenderMode: 'tiled'
}

const defaultModelConfig: ModelConfig = {
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

const defaultCameraConfig: CameraConfig = {
  cameraType: 'perspective',
  fov: 75
}

const defaultLightConfig: LightConfig = {
  intensity: 5,
  hdri: {
    enabled: false,
    hdriPath: '',
    showAsBackground: false,
    intensity: 1
  }
}

type RenderProps = {
  sceneConfig?: SceneConfig
  modelConfig?: ModelConfig
  cameraConfig?: CameraConfig
  lightConfig?: LightConfig
  canUseGizmo?: boolean
  canUseLighting?: boolean
  canExport?: boolean
  materialModes?: readonly MaterialMode[]
  hasSkeleton?: boolean
  onUpdateBackgroundImage?: (file: File | null) => void
  onExportModel?: (format: string) => void
  onUpdateHdriFile?: (file: File | null) => void
  onToggleGizmo?: (enabled: boolean) => void
  onSetGizmoMode?: (mode: string) => void
  onResetGizmoTransform?: () => void
}

function renderControls(overrides: RenderProps = {}) {
  const result = render(Load3DControls, {
    props: {
      sceneConfig: defaultSceneConfig,
      modelConfig: defaultModelConfig,
      cameraConfig: defaultCameraConfig,
      lightConfig: defaultLightConfig,
      canUseGizmo: true,
      canUseLighting: true,
      canExport: true,
      materialModes: ['original', 'normal', 'wireframe'],
      hasSkeleton: false,
      ...overrides
    },
    global: {
      plugins: [i18n],
      stubs: childStubs,
      directives: {
        tooltip: () => {}
      }
    }
  })
  return { ...result, user: userEvent.setup() }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Show menu' }))
}

describe('Load3DControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('category menu', () => {
    it('renders SceneControls by default', () => {
      renderControls()
      expect(screen.getByTestId('scene-controls')).toBeInTheDocument()
    })

    it('keeps the category menu closed until the trigger is clicked', async () => {
      const { user } = renderControls()

      expect(
        screen.queryByRole('button', { name: 'Scene' })
      ).not.toBeInTheDocument()

      await openMenu(user)

      expect(screen.getByRole('button', { name: 'Scene' })).toBeInTheDocument()
    })

    it('shows every category when all capabilities are enabled', async () => {
      const { user } = renderControls()
      await openMenu(user)

      for (const label of [
        'Scene',
        'Model',
        'Camera',
        'Light',
        'Gizmo',
        'Export'
      ]) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
    })

    it('omits the light category when canUseLighting is false', async () => {
      const { user } = renderControls({ canUseLighting: false })
      await openMenu(user)

      expect(
        screen.queryByRole('button', { name: 'Light' })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Scene' })).toBeInTheDocument()
    })

    it('omits the gizmo category when canUseGizmo is false', async () => {
      const { user } = renderControls({ canUseGizmo: false })
      await openMenu(user)

      expect(
        screen.queryByRole('button', { name: 'Gizmo' })
      ).not.toBeInTheDocument()
    })

    it('omits the export category when canExport is false', async () => {
      const { user } = renderControls({ canExport: false })
      await openMenu(user)

      expect(
        screen.queryByRole('button', { name: 'Export' })
      ).not.toBeInTheDocument()
    })

    it('selecting a category closes the menu and swaps the visible control', async () => {
      const { user } = renderControls()
      await openMenu(user)

      await user.click(screen.getByRole('button', { name: 'Model' }))

      expect(
        screen.queryByRole('button', { name: 'Scene' })
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('model-controls')).toBeInTheDocument()
      expect(screen.queryByTestId('scene-controls')).not.toBeInTheDocument()
    })
  })

  describe('control visibility', () => {
    async function selectCategory(
      user: ReturnType<typeof userEvent.setup>,
      label: string
    ) {
      await openMenu(user)
      await user.click(screen.getByRole('button', { name: label }))
    }

    it.each([
      ['Model', 'model-controls'],
      ['Camera', 'camera-controls']
    ])('%s category renders only %s', async (label, testId) => {
      const { user } = renderControls()
      await selectCategory(user, label)

      expect(screen.getByTestId(testId)).toBeInTheDocument()
      expect(screen.queryByTestId('scene-controls')).not.toBeInTheDocument()
    })

    it('Light category renders both LightControls and HDRIControls', async () => {
      const { user } = renderControls()
      await selectCategory(user, 'Light')

      expect(screen.getByTestId('light-controls')).toBeInTheDocument()
      expect(screen.getByTestId('hdri-controls')).toBeInTheDocument()
    })

    it('Gizmo category renders GizmoControls', async () => {
      const { user } = renderControls()
      await selectCategory(user, 'Gizmo')

      expect(screen.getByTestId('gizmo-controls')).toBeInTheDocument()
    })

    it('Export category renders ExportControls', async () => {
      const { user } = renderControls()
      await selectCategory(user, 'Export')

      expect(screen.getByTestId('export-controls')).toBeInTheDocument()
    })

    it('hides all controls when the corresponding v-model is undefined', () => {
      renderControls({
        sceneConfig: undefined,
        modelConfig: undefined,
        cameraConfig: undefined,
        lightConfig: undefined
      })

      expect(screen.queryByTestId('scene-controls')).not.toBeInTheDocument()
    })
  })

  describe('event forwarding', () => {
    it('forwards updateBackgroundImage from SceneControls', async () => {
      const onUpdateBackgroundImage = vi.fn()
      const { user } = renderControls({ onUpdateBackgroundImage })

      await user.click(screen.getByTestId('scene-emit-bg'))

      expect(onUpdateBackgroundImage).toHaveBeenCalledWith(null)
    })

    it('forwards exportModel from ExportControls', async () => {
      const onExportModel = vi.fn()
      const { user } = renderControls({ onExportModel })
      await openMenu(user)
      await user.click(screen.getByRole('button', { name: 'Export' }))

      await user.click(screen.getByTestId('export-emit-glb'))

      expect(onExportModel).toHaveBeenCalledWith('glb')
    })

    it('forwards updateHdriFile from HDRIControls', async () => {
      const onUpdateHdriFile = vi.fn()
      const { user } = renderControls({ onUpdateHdriFile })
      await openMenu(user)
      await user.click(screen.getByRole('button', { name: 'Light' }))

      await user.click(screen.getByTestId('hdri-emit-file'))

      expect(onUpdateHdriFile).toHaveBeenCalledWith(null)
    })

    it('forwards gizmo events from GizmoControls', async () => {
      const onToggleGizmo = vi.fn()
      const onSetGizmoMode = vi.fn()
      const onResetGizmoTransform = vi.fn()
      const { user } = renderControls({
        onToggleGizmo,
        onSetGizmoMode,
        onResetGizmoTransform
      })
      await openMenu(user)
      await user.click(screen.getByRole('button', { name: 'Gizmo' }))

      await user.click(screen.getByTestId('gizmo-emit-toggle'))
      await user.click(screen.getByTestId('gizmo-emit-mode'))
      await user.click(screen.getByTestId('gizmo-emit-reset'))

      expect(onToggleGizmo).toHaveBeenCalledWith(true)
      expect(onSetGizmoMode).toHaveBeenCalledWith('rotate')
      expect(onResetGizmoTransform).toHaveBeenCalledOnce()
    })
  })
})
