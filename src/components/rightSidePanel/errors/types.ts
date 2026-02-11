/**
 * Shared type definitions for the error tab components.
 */

/**
 * Represents a single error entry within a card.
 */
interface ErrorItem {
  /** The localized or raw error message to display */
  message: string
  /** Optional technical details (e.g., traceback, sub-error info) */
  details?: string
  /** Whether this is a runtime execution error from a WebSocket (affects UI height) */
  isRuntimeError?: boolean
}

/**
 * Normalised representation of an error card (grouped by nodeId or __prompt__).
 */
export interface ErrorCardData {
  /** Unique identifier for the card (e.g., node ID prefix with index) */
  id: string
  /** The original category name (e.g., class_type or 'Workflow') */
  title: string
  /** The execution ID of the node associated with this card, if any */
  nodeId?: string
  /** The display title of the node (from the graph) */
  nodeTitle?: string
  /** Whether the node belongs to a subgraph */
  isSubgraphNode?: boolean
  /** List of individual error items belonging to this node/context */
  errors: ErrorItem[]
}

/**
 * A group of error cards, organized by their class type or category.
 */
export interface ErrorGroup {
  /** The display title of the group (Accordion header) */
  title: string
  /** The list of error cards in this group */
  cards: ErrorCardData[]
  /** Priority for sorting (lower is higher priority) */
  priority: number
}
