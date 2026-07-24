import type { ExecutionErrorWsMessage, PromptError } from '@/schemas/apiSchema'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import type { MissingNodeType } from '@/types/comfy'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

export type { NodeValidationError }

export interface ResolvedErrorMessage {
  catalogId?: string
  /** Category/title for the error panel. */
  displayTitle?: string
  /** Message for grouped panel/overlay display. */
  displayMessage?: string
  /** Detail copy for expanded panel rows. */
  displayDetails?: string
  /** Short item label for rows/actions, e.g. "KSampler - model". */
  displayItemLabel?: string
  /** Title for single-error overlays/toasts. */
  toastTitle?: string
  /** Message for single-error overlays/toasts. */
  toastMessage?: string
}

export type ResolvedCatalogErrorMessage = ResolvedErrorMessage & {
  catalogId: string
}

export type ResolvedMissingErrorMessage = ResolvedErrorMessage & {
  displayTitle: string
  displayMessage: string
}

export type RunErrorMessageSource =
  | {
      kind: 'node_validation'
      error: NodeValidationError
      nodeDisplayName: string
    }
  | {
      kind: 'prompt'
      error: PromptError
      isCloud: boolean
    }
  | {
      kind: 'execution'
      error: ExecutionErrorWsMessage
      nodeDisplayName: string
    }

export type MissingErrorMessageSource =
  | {
      kind: 'missing_node'
      nodeTypes: MissingNodeType[]
      count: number
      isCloud: boolean
    }
  | {
      kind: 'swap_nodes'
      nodeTypes: MissingNodeType[]
      count: number
      isCloud: boolean
    }
  | {
      kind: 'missing_model'
      groups: MissingModelGroup[]
      count: number
      isCloud: boolean
    }
  | {
      kind: 'missing_media'
      groups: MissingMediaGroup[]
      count: number
      isCloud: boolean
    }
