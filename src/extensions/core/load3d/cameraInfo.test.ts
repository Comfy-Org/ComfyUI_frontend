import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

import { cameraInfoExtension as extension } from './cameraInfo'

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
