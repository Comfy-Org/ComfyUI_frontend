import type {
  LGraphNode,
  LLink,
  Reroute,
  FloatingRenderLink,
  MovingInputLink,
  MovingOutputLink,
  ToInputFromIoNodeLink,
  ToInputRenderLink,
  SubgraphInputNode,
  SubgraphOutputNode,
  RenderLink
} from './entityRegistry'

import type { CanvasPointerEvent } from './events'
import type { IWidget } from './widgets'

export interface LinkConnectorEventMap {
  reset: boolean

  'before-drop-links': {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }
  'after-drop-links': {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }

  'before-move-input': MovingInputLink | FloatingRenderLink
  'before-move-output': MovingOutputLink | FloatingRenderLink

  'input-moved': MovingInputLink | FloatingRenderLink | ToInputFromIoNodeLink
  'output-moved': MovingOutputLink | FloatingRenderLink

  'link-created': LLink | null | undefined

  'dropped-on-reroute': {
    reroute: Reroute
    event: CanvasPointerEvent
  }
  'dropped-on-node': {
    node: LGraphNode
    event: CanvasPointerEvent
  }
  'dropped-on-io-node': {
    node: SubgraphInputNode | SubgraphOutputNode
    event: CanvasPointerEvent
  }
  'dropped-on-canvas': CanvasPointerEvent

  'dropped-on-widget': {
    link: ToInputRenderLink
    node: LGraphNode
    widget: IWidget
  }
}
