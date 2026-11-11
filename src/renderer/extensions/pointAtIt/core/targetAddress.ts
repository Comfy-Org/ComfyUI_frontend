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

/** A node or a setting of the open workflow, checked against the host. */
export type GraphAddress = NodeAddress | SettingAddress

/** Something on screen the agent's pointer can land on. */
export type TargetAddress = GraphAddress | ControlAddress

export function addressKey(address: TargetAddress): string {
  if (address.kind === 'control') return `control:${address.control}`
  if (address.kind === 'node') return `node:${address.nodeId}`
  return `setting:${address.nodeId}:${address.setting}`
}
