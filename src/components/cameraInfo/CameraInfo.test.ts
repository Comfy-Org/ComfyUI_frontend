import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        showGizmos: 'Show gizmos',
        hideGizmos: 'Hide gizmos',
        lookThrough: 'Camera view',
        exitLookThrough: 'Exit camera view',
        transformGizmo: {
          none: 'None',
          target: 'Target',
          cameraTranslate: 'Cam pos',
          cameraRotate: 'Cam rot'
        }
      }
    }
  }
})

type ApiMocks = Record<string, ReturnType<typeof vi.fn>>

const holder = vi.hoisted(() => ({
  modeRef: null as { value: string } | null,
  api: null as ApiMocks | null
}))

vi.mock('@/composables/useCameraInfo', async () => {
  const { ref } = await import('vue')
  const modeRef = ref('orbit')
  const api = {
    initialize: vi.fn(),
    cleanup: vi.fn(),
    handleMouseEnter: vi.fn(),
    handleMouseLeave: vi.fn(),
    setGizmosVisible: vi.fn(),
    setTransformGizmoMode: vi.fn(),
    setLookThrough: vi.fn()
  }
  holder.modeRef = modeRef
  holder.api = api
  return { useCameraInfo: () => ({ ...api, mode: modeRef }) }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { ref } = await import('vue')
  return {
    ...actual,
    useElementSize: () => ({ width: ref(600), height: ref(400) })
  }
})

import CameraInfo from './CameraInfo.vue'

function makeWidget(): SimplifiedWidget {
  return {
    name: 'camera_info_state',
    type: 'cameraInfo',
    value: [],
    options: {}
  } as unknown as SimplifiedWidget
}

function renderComponent() {
  return render(CameraInfo, {
    props: { widget: makeWidget() },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
}

function setMode(value: string) {
  holder.modeRef!.value = value
}

function api(): ApiMocks {
  return holder.api!
}

describe('CameraInfo toolbar', () => {
  beforeEach(() => {
    setMode('orbit')
    Object.values(api()).forEach((fn) => fn.mockClear())
  })

  it('initializes the viewport on mount and cleans up on unmount', () => {
    const { unmount } = renderComponent()
    expect(api().initialize).toHaveBeenCalledOnce()

    unmount()
    expect(api().cleanup).toHaveBeenCalledOnce()
  })

  it('toggles gizmo visibility when the gizmos button is clicked', async () => {
    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Hide gizmos' }))

    expect(api().setGizmosVisible).toHaveBeenCalledWith(false)
  })

  it('enters camera view when the camera-view button is clicked', async () => {
    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Camera view' }))

    expect(api().setLookThrough).toHaveBeenCalledWith(true)
  })
})

describe('CameraInfo transform gizmo reconciliation', () => {
  beforeEach(() => {
    setMode('orbit')
    Object.values(api()).forEach((fn) => fn.mockClear())
  })

  it('resets the selected gizmo to none when the new mode disables it', async () => {
    setMode('quaternion')
    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cam rot' }))
    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith(
      'camera-rotate'
    )

    setMode('orbit')
    await nextTick()

    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith('none')
  })

  it('keeps the selected gizmo when the new mode still supports it', async () => {
    setMode('orbit')
    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Target' }))
    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith('target')

    setMode('look_at')
    await nextTick()

    expect(api().setTransformGizmoMode).not.toHaveBeenCalledWith('none')
  })
})
