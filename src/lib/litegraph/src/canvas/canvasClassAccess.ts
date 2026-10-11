import type { ContextMenu } from '../ContextMenu'
import type { LGraphNode } from '../LGraphNode'
import type { ColorOption } from '../interfaces'
import type {
  IContextMenuOptions,
  IContextMenuValue
} from '../types/contextMenu'

interface CanvasClassAccess {
  [Symbol.hasInstance](value: unknown): boolean
  node_colors: Record<string, ColorOption>
  _measureText?: (text: string, fontStyle?: string) => number
  onShowPropertyEditor(
    item: { property?: 'title' | 'font_size' },
    options: IContextMenuOptions<string>,
    event: MouseEvent,
    menu: ContextMenu<string>,
    node: { title: string; font_size?: number }
  ): void
  onMenuNodeColors(
    value: IContextMenuValue<string | null>,
    options: IContextMenuOptions,
    event: MouseEvent,
    menu: ContextMenu<string | null>,
    node: LGraphNode
  ): boolean
  onMenuNodeRemove(): void
}

export let canvasClass: CanvasClassAccess

export function provideCanvasClass(value: CanvasClassAccess): void {
  canvasClass = value
}
