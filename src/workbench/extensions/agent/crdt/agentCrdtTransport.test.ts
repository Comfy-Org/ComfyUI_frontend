import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createLoggedTransport } from './agentCrdtTransport'
import { setCrdtDebugEnabled, setCrdtLogLevel } from './crdtDebugGate'
import { clearDevEvents, devEvents, stringifyDevEvents } from './devPanelLog'
import type { DocFrameTransport } from './docFrameClient'

describe('createLoggedTransport.send', () => {
  const frame = '{"type":"doc_ops"}'
  const base: DocFrameTransport = {
    send: () => true,
    addEventListener: () => {},
    removeEventListener: () => {}
  }

  beforeEach(() => {
    clearDevEvents()
  })

  it('leaves the frame unparsed while the debug instrument is off', () => {
    setCrdtDebugEnabled(false)
    const parse = vi.spyOn(JSON, 'parse')

    expect(createLoggedTransport(base).send(frame)).toBe(true)

    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('records the parsed frame while the instrument is on', () => {
    setCrdtDebugEnabled(true)

    expect(createLoggedTransport(base).send(frame)).toBe(true)

    expect(devEvents.value.at(-1)?.detail).toEqual({
      delivered: true,
      frame: { type: 'doc_ops' }
    })
  })

  it('redacts outbound frame content in both console and stored events', () => {
    setCrdtDebugEnabled(true)
    setCrdtLogLevel('trace')
    const sensitiveFrame = JSON.stringify({
      type: 'doc_ops',
      token: 'secret-token',
      data: { value: 'secret-prompt', signed_url: 'secret-url' }
    })

    expect(createLoggedTransport(base).send(sensitiveFrame)).toBe(true)

    expect(vi.mocked(console.debug).mock.calls.at(-1)?.at(-1)).toEqual({
      delivered: true,
      frame: {
        type: 'doc_ops',
        token: '[REDACTED]',
        data: { value: '[REDACTED]', signed_url: '[REDACTED]' }
      }
    })
    expect(devEvents.value.at(-1)?.detail).toEqual(
      vi.mocked(console.debug).mock.calls.at(-1)?.at(-1)
    )
    expect(JSON.stringify(vi.mocked(console.debug).mock.calls)).not.toContain(
      'secret-prompt'
    )
    expect(JSON.stringify(vi.mocked(console.debug).mock.calls)).not.toContain(
      'secret-url'
    )
    expect(JSON.stringify(devEvents.value)).not.toContain('secret-prompt')
  })

  it('keeps an unparsed outbound frame out of the buffer and the copied report', () => {
    setCrdtDebugEnabled(true)
    const transport = createLoggedTransport(base)

    expect(transport.send('not json')).toBe(true)
    expect(transport.send('[1,2]')).toBe(true)
    expect(transport.send('null')).toBe(true)
    expect(transport.send('Bearer sk-live-secret')).toBe(true)

    expect(devEvents.value.map((event) => event.detail)).toEqual([
      { delivered: true, frame: null, unparsed_chars: 8 },
      { delivered: true, frame: null, unparsed_chars: 5 },
      { delivered: true, frame: null, unparsed_chars: 4 },
      { delivered: true, frame: null, unparsed_chars: 21 }
    ])
    const copied = stringifyDevEvents(devEvents.value)
    expect(copied).not.toContain('not json')
    expect(copied).not.toContain('sk-live-secret')
  })
})
