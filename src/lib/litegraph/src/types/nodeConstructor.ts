import type { LGraphNode } from './entityRegistry'
import type { Size } from '../interfaces'
import type { RenderShape, TitleMode } from './globalEnums'

export interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> {
  new (title: string, type?: string): T

  title?: string
  desc?: string
  priority?: number
  type?: string // TODO: to be, or not to be--that is the question
  size?: Size
  min_height?: number
  slot_start_y?: number
  widgets_info?: Record<string, unknown>
  collapsable?: boolean
  color?: string
  bgcolor?: string
  shape?: RenderShape
  title_mode?: TitleMode
  title_color?: string
  title_text_color?: string
  keepAllLinksOnBypass: boolean
  resizeHandleSize?: number
  resizeEdgeSize?: number
}
