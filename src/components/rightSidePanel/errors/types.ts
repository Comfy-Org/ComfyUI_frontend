export interface ErrorItem {
  message: string
  details?: string
  isRuntimeError?: boolean
}

export interface ErrorCardData {
  id: string
  title: string
  nodeId?: string
  nodeTitle?: string
  graphNodeId?: string
  isSubgraphNode?: boolean
  errors: ErrorItem[]
}

export type ErrorGroupType = 'execution' | 'missing_node' | 'missing_model'

export interface ErrorGroup {
  type: ErrorGroupType
  title: string
  cards: ErrorCardData[]
  priority: number
}
