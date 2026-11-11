import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

import type { Rect } from './geometry'
import type { HostAddress, SettingAddress, SettingValue } from './targetAddress'

export interface HostSetting {
  name: string
  label: string
  description: string
  value: SettingValue | undefined
  /** The values a choice setting accepts, when it is one. */
  options?: SettingValue[]
  rect: Rect | null
}

/** One incoming connection: this node's input fed by another node's output. */
export interface HostLink {
  input: string
  from: NodeLocatorId
  output: string
}

export interface HostNode {
  id: NodeLocatorId
  type: string
  title: string
  description: string
  rect: Rect | null
  settings: HostSetting[]
  links: HostLink[]
}

export interface TargetReading {
  rect: Rect | null
  value: SettingValue | undefined
}

/** The only seam between the layer and the app. Rects are in window pixels. */
export interface PointHost {
  /** Every node of the open workflow; rects are null for what is not drawn. */
  readNodes(): HostNode[]
  readSelection(): NodeLocatorId[]
  /** Null when the node or setting no longer exists. */
  readTarget(target: HostAddress): TargetReading | null
  /** The part of the window where the canvas is visible. */
  viewport(): Rect
  reveal(target: HostAddress): Promise<void>
  /** False when the setting rejected the value. */
  write(target: SettingAddress, value: SettingValue): boolean
  onRunQueued(listener: () => void): () => void
  /** Lets the canvas pan or zoom from a wheel event the layer caught. */
  forwardWheel(event: WheelEvent): void
  /** True for the canvas and what is drawn on it, which is picked by node and setting. */
  isGraphElement(element: Element): boolean
}
