import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'

export type SettingValue = string | number | boolean

export interface NodeAddress {
  kind: 'node'
  nodeId: NodeLocatorId
}

export interface SettingAddress {
  kind: 'setting'
  nodeId: NodeLocatorId
  setting: string
}

export interface ControlAddress {
  kind: 'control'
  control: 'run'
}

/** Something on screen the agent can point at. */
export type TargetAddress = NodeAddress | SettingAddress | ControlAddress

/** What the person sends: their words plus the addresses of what they marked. */
export interface AgentQuestion {
  questionId: string
  text: string
  marked: TargetAddress[]
}

/** The step stays until this happens; without it the person moves on themselves. */
export type StepWait =
  | {
      for: 'valueChange'
      of: SettingAddress
      direction?: 'increase' | 'decrease'
    }
  | { for: 'run' }

/** An edit the person can accept instead of making it themselves. */
export interface OfferedEdit {
  target: SettingAddress
  value: SettingValue
}

export interface GuidanceStep {
  text: string
  target: TargetAddress | null
  waitFor?: StepWait
  offerEdit?: OfferedEdit
}

/** The agent's answer: ordered steps, each followed by the next entry. */
export interface AgentReply {
  questionId: string
  steps: GuidanceStep[]
}

export function addressKey(address: TargetAddress): string {
  if (address.kind === 'control') return `control:${address.control}`
  if (address.kind === 'node') return `node:${address.nodeId}`
  return `setting:${address.nodeId}:${address.setting}`
}
