/**
 * Extra info returned by the backend for missing_node_type errors
 * from the /prompt endpoint validation.
 */
export interface MissingNodeTypeExtraInfo {
  class_type?: string | null
  node_title?: string | null
  node_id?: string
}
