import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { fromPartial } from '@total-typescript/shoehorn'

import type { ComponentWidget } from '@/types/domWidget'

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

vi.mock<unknown>(
  import('@/extensions/core/load3d/composables/useCameraInfo'),
  async () => {
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
  }
)

vi.mock<unknown>(import('@vueuse/core'), () => ({
  createSharedComposable: (composable: () => unknown) => composable,
  useDocumentVisibility: () => ref('visible'),
  useElementSize: () => ({ width: ref(600), height: ref(400) }),
  useStorage: (_key: string, defaultValue: unknown) => ref(defaultValue)
}))

const liveGraphNodes = vi.hoisted(() => ({
  reloads: new Set<() => void>()
}))

vi.mock(import('@/composables/useLiveGraphNode'), async () => {
  const { computed, onScopeDispose, shallowRef } = await import('vue')
  return {
    useLiveGraphNode: (resolve) => {
      const node = shallowRef(resolve() ?? null)
      const reload = () => (node.value = resolve() ?? null)
      liveGraphNodes.reloads.add(reload)
      onScopeDispose(() => liveGraphNodes.reloads.delete(reload))
      return computed(() => node.value)
    }
  }
})

function reloadLiveGraphNodes() {
  for (const reload of liveGraphNodes.reloads) reload()
}

import CameraInfo from './CameraInfo.vue'

type WidgetNode = ComponentWidget<string[]>['node']

function renderComponent() {
  let node: WidgetNode | undefined = fromPartial<WidgetNode>({})
  const widget = fromPartial<ComponentWidget<string[]>>({
    name: 'camera_info_state',
    type: 'cameraInfo',
    get node() {
      return node
    }
  })
  const rendered = render(CameraInfo, {
    props: { widget },
    global: {
      plugins: [i18n]
    }
  })
  function reloadGraph({ nodeKept }: { nodeKept: boolean }) {
    node = nodeKept ? fromPartial<WidgetNode>({}) : undefined
    reloadLiveGraphNodes()
  }
  return { ...rendered, reloadGraph }
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

  it('initializes the viewport again, keeping the toolbar state, for the node a reloaded graph holds', async () => {
    const { reloadGraph } = renderComponent()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Hide gizmos' }))
    Object.values(api()).forEach((fn) => fn.mockClear())

    reloadGraph({ nodeKept: true })
    await nextTick()

    expect(api().initialize).toHaveBeenCalledOnce()
    expect(api().setGizmosVisible).toHaveBeenCalledWith(false)
  })

  it('cleans up the viewport when a reload leaves no node behind', async () => {
    const { reloadGraph } = renderComponent()
    api().cleanup.mockClear()

    reloadGraph({ nodeKept: false })
    await nextTick()

    expect(api().cleanup).toHaveBeenCalledOnce()
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

  it('restores the previous selection when the mode re-enables it', async () => {
    setMode('quaternion')
    renderComponent()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Cam rot' }))
    setMode('orbit')
    await nextTick()
    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith('none')

    setMode('quaternion')
    await nextTick()

    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith(
      'camera-rotate'
    )
  })

  it('keeps the selected gizmo when the new mode still supports it', async () => {
    setMode('orbit')
    renderComponent()
    api().setTransformGizmoMode.mockClear()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Target' }))
    expect(api().setTransformGizmoMode).toHaveBeenLastCalledWith('target')

    setMode('look_at')
    await nextTick()

    expect(api().setTransformGizmoMode).not.toHaveBeenCalledWith('none')
  })
})
