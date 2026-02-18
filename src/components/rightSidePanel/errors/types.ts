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

export interface ErrorGroup {
  title: string
  cards: ErrorCardData[]
  priority: number
}
