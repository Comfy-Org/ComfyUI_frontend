interface InputAssignOldId {
  assign_type: 'old_id'
  old_id: string
}

interface InputAssignSetValue {
  assign_type: 'set_value'
  value: unknown
}

interface InputMap {
  new_id: string
  assign: InputAssignOldId | InputAssignSetValue
}

interface OutputMap {
  new_idx: number
  old_idx: number
}

export interface NodeReplacement {
  new_node_id: string
  old_node_id: string
  old_widget_ids: string[] | null
  input_mapping: InputMap[] | null
  output_mapping: OutputMap[] | null
}

export type NodeReplacementResponse = Record<string, NodeReplacement[]>
