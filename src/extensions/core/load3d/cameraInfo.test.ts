import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'
import {
  deriveWidgetVisibility,
  isWidgetVisibleOnSurface
} from '@/types/widgetVisibility'

import { load3dWidgets } from './load3dWidgets'

describe('Comfy.CreateCameraInfo extension', () => {
  it('keeps the viewport out of the right side panel', async () => {
    const node = new LGraphNode('CreateCameraInfo')
    load3dWidgets.CAMERA_INFO_STATE(
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
