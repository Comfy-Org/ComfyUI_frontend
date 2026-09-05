import type { CmpEventSink } from '@comfyorg/comfy-multi-player'

import { reportError } from './reportError'

const MAX_MESSAGE_LENGTH = 1_024

export const cmpEventSink: CmpEventSink = (event) => {
  reportError(new Error(event.message.slice(0, MAX_MESSAGE_LENGTH)), {
    errorType: 'cmp_event',
    tags: {
      cmp_event_schema_version: event.schema_version,
      cmp_event_type: event.type,
      cmp_event_source: event.source,
      cmp_event_code: event.code,
      cmp_event_error_name: event.error_name
    },
    context: {
      op_id: event.op_id,
      batch_index: event.batch_index
    }
  })
  return undefined
}
