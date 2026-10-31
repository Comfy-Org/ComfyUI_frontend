import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import { emitGraphRestored, onGraphRestored } from './graphRestore'
import type { GraphRestore } from './graphRestore'

vi.mock(import('@comfyorg/telemetry/reportError'))

describe('emitGraphRestored', () => {
  it('delivers to every listener when an earlier one throws, and reports the failure', () => {
    const failure = new Error('restore listener broke')
    const restore: GraphRestore = {
      previous: fromPartial({ nodes: [] }),
      next: fromPartial({ nodes: [] })
    }
    const received: GraphRestore[] = []
    onTestFinished(
      onGraphRestored(() => {
        throw failure
      })
    )
    onTestFinished(onGraphRestored((event) => received.push(event)))

    expect(() => emitGraphRestored(restore)).not.toThrow()

    expect(received).toEqual([restore])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      surface: 'graph',
      errorType: 'error_notifying_graph_restore_listener'
    })
  })
})
