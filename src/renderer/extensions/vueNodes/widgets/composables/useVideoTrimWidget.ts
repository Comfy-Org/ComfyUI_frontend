import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  INumericWidget,
  IVideoTrimWidget,
  VideoTrimValue
} from '@/lib/litegraph/src/types/widgets'

function isNumericWidget(widget: IBaseWidget): widget is INumericWidget {
  return widget.type === 'number'
}

function syncSubWidgets(
  parent: IVideoTrimWidget,
  trimEnabledWidget: IBaseWidget,
  startFrameWidget: INumericWidget,
  endFrameWidget: INumericWidget
) {
  trimEnabledWidget.value = parent.value.trimEnabled
  startFrameWidget.value = parent.value.startFrame
  endFrameWidget.value = parent.value.endFrame
}

export function useVideoTrimWidget(node: LGraphNode) {
  const defaultValue: VideoTrimValue = {
    trimEnabled: false,
    startFrame: 0,
    endFrame: 0
  }

  const rawParent = node.addWidget(
    'videotrim',
    'trim',
    { ...defaultValue },
    () => {},
    {
      serialize: false,
      canvasOnly: false
    }
  )

  if (rawParent.type !== 'videotrim') {
    throw new Error(`Unexpected widget type: ${rawParent.type}`)
  }

  const parent = rawParent as IVideoTrimWidget & {
    linkedWidgets?: IBaseWidget[]
  }

  const trimEnabledWidget = node.addWidget(
    'toggle',
    'trim_enabled',
    defaultValue.trimEnabled,
    function (this: IBaseWidget, value: boolean) {
      parent.value = { ...parent.value, trimEnabled: value }
      parent.callback?.(parent.value)
    },
    {
      serialize: true,
      canvasOnly: true,
      hidden: true
    }
  )

  const startFrameWidget = node.addWidget(
    'number',
    'start_frame',
    defaultValue.startFrame,
    function (this: INumericWidget, value: number) {
      this.value = Math.round(value)
      parent.value = { ...parent.value, startFrame: this.value }
      parent.callback?.(parent.value)
    },
    {
      min: 0,
      max: 999999,
      step: 1,
      step2: 1,
      precision: 0,
      serialize: true,
      canvasOnly: true,
      hidden: true
    }
  )

  const endFrameWidget = node.addWidget(
    'number',
    'end_frame',
    defaultValue.endFrame,
    function (this: INumericWidget, value: number) {
      this.value = Math.round(value)
      parent.value = { ...parent.value, endFrame: this.value }
      parent.callback?.(parent.value)
    },
    {
      min: 0,
      max: 999999,
      step: 1,
      step2: 1,
      precision: 0,
      serialize: true,
      canvasOnly: true,
      hidden: true
    }
  )

  if (!isNumericWidget(startFrameWidget) || !isNumericWidget(endFrameWidget)) {
    throw new Error('Unexpected numeric widget type for video trim')
  }

  parent.callback = () => {
    syncSubWidgets(parent, trimEnabledWidget, startFrameWidget, endFrameWidget)
  }

  parent.linkedWidgets = [trimEnabledWidget, startFrameWidget, endFrameWidget]

  return parent
}
