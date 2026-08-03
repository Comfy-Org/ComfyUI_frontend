import type { ResolvedErrorMessage } from '@/platform/errorCatalog/types'
import type { NodeExecutionId } from '@/types/nodeIdentification'

export interface ErrorItem extends ResolvedErrorMessage {
  /** Raw source/API-compatible message. */
  message: string
  /** Raw source/API-compatible details. */
  details?: string
  isRuntimeError?: boolean
  exceptionType?: string
}

export interface ErrorCardData {
  id: string
  title: string
  nodeId?: NodeExecutionId
  nodeTitle?: string
  graphNodeId?: string
  errors: ErrorItem[]
}

interface ErrorGroupBase extends Omit<ResolvedErrorMessage, 'displayTitle'> {
  /** Stable structural key used for rendering, collapse state, and cache identity. */
  groupKey: string
  /** Human-friendly title resolved for UI display. */
  displayTitle: string
  count: number
  priority: number
}

export type ErrorGroup =
  | (ErrorGroupBase & {
      type: 'execution'
      cards: ErrorCardData[]
    })
  | (ErrorGroupBase & {
      type: 'missing_node'
    })
  | (ErrorGroupBase & {
      type: 'swap_nodes'
    })
  | (ErrorGroupBase & {
      type: 'missing_model'
    })
  | (ErrorGroupBase & {
      type: 'missing_media'
    })
