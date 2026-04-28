import { describe, expect, it, vi } from 'vitest'

import {
  HubspotSubmissionError,
  buildHubspotEndpoint,
  readHubspotTrackingCookie,
  submitHubspotForm
} from './submitHubspotForm'

const PORTAL = '12345'
const FORM = 'abcd-form-guid'

function field(name: string, value: string) {
  return { objectTypeId: '0-1', name, value }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

describe('buildHubspotEndpoint', () => {
  it('builds the NA1 endpoint by default', () => {
    expect(buildHubspotEndpoint({ portalId: PORTAL, formGuid: FORM })).toBe(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${FORM}`
    )
  })

  it('switches host for the EU region', () => {
    expect(
      buildHubspotEndpoint({ portalId: PORTAL, formGuid: FORM, region: 'eu1' })
    ).toBe(
      `https://api-eu1.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${FORM}`
    )
  })
})

describe('submitHubspotForm', () => {
  it('POSTs JSON with fields (including objectTypeId) and context to the unauthenticated endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}))

    await submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [field('firstname', 'Jane'), field('email', 'jane@acme.org')],
      context: {
        hutk: 'tracking-cookie-value',
        pageUri: 'https://comfy.org/contact',
        pageName: 'Contact Sales'
      },
      fetchImpl
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${FORM}`
    )
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(init.body as string)
    expect(body.fields).toEqual([
      { objectTypeId: '0-1', name: 'firstname', value: 'Jane' },
      { objectTypeId: '0-1', name: 'email', value: 'jane@acme.org' }
    ])
    expect(body.context).toEqual({
      hutk: 'tracking-cookie-value',
      pageUri: 'https://comfy.org/contact',
      pageName: 'Contact Sales'
    })
    expect(typeof body.submittedAt).toBe('number')
  })

  it('drops fields with empty string values so HubSpot does not reject them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}))

    await submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [
        field('firstname', 'Jane'),
        field('phone', ''),
        field('lastname', 'Doe')
      ],
      fetchImpl
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.fields).toEqual([
      { objectTypeId: '0-1', name: 'firstname', value: 'Jane' },
      { objectTypeId: '0-1', name: 'lastname', value: 'Doe' }
    ])
  })

  it('omits the context key entirely when no context is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}))

    await submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [field('firstname', 'Jane')],
      fetchImpl
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body).not.toHaveProperty('context')
  })

  it('strips undefined entries from the context but keeps null hutk', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}))

    await submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [field('firstname', 'Jane')],
      context: { hutk: null, pageUri: undefined, pageName: 'Contact' },
      fetchImpl
    })

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.context).toEqual({ hutk: null, pageName: 'Contact' })
  })

  it('returns inlineMessage and redirectUri from a 200 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        inlineMessage: '<p>Thanks!</p>',
        redirectUri: 'https://comfy.org/thanks'
      })
    )

    const result = await submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [field('firstname', 'Jane')],
      fetchImpl
    })

    expect(result).toEqual({
      inlineMessage: '<p>Thanks!</p>',
      redirectUri: 'https://comfy.org/thanks'
    })
  })

  it('throws a HubspotSubmissionError carrying the API errors on 400', async () => {
    const errorBody = {
      errors: [
        {
          message: 'Required field missing',
          errorType: 'REQUIRED_FIELD',
          in: 'email'
        }
      ]
    }
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(errorBody, 400))

    await expect(
      submitHubspotForm({
        config: { portalId: PORTAL, formGuid: FORM },
        fields: [field('firstname', 'Jane')],
        fetchImpl
      })
    ).rejects.toMatchObject({
      name: 'HubspotSubmissionError',
      status: 400,
      errors: errorBody.errors
    })
  })

  it('still throws on non-ok responses with unparseable bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('upstream blew up', {
        status: 502,
        headers: { 'content-type': 'text/plain' }
      })
    )

    const promise = submitHubspotForm({
      config: { portalId: PORTAL, formGuid: FORM },
      fields: [field('firstname', 'Jane')],
      fetchImpl
    })

    await expect(promise).rejects.toBeInstanceOf(HubspotSubmissionError)
    await expect(promise).rejects.toMatchObject({ status: 502, errors: [] })
  })

  it('throws when the form is not configured', async () => {
    const fetchImpl = vi.fn()

    await expect(
      submitHubspotForm({
        config: { portalId: '', formGuid: FORM },
        fields: [field('firstname', 'Jane')],
        fetchImpl
      })
    ).rejects.toThrow(/not configured/)

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('aborts when the request exceeds the timeout', async () => {
    vi.useFakeTimers()
    try {
      const fetchImpl: typeof fetch = vi.fn(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'))
            })
          })
      )

      const promise = submitHubspotForm({
        config: { portalId: PORTAL, formGuid: FORM },
        fields: [field('firstname', 'Jane')],
        fetchImpl,
        timeoutMs: 50
      })

      vi.advanceTimersByTime(60)

      await expect(promise).rejects.toThrow(/aborted/i)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('readHubspotTrackingCookie', () => {
  it('reads the hubspotutk cookie value with spaces after semicolons', () => {
    expect(
      readHubspotTrackingCookie('foo=bar; hubspotutk=abc123; baz=qux')
    ).toBe('abc123')
  })

  it('reads the hubspotutk cookie value when separators have no spaces', () => {
    expect(readHubspotTrackingCookie('foo=bar;hubspotutk=abc123;baz=qux')).toBe(
      'abc123'
    )
  })

  it('reads the hubspotutk cookie value when separators are mixed', () => {
    expect(
      readHubspotTrackingCookie('foo=bar; hubspotutk=abc123;baz=qux')
    ).toBe('abc123')
  })

  it('returns null when the cookie is missing', () => {
    expect(readHubspotTrackingCookie('foo=bar; baz=qux')).toBeNull()
  })

  it('returns null when no cookie string is available', () => {
    expect(readHubspotTrackingCookie(undefined)).toBeNull()
    expect(readHubspotTrackingCookie('')).toBeNull()
  })

  it('returns null for an empty hubspotutk value', () => {
    expect(readHubspotTrackingCookie('hubspotutk=')).toBeNull()
  })
})
