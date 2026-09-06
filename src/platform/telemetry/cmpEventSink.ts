import type { CmpEvent, CmpEventSink } from '@comfyorg/comfy-multi-player'

import { reportError } from './reportError'

const MAX_MESSAGE_LENGTH = 1_024
const DEFAULT_ERROR_NAME = 'CmpEvent'

const toError = (event: CmpEvent): Error => {
  const error = new Error(event.message.slice(0, MAX_MESSAGE_LENGTH))
  error.name = event.error_name ?? DEFAULT_ERROR_NAME
  return error
}

const definedContextOf = (event: CmpEvent): Record<string, unknown> => {
  const context: Record<string, unknown> = {}
  if (event.op_id !== undefined) context.op_id = event.op_id
  if (event.batch_index !== undefined) context.batch_index = event.batch_index
  return context
}

export const cmpEventSink: CmpEventSink = (event) => {
  reportError(toError(event), {
    errorType: 'cmp_event',
    tags: {
      cmp_event_schema_version: event.schema_version,
      cmp_event_type: event.type,
      cmp_event_source: event.source,
      cmp_event_code: event.code,
      cmp_event_error_name: event.error_name
    },
    context: definedContextOf(event)
  })
  return undefined
}
