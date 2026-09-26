import { describe, expect, it } from 'vitest'

import { cloudflareAccessHeaders } from './cloudflareAccess'

const SERVICE_TOKEN = {
  DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
  DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
}

describe('cloudflareAccessHeaders', () => {
  it('attaches the service token to a protected backend', () => {
    expect(
      cloudflareAccessHeaders(SERVICE_TOKEN, 'https://nightly.example.com/')
    ).toEqual({
      'CF-Access-Client-Id': 'client-id.access',
      'CF-Access-Client-Secret': 'client-secret'
    })
  })

  it.for([
    { label: 'no service token', env: {} },
    {
      label: 'empty values',
      env: {
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: ''
      }
    }
  ])('sends no headers with $label', ({ env }) => {
    expect(
      cloudflareAccessHeaders(env, 'https://nightly.example.com/')
    ).toBeUndefined()
  })

  it.for([
    'DEV_SERVER_CF_ACCESS_CLIENT_ID',
    'DEV_SERVER_CF_ACCESS_CLIENT_SECRET'
  ])('rejects a token missing %s', (missing) => {
    const env = { ...SERVICE_TOKEN, [missing]: undefined }
    expect(() =>
      cloudflareAccessHeaders(env, 'https://nightly.example.com/')
    ).toThrow('must be configured together')
  })

  it('allows a loopback target so local backends still work', () => {
    expect(
      cloudflareAccessHeaders(SERVICE_TOKEN, 'http://127.0.0.1:8188')
    ).toMatchObject({ 'CF-Access-Client-Id': 'client-id.access' })
  })

  it.for(['http://nightly.example.com/', 'not a url'])(
    'refuses to forward credentials to %s',
    (target) => {
      expect(() => cloudflareAccessHeaders(SERVICE_TOKEN, target)).toThrow(
        'must not be forwarded to a cleartext target'
      )
    }
  )
})
