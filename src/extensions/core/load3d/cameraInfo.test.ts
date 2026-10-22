import { fromPartial } from '@total-typescript/shoehorn'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import type { useExtensionService } from '@/services/extensionService'
import type { ComfyExtension } from '@/types/comfy'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

const registerExtension = vi.hoisted(() =>
  vi.fn<(ext: ComfyExtension) => void>()
)

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({ registerExtension })
}))

let extension: ComfyExtension

beforeAll(async () => {
  await import('./cameraInfo')
  expect(registerExtension).toHaveBeenCalledOnce()
  extension = registerExtension.mock.calls[0][0]
})

describe('Comfy.CreateCameraInfo extension', () => {
  it('keeps the viewport out of the right side panel', async () => {
    const node = new LGraphNode('CreateCameraInfo')
    const widgets = await extension.getCustomWidgets?.(
      fromPartial<ComfyApp>({})
    )
    const build = widgets?.CAMERA_INFO_STATE
    if (!build) throw new Error('CAMERA_INFO_STATE widget not registered')

    build(
      node,
      'camera_info_state',
      ['CAMERA_INFO_STATE', {}],
      fromPartial<ComfyApp>({})
    )
    const widget = node.widgets?.find(
      ({ name }) => name === 'camera_info_state'
    )
    if (!widget) throw new Error('camera_info_state widget was not added')
    const visibility = widget.visibility ?? deriveWidgetVisibility(widget)

    expect(widget.type).toBe('cameraInfo')
    expect(
      isWidgetVisibleOnSurface(visibility, 'panel', { showAdvanced: true })
    ).toBe(false)
  })
})
