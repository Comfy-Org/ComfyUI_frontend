/**
 * @fileoverview Types for node error context system
 * @module renderer/extensions/vueNodes/types/errorContext
 */

/**
 * Interface for node error context provided by LGraphNode to child components
 */
export interface NodeErrorContext {
  /**
   * Check if a specific input slot has validation errors
   * @param inputName - The name of the input slot to check
   * @returns True if the input slot has validation errors
   */
  hasInputSlotError: (inputName: string) => boolean
}

/**
 * Node error data structure from execution store
 */
export interface NodeErrorData {
  errors: Array<{
    type: string
    message: string
    details?: string
    extra_info?: { input_name?: string }
  }>
  class_type: string
  dependent_outputs: string[]
}
