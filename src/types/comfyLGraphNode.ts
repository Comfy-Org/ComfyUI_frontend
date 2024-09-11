import type { LGraphNode } from '@comfyorg/litegraph'
import type { ComfyNodeDef } from './apiTypes'

export declare class ComfyLGraphNode extends LGraphNode {
  static comfyClass: string
  static title: string
  static nodeData?: ComfyNodeDef
  static category: string

  constructor(title?: string)
}
