import { describe, expect, it } from 'vitest'

import {
  corsHeaders,
  parseEnvFile,
  proxyConfig,
  route,
  upstreamHeaders
} from './crossview-dev-proxy'

describe('crossview dev proxy', () => {
  it('reads plain and exported assignments, unquoting values', () => {
    expect(
      parseEnvFile(
        [
          '# comment',
          'export CROSSVIEW_DEPLOYMENT_URL="https://dep.run.comfy.app/"',
          "  COMFY_API_KEY='k'  ",
          'not an assignment'
        ].join('\n')
      )
    ).toEqual({
      CROSSVIEW_DEPLOYMENT_URL: 'https://dep.run.comfy.app/',
      COMFY_API_KEY: 'k'
    })
  })

  it.for<{
    env: Record<string, string>
    files: Record<string, string>
    config?: { target: string; key: string }
  }>([
    {
      env: { CROSSVIEW_DEPLOYMENT_URL: 'https://a/', COMFY_API_KEY: 'env' },
      files: { COMFY_API_KEY: 'file' },
      config: { target: 'https://a', key: 'env' }
    },
    {
      env: {},
      files: { CROSSVIEW_DEPLOYMENT_URL: 'https://b', COMFY_API_KEY: 'file' },
      config: { target: 'https://b', key: 'file' }
    },
    { env: { CROSSVIEW_DEPLOYMENT_URL: 'https://a' }, files: {} },
    { env: { COMFY_API_KEY: 'k' }, files: {} }
  ])('configures $config.target', ({ env, files, config }) => {
    expect(proxyConfig(env, files)).toEqual(config)
  })

  it.for<[string | undefined, boolean]>([
    ['http://localhost:4321', true],
    ['http://127.0.0.1:4321', true],
    ['https://comfy.org', false],
    [undefined, false]
  ])('allows %s from the browser: %s', ([origin, allowed]) => {
    const headers = corsHeaders(origin)
    expect(headers['Access-Control-Allow-Origin']).toBe(
      allowed ? origin : undefined
    )
  })

  it('adds the key and passes on only the headers a job needs', () => {
    expect(
      upstreamHeaders(
        {
          'content-type': 'application/json',
          'idempotency-key': 'k-1',
          cookie: 'session=1'
        },
        'secret'
      )
    ).toEqual({
      authorization: 'Bearer secret',
      'content-type': 'application/json',
      'idempotency-key': 'k-1'
    })
  })

  it.for<[string, string, string]>([
    ['OPTIONS', '/api/v2/jobs', 'preflight'],
    ['POST', '/api/v2/jobs', 'forward'],
    ['GET', '/api/v2/jobs/1', 'forward'],
    ['GET', '/admin', 'notFound']
  ])('routes %s %s to %s', ([method, url, next]) => {
    expect(route(method, url)).toBe(next)
  })
})
