import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'

import { createDefaultErrorMapper } from '@/composables/apiErrorMapper'

function axiosErrorWithResponse(
  status: number,
  data?: { message?: string },
  message = 'Request failed'
) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError(message, undefined, config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data
  })
}

function axiosErrorWithoutResponse(message: string) {
  return new AxiosError(message, AxiosError.ERR_NETWORK, {
    headers: new AxiosHeaders()
  })
}

const mapError = createDefaultErrorMapper({
  formatFallback: (context, message) => `${context}: ${message}`,
  statusMessages: {
    401: 'Unauthorized',
    404: (message) => `Not found: ${message || 'Resource not found'}`
  },
  responseFallback: ({ context, status, dataMessage, axiosMessage }) =>
    `${context} [${status}]: ${dataMessage || axiosMessage}`
})

describe('createDefaultErrorMapper', () => {
  it('formats a thrown Error with its own message', () => {
    expect(mapError(new Error('boom'), 'Failed to load')).toBe(
      'Failed to load: boom'
    )
  })

  it('renders a thrown non-Error with String() by default', () => {
    expect(mapError({ nope: true }, 'Failed to load')).toBe(
      'Failed to load: [object Object]'
    )
  })

  it('renders a thrown non-Error with unknownErrorMessage when configured', () => {
    const mapper = createDefaultErrorMapper({
      formatFallback: (context, message) => `${context}: ${message}`,
      unknownErrorMessage: 'Unknown error occurred',
      responseFallback: () => 'unused'
    })

    expect(mapper('just a string', 'Failed to load')).toBe(
      'Failed to load: Unknown error occurred'
    )
  })

  it('falls back to the axios message when there is no response', () => {
    expect(
      mapError(axiosErrorWithoutResponse('Network Error'), 'Failed to load')
    ).toBe('Failed to load: Network Error')
  })

  it('prefers route-specific copy over the status table', () => {
    expect(
      mapError(axiosErrorWithResponse(404), 'Failed to load', {
        404: 'No such release'
      })
    ).toBe('No such release')
  })

  it('uses a string status entry verbatim', () => {
    expect(
      mapError(axiosErrorWithResponse(401, { message: 'token expired' }), 'ctx')
    ).toBe('Unauthorized')
  })

  it('passes the response body message to a function status entry', () => {
    expect(
      mapError(axiosErrorWithResponse(404, { message: 'pack 42' }), 'ctx')
    ).toBe('Not found: pack 42')
  })

  it('calls a function status entry with undefined when the body has no message', () => {
    expect(mapError(axiosErrorWithResponse(404, {}), 'ctx')).toBe(
      'Not found: Resource not found'
    )
  })

  it('falls back for a status with no route-specific or table entry', () => {
    expect(
      mapError(
        axiosErrorWithResponse(500, { message: 'db down' }, 'Request failed'),
        'Failed to load'
      )
    ).toBe('Failed to load [500]: db down')
  })

  it('passes the axios message through when the response body is absent', () => {
    expect(
      mapError(
        axiosErrorWithResponse(503, undefined, 'Service Unavailable'),
        'Failed to load'
      )
    ).toBe('Failed to load [503]: Service Unavailable')
  })
})
