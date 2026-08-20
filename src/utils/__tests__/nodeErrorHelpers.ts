import type { NodeError } from '@/schemas/apiSchema'
import type { NodeValidationError } from '@/utils/executionErrorUtil'

export function validationError(
  type: string,
  inputName?: string,
  extraInfo: Record<string, unknown> = {},
  message = `${type} message`,
  details = `${type} details`
): NodeValidationError {
  return {
    type,
    message,
    details,
    ...(inputName
      ? { extra_info: { ...extraInfo, input_name: inputName } }
      : {})
  }
}

export function nodeError(
  errors: NodeValidationError[],
  classType = 'InteriorNode'
): NodeError {
  return {
    class_type: classType,
    dependent_outputs: [],
    errors
  }
}
