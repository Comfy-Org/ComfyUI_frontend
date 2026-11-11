import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

export type SettingValue = string | number | boolean

interface NodeAddress {
  kind: 'node'
  nodeId: NodeLocatorId
}

export interface SettingAddress {
  kind: 'setting'
  nodeId: NodeLocatorId
  setting: string
}

interface ControlAddress {
  kind: 'control'
  control: 'run'
}

/** A piece of the app's interface outside the graph, as the person marked it. */
export interface ElementAddress {
  kind: 'element'
  /** Given by the layer when the element is marked; only meaningful in this page. */
  elementId: string
  label: string
  role: string
  /** The menu, dialog, toolbar or panel the element sits in, or ''. */
  context: string
  testId: string | null
}

/** A node or a setting of the open workflow, checked against the host. */
export type GraphAddress = NodeAddress | SettingAddress

/** What the host can read, reveal and write. */
export type HostAddress = GraphAddress | ControlAddress

/** What a comment can be pinned on. */
export type AnnotationTarget = GraphAddress | ElementAddress

/** Something on screen the agent's pointer can land on. */
export type TargetAddress = HostAddress | ElementAddress

export function addressKey(address: TargetAddress): string {
  if (address.kind === 'control') return `control:${address.control}`
  if (address.kind === 'element') return `element:${address.elementId}`
  if (address.kind === 'node') return `node:${address.nodeId}`
  return `setting:${address.nodeId}:${address.setting}`
}
