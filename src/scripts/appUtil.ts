import { isObject } from 'es-toolkit/compat'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Strips dangerous HTML entity characters from node names.
 */
export function sanitizeNodeName(string: string) {
  const entityMap = {
    '&': '',
    '<': '',
    '>': '',
    '"': '',
    "'": '',
    '`': '',
    '=': ''
  }
  return String(string).replace(/[&<>"'`=]/g, function fromEntityMap(s) {
    return entityMap[s as keyof typeof entityMap]
  })
}

/**
 * Checks whether the given data conforms to the ComfyUI API workflow format.
 * Each top-level value must have a string `class_type` and an object `inputs`.
 */
export function isApiJson(data: unknown): data is ComfyApiWorkflow {
  if (!isObject(data) || Array.isArray(data)) {
    return false
  }
  if (Object.keys(data).length === 0) return false

  return Object.values(data).every((node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return false
    }

    const classType = Reflect.get(node, 'class_type')
    const inputs = Reflect.get(node, 'inputs')
    const inputsIsRecord = isObject(inputs) && !Array.isArray(inputs)
    return typeof classType === 'string' && inputsIsRecord
  })
}
