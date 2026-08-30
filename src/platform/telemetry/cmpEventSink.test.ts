import type { CmpEvent } from '@comfyorg/comfy-multi-player'

import { reportError } from './reportError'
import { cmpEventSink } from './cmpEventSink'

vi.mock('./reportError', () => ({ reportError: vi.fn() }))

const event: CmpEvent = {
  schema_version: 1,
  type: 'op_rejected',
  source: 'applyOps',
  code: 'unknown_widget',
  message: 'widget write rejected',
  error_name: 'OpRejectedError',
  op_id: '0123456789abcdef0123456789abcdef',
  batch_index: 2
}

describe('cmpEventSink', () => {
  it('maps a cmp event to the generic error reporter', () => {
    expect(cmpEventSink(event)).toBeUndefined()

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: event.message }),
      {
        errorType: 'cmp_event',
        tags: {
          cmp_event_schema_version: 1,
          cmp_event_type: 'op_rejected',
          cmp_event_source: 'applyOps',
          cmp_event_code: 'unknown_widget',
          cmp_event_error_name: 'OpRejectedError'
        },
        context: {
          op_id: event.op_id,
          batch_index: 2
        }
      }
    )
  })

  it('bounds diagnostic messages and accepts additive event names', () => {
    cmpEventSink({ ...event, type: 'future_event', message: 'x'.repeat(2_000) })

    expect(reportError).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'x'.repeat(1_024) }),
      expect.objectContaining({
        tags: expect.objectContaining({ cmp_event_type: 'future_event' })
      })
    )
  })
})
