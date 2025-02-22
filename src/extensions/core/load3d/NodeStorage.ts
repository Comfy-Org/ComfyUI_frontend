import { LGraphNode } from '@comfyorg/litegraph'

import { NodeStorageInterface } from './interfaces'

export class NodeStorage implements NodeStorageInterface {
  private node: LGraphNode

  constructor(node: LGraphNode = {} as LGraphNode) {
    this.node = node
  }

  storeNodeProperty(name: string, value: any): void {
    if (this.node && this.node.properties) {
      this.node.properties[name] = value
    }
  }

  loadNodeProperty(name: string, defaultValue: any): any {
    if (
      !this.node ||
      !this.node.properties ||
      !(name in this.node.properties)
    ) {
      return defaultValue
    }
    return this.node.properties[name]
  }

  setNode(node: LGraphNode): void {
    this.node = node
  }
}
