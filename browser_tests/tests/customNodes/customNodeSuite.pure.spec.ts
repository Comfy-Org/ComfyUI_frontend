import type { Page } from '@playwright/test'
import type { TestCase, TestResult } from '@playwright/test/reporter'
import { createCipheriv, createDecipheriv } from 'node:crypto'
import { inspect } from 'node:util'

import {
  comfyExpect as expect,
  comfyPageFixture as test,
  traceCloudPage
} from '@e2e/fixtures/ComfyPage'
import {
  assertCloudCustomNodeBootGuard,
  customNodeSuiteSettingsFor,
  drainBackendToIdle,
  finalizeCloudCustomNodeBootGuard,
  finalizeCloudCustomNodeBootGuardAtTraceBoundary,
  installCustomNodeBlankStartup,
  installCloudCustomNodeBootGuard,
  readCloudCustomNodeBootGuard,
  runWithCollectedCleanup,
  trackSubmittedPrompts,
  waitForQueueQuiet
} from '@e2e/fixtures/utils/customNodeSuite'
import {
  attachPageDiagnosticEvidence,
  collectConsoleErrors
} from '@e2e/fixtures/utils/consoleErrorCollector'
import { unallowlistedErrors } from '@e2e/fixtures/customNode/consoleErrorLedger'
import CloudTraceReporter, {
  CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES,
  CLOUD_HTTP_502_REDACTION_ANNOTATION,
  redactCloudHttp502Result
} from '@e2e/fixtures/customNode/cloudTraceReporter'
import {
  cloudHttp502EvidenceAdditionalAuthenticatedData,
  cloudHttp502EvidenceBinding,
  serializeCloudHttp502PublicEvidence
} from '@e2e/fixtures/customNode/cloudHttp502Evidence'
import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

interface QueueSnapshot {
  Running: { id: string }[]
  Pending: { id: string }[]
}

// The drain's in-page callbacks are plain functions over `window.app.api`, so
// running them against a scripted api proves the real call sequence (which ids
// get interrupted vs deleted, and whether a cancellation pass happens at all)
// without a browser. The last snapshot repeats once the script runs out.
function scriptedPage(reads: QueueSnapshot[]) {
  const listeners: ((response: unknown) => void)[] = []
  const interrupted: string[] = []
  const deleted: string[] = []
  let read = 0
  const api = {
    getQueue: () => Promise.resolve(reads[Math.min(read++, reads.length - 1)]),
    interrupt: (id: string) => {
      interrupted.push(id)
      return Promise.resolve()
    },
    deleteItem: (type: string, id: string) => {
      deleted.push(`${type}:${id}`)
      return Promise.resolve()
    }
  }
  const page = {
    on: (event: string, listener: (response: unknown) => void) => {
      if (event === 'response') listeners.push(listener)
    },
    off: () => {},
    evaluate: async (fn: (arg?: unknown) => unknown, arg?: unknown) => {
      const saved = Reflect.get(globalThis, 'window') as unknown
      Reflect.set(globalThis, 'window', { app: { api } })
      try {
        return await fn(arg)
      } finally {
        Reflect.set(globalThis, 'window', saved)
      }
    }
  }
  return {
    page: page as unknown as Page,
    listenerCount: () => listeners.length,
    interrupted,
    deleted,
    submit: (promptId: string) => {
      for (const listener of listeners)
        listener({
          request: () => ({ method: () => 'POST' }),
          url: () => 'http://backend/api/prompt',
          status: () => 200,
          json: () => Promise.resolve({ prompt_id: promptId })
        })
    }
  }
}

const IDLE: QueueSnapshot = { Running: [], Pending: [] }
const CLOUD_HTTP_502_EVIDENCE_KEY = Buffer.alloc(32, 7).toString('base64')
const CLOUD_HTTP_502_TEST_BINDING = cloudHttp502EvidenceBinding({
  testId: 'local-trace',
  retry: 0
})

let previousCloudHttp502EvidenceKey: string | undefined

test.beforeEach(() => {
  previousCloudHttp502EvidenceKey = process.env.CLOUD_HTTP_502_EVIDENCE_KEY
  process.env.CLOUD_HTTP_502_EVIDENCE_KEY = CLOUD_HTTP_502_EVIDENCE_KEY
})

test.afterEach(() => {
  if (previousCloudHttp502EvidenceKey === undefined)
    delete process.env.CLOUD_HTTP_502_EVIDENCE_KEY
  else process.env.CLOUD_HTTP_502_EVIDENCE_KEY = previousCloudHttp502EvidenceKey
})

function decryptCloudHttp502Evidence(body: string): unknown {
  const encrypted = JSON.parse(body)
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(CLOUD_HTTP_502_EVIDENCE_KEY, 'base64'),
    Buffer.from(encrypted.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
  decipher.setAAD(
    cloudHttp502EvidenceAdditionalAuthenticatedData(CLOUD_HTTP_502_TEST_BINDING)
  )
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final()
  ])
  const payloadLength = plaintext.readUInt32BE(0)
  return JSON.parse(plaintext.subarray(4, 4 + payloadLength).toString('utf8'))
}

function encryptCloudHttp502TestEvidence(
  value: unknown,
  binding = CLOUD_HTTP_502_TEST_BINDING
) {
  const payload = Buffer.from(JSON.stringify(value))
  const plaintext = Buffer.alloc(1024 * 1024)
  plaintext.writeUInt32BE(payload.length)
  payload.copy(plaintext, 4)
  const iv = Buffer.alloc(12, 9)
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(CLOUD_HTTP_502_EVIDENCE_KEY, 'base64'),
    iv
  )
  cipher.setAAD(cloudHttp502EvidenceAdditionalAuthenticatedData(binding))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.from(
    JSON.stringify(
      {
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64')
      },
      null,
      2
    )
  )
}

function tracedPage(closeError?: unknown) {
  const listeners = new Map<string, ((value: unknown) => void)[]>()
  let closed = false
  let beforeClose: () => void = () => {}
  let notifyClosed: () => void = () => {}
  const closedPage = new Promise<void>((resolve) => {
    notifyClosed = resolve
  })
  const mainFrame = { url: () => 'about:blank' }
  const emit = (event: string, value: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(value)
  }
  const page = {
    on: (event: string, listener: (value: unknown) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener])
    },
    off: (event: string, listener: (value: unknown) => void) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter(
          (candidate) => candidate !== listener
        )
      )
    },
    isClosed: () => closed,
    close: async () => {
      if (closed) return
      beforeClose()
      closed = true
      notifyClosed()
      emit('close', undefined)
      if (closeError) throw closeError
    },
    mainFrame: () => mainFrame
  }
  return {
    page: page as unknown as Page,
    isClosed: () => closed,
    beforeClose: (callback: () => void) => {
      beforeClose = callback
    },
    waitForClose: () => closedPage,
    listenerCount: (event: string) => listeners.get(event)?.length ?? 0,
    consoleError: (text: string) =>
      emit('console', {
        type: () => 'error',
        text: () => text,
        location: () => ({ url: '' })
      }),
    navigate: (url: string) => {
      mainFrame.url = () => url
      emit('framenavigated', mainFrame)
    },
    pageError: (message: string) => emit('pageerror', { message }),
    requestFailed: ({
      url,
      method = 'GET',
      errorText
    }: {
      url: string
      method?: string
      errorText: string
    }) =>
      emit('requestfailed', {
        url: () => url,
        method: () => method,
        failure: () => ({ errorText })
      }),
    respond: ({
      status,
      url = 'http://localhost:4173/api/settings',
      method = 'GET',
      headers = {},
      readBody = () => Promise.resolve('')
    }: {
      status: number
      url?: string
      method?: string
      headers?: Record<string, string>
      readBody?: () => Promise<string>
    }) => {
      for (const listener of listeners.get('response') ?? [])
        listener({
          status: () => status,
          url: () => url,
          request: () => ({ method: () => method }),
          headers: () => headers,
          text: readBody
        })
    }
  }
}

test('fails a recovered Cloud custom-node test on any traced 502 with safe routing evidence', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const collected = collectConsoleErrors(fake.page)
  const warnings: string[] = []
  const warn = console.warn
  console.warn = (...values) => warnings.push(values.map(String).join(' '))
  const responseBody = JSON.stringify({
    error: 'body-secret',
    padding: 'x'.repeat(300)
  })
  fake.consoleError(
    'preflight failed https://cloud.example/api?token=pre502-secret'
  )
  fake.pageError(
    'preflight failed https://cloud.example/api#pre502-fragment-secret'
  )
  expect(collected.errors.join('\n')).toContain('pre502-secret')
  expect(collected.errors.join('\n')).toContain('pre502-fragment-secret')
  const attachments: { name: string; body: string; contentType?: string }[] = []
  await attachPageDiagnosticEvidence(
    fake.page,
    {
      attach: async (name, options) => {
        attachments.push({
          name,
          body: String(options?.body),
          contentType: options?.contentType
        })
      }
    },
    'independent-console-errors.json',
    collected.errors
  )
  expect(attachments).toEqual([])
  fake.respond({
    status: 502,
    method: 'POST',
    url: 'http://localhost:4173/api/settings?token=query-secret',
    headers: {
      'cf-ray': 'abc-SJC',
      server: 'cloudflare',
      via: '1.1 google',
      'set-cookie': 'secret',
      authorization: 'secret'
    },
    readBody: () => Promise.resolve(responseBody)
  })
  fake.respond({ status: 200 })
  for (const message of [
    'fetch failed http://localhost:4173/api/settings?console=query-secret',
    'fetch failed /api/jobs?relative=query-secret',
    'fetch failed wss://socket.example/ws?socket=query-secret',
    'fetch failed //cdn.example/asset?protocol=query-secret',
    'fetch failed settings?bare=query-secret#bare-fragment',
    'fetch failed ?query-only-secret',
    'fetch failed #fragment-only-secret',
    'fetch failed https://cloud.example/api?token="quoted-query-secret"',
    "fetch failed https://cloud.example/api?token='single-query-secret'",
    'fetch failed https://cloud.example/api?token=<angle-query-secret>'
  ])
    fake.consoleError(message)
  fake.consoleError(`upstream repeated ${responseBody}`)
  fake.consoleError('upstream parsed body-secret')
  fake.pageError(
    'request failed http://localhost:4173/api/settings?pageerror="pageerror-query-secret" body-secret'
  )
  fake.navigate('http://localhost:4173/body-secret?navigation=query-secret')
  fake.requestFailed({
    url: 'http://localhost:4173/api/token?request=query-secret',
    errorText: 'upstream failed body-secret /api/token?failure=query-secret'
  })
  await Promise.resolve()
  collected.stop()
  expect(warnings).toEqual([])

  let failure: unknown
  try {
    await trace
      .finalize({
        attach: async (name, options) => {
          attachments.push({
            name,
            body: String(options?.body),
            contentType: options?.contentType
          })
        }
      })
      .catch((error: unknown) => {
        failure = error
      })
  } finally {
    console.warn = warn
  }

  expect(String(failure)).toContain('any 502 fails S1-S12')
  expect(String(failure)).not.toContain('query-secret')
  expect(String(failure)).not.toContain('body-secret')
  expect(String(failure)).not.toContain('characters')
  expect(warnings.join('\n')).not.toContain('query-secret')
  expect(warnings.join('\n')).not.toContain('body-secret')
  expect(warnings.join('\n')).not.toContain(responseBody.slice(0, 200))
  expect(warnings.join('\n')).not.toContain('bodyLength')
  expect(warnings.join('\n')).not.toContain('characters')
  expect(warnings.join('\n')).toContain(
    '[trace] console.error: [free-form text redacted at strict Cloud trace boundary'
  )
  expect(warnings.join('\n')).toContain(
    '[trace] page error: [free-form text redacted at strict Cloud trace boundary'
  )
  expect(warnings.join('\n')).toContain(
    '[trace] navigated: [free-form text redacted at strict Cloud trace boundary'
  )
  expect(warnings.join('\n')).toContain(
    '[trace] request FAILED: [free-form text redacted at strict Cloud trace boundary'
  )
  expect(warnings.join('\n')).toContain(
    '[trace] HTTP 502 POST http://localhost:4173/api/settings'
  )
  expect(fake.listenerCount('response')).toBe(0)
  expect(fake.isClosed()).toBe(true)
  expect(attachments).toHaveLength(3)
  const independentAttachment = attachments.find(
    ({ name }) => name === 'independent-console-errors.json'
  )!
  expect(independentAttachment.body).toContain(
    '[console.error redacted at strict Cloud trace boundary]'
  )
  expect(independentAttachment.body).not.toContain('body-secret')
  expect(independentAttachment.body).not.toContain('query-secret')
  expect(independentAttachment.body).not.toContain('pre502-secret')
  expect(independentAttachment.body).not.toContain('pre502-fragment-secret')
  expect(independentAttachment.body).not.toContain(String(responseBody.length))
  const publicAttachment = attachments.find(
    ({ name }) => name === 'cloud-http-502-responses.json'
  )!
  expect(JSON.parse(publicAttachment.body).evidence).toEqual([
    {
      status: 502,
      method: 'POST',
      url: 'http://localhost:4173/api/settings',
      headers: {
        'cf-ray': 'abc-SJC',
        server: 'cloudflare',
        via: '1.1 google'
      },
      bodyCapture: 'captured'
    }
  ])
  expect(publicAttachment.body).not.toContain('body-secret')
  expect(publicAttachment.body).not.toContain('bodyLength')
  expect(publicAttachment.body).not.toContain(String(responseBody.length))

  const encryptedAttachment = attachments.find(
    ({ name }) => name === 'cloud-http-502-response-bodies.enc.json'
  )!
  expect(decryptCloudHttp502Evidence(encryptedAttachment.body)).toMatchObject([
    {
      method: 'POST',
      url: 'http://localhost:4173/api/settings?token=query-secret',
      body: responseBody,
      bodyCapture: 'captured'
    }
  ])

  const forgedPublicEvidence = JSON.parse(publicAttachment.body)
  forgedPublicEvidence.evidence[0].headers.server = 'body-secret'
  const forgedEncryptedEvidence = JSON.parse(encryptedAttachment.body)
  forgedEncryptedEvidence.authTag = Buffer.alloc(16, 1).toString('base64')

  const validReporterAttachments = attachments.map(
    ({ name, body, contentType }) => ({
      name,
      body: Buffer.from(body),
      contentType: contentType ?? 'application/octet-stream',
      path: `path-${name}-body-secret`
    })
  )
  const validReporterResult = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments: validReporterAttachments,
    status: 'passed'
  } as unknown as TestResult
  redactCloudHttp502Result(validReporterResult, CLOUD_HTTP_502_TEST_BINDING)
  expect(validReporterResult.status).toBe('failed')
  expect(validReporterResult.errors).toEqual([
    {
      message: 'Cloud returned an HTTP 502 response; any 502 fails Cloud S1-S12'
    }
  ])
  expect(
    validReporterAttachments.filter(({ name }) =>
      CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.has(name)
    )
  ).toHaveLength(2)
  expect(
    validReporterAttachments.filter(
      ({ name }) => name === 'redacted-http-502-attachment.txt'
    )
  ).toHaveLength(1)

  const replayedAttachments = attachments.map(
    ({ name, body, contentType }) => ({
      name,
      body: Buffer.from(body),
      contentType: contentType ?? 'application/octet-stream'
    })
  )
  const replayedResult = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments: replayedAttachments,
    status: 'passed'
  } as unknown as TestResult
  redactCloudHttp502Result(replayedResult, {
    ...CLOUD_HTTP_502_TEST_BINDING,
    testId: 'another-test'
  })
  expect(replayedResult.status).toBe('failed')
  expect(
    replayedAttachments.every(
      ({ name }) => name === 'redacted-http-502-attachment.txt'
    )
  ).toBe(true)

  const invalidPlaintextAttachments = [
    {
      name: publicAttachment.name,
      body: Buffer.from(publicAttachment.body),
      contentType: publicAttachment.contentType!
    },
    {
      name: encryptedAttachment.name,
      body: encryptCloudHttp502TestEvidence({
        body: 'authenticated-lookalike'
      }),
      contentType: encryptedAttachment.contentType!
    }
  ]
  const invalidPlaintextResult = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments: invalidPlaintextAttachments,
    status: 'passed'
  } as unknown as TestResult
  redactCloudHttp502Result(invalidPlaintextResult, CLOUD_HTTP_502_TEST_BINDING)
  expect(invalidPlaintextResult.status).toBe('failed')
  expect(
    invalidPlaintextAttachments.every(
      ({ name }) => name === 'redacted-http-502-attachment.txt'
    )
  ).toBe(true)

  const reporterAttachments = [
    ...attachments.map(({ name, body, contentType }) => ({
      name,
      body: Buffer.from(body),
      contentType: contentType ?? 'application/octet-stream',
      path: `path-${name}-body-secret`
    })),
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from('typed-collision=body-secret'),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: Buffer.from('typed-encrypted-collision=query-secret'),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    },
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        '[{"status":502,"method":"GET","url":"https://cloud.example/api","headers":{"server":"body-secret"},"headers":{},"bodyCapture":"captured"}]'
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(JSON.stringify(forgedPublicEvidence, null, 2)),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: Buffer.from(JSON.stringify(forgedEncryptedEvidence, null, 2)),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    }
  ]
  const reporterResult = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments: reporterAttachments,
    status: 'passed'
  } as unknown as TestResult
  redactCloudHttp502Result(reporterResult, CLOUD_HTTP_502_TEST_BINDING)
  expect(reporterResult.status).toBe('failed')
  expect(
    reporterAttachments.filter(({ name }) =>
      CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.has(name)
    )
  ).toHaveLength(0)
  expect(
    reporterAttachments.filter(
      ({ name }) => name === 'redacted-http-502-attachment.txt'
    )
  ).toHaveLength(8)
  expect(
    reporterAttachments.map(({ body }) => body.toString()).join('\n')
  ).not.toContain('body-secret')
  expect(
    reporterAttachments.map(({ body }) => body.toString()).join('\n')
  ).not.toContain('query-secret')
  expect(
    reporterAttachments.every(
      (attachment) => !('path' in attachment) || attachment.path === undefined
    )
  ).toBe(true)
})

test('rejects 502 evidence replayed across every result-binding dimension', () => {
  const evidence = [
    {
      status: 502,
      method: 'GET',
      url: 'https://cloud.example/api',
      headers: { 'cf-ray': 'abc-SJC' },
      bodyCapture: 'captured'
    }
  ]
  const attachments = [
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        serializeCloudHttp502PublicEvidence(
          evidence,
          CLOUD_HTTP_502_TEST_BINDING
        )
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: encryptCloudHttp502TestEvidence([
        { ...evidence[0], body: 'Bad Gateway' }
      ]),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    }
  ]
  for (const binding of [
    { ...CLOUD_HTTP_502_TEST_BINDING, runId: 'another-run' },
    { ...CLOUD_HTTP_502_TEST_BINDING, runAttempt: '2' },
    { ...CLOUD_HTTP_502_TEST_BINDING, testId: 'another-test' },
    { ...CLOUD_HTTP_502_TEST_BINDING, retry: 1 }
  ]) {
    const replayedAttachments = attachments.map((attachment) => ({
      ...attachment,
      body: Buffer.from(attachment.body)
    }))
    const result = {
      annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
      errors: [],
      steps: [],
      stdout: [],
      stderr: [],
      attachments: replayedAttachments,
      status: 'passed'
    } as unknown as TestResult

    redactCloudHttp502Result(result, binding)

    expect(result.status).toBe('failed')
    expect(
      replayedAttachments.every(
        ({ name }) => name === 'redacted-http-502-attachment.txt'
      )
    ).toBe(true)
  }
})

for (const [privateLocation, url, privateSecret] of [
  [
    'query',
    'https://cloud.example/api?token=mirrored-query-secret',
    'mirrored-query-secret'
  ],
  [
    'fragment',
    'https://cloud.example/api#token=mirrored-fragment-secret',
    'mirrored-fragment-secret'
  ]
] as const) {
  test(`rejects a public routing value derived from a private ${privateLocation}`, async () => {
    const fake = tracedPage()
    const trace = traceCloudPage(fake.page, true, CLOUD_HTTP_502_TEST_BINDING)
    const warnings: string[] = []
    const warn = console.warn
    console.warn = (...values) => warnings.push(values.map(String).join(' '))

    const annotations: { type: string }[] = []
    const attachments: {
      name: string
      body: Buffer
      contentType: string
    }[] = []
    try {
      fake.respond({
        status: 502,
        url,
        headers: { server: privateSecret },
        readBody: () => Promise.resolve('Bad Gateway')
      })
      await trace
        .finalize({
          annotations,
          attach: async (name, options) => {
            attachments.push({
              name,
              body: Buffer.from(String(options?.body)),
              contentType: options?.contentType ?? 'application/octet-stream'
            })
          }
        })
        .catch(() => {})
    } finally {
      console.warn = warn
    }
    const result = {
      annotations,
      errors: [],
      steps: [],
      stdout: [],
      stderr: [],
      attachments,
      status: 'passed'
    } as unknown as TestResult

    redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

    expect(result.status).toBe('failed')
    expect(result.errors).toEqual([
      {
        message:
          'Cloud HTTP 502 evidence failed reporter authentication or result binding'
      }
    ])
    expect(
      attachments.every(
        ({ name }) => name === 'redacted-http-502-attachment.txt'
      )
    ).toBe(true)
    expect(
      attachments.map(({ body }) => body.toString()).join('\n')
    ).not.toContain(privateSecret)
    expect(warnings.join('\n')).not.toContain(privateSecret)
  })
}

test('redacts authenticated public evidence when response-body capture is unavailable', () => {
  const attachments = [
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        serializeCloudHttp502PublicEvidence(
          [
            {
              status: 502,
              method: 'GET',
              url: 'https://cloud.example/api',
              headers: { 'cf-ray': 'abc-SJC' },
              bodyCapture: 'unavailable'
            }
          ],
          CLOUD_HTTP_502_TEST_BINDING
        )
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    }
  ]
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(result.errors).toEqual([
    {
      message:
        'Cloud HTTP 502 evidence failed reporter authentication or result binding'
    }
  ])
  expect(attachments).toMatchObject([
    {
      name: 'redacted-http-502-attachment.txt',
      contentType: 'text/plain'
    }
  ])
  expect(attachments[0].body.toString()).not.toContain('cloud.example')
})

test('derives reporter evidence binding and independently fails the 502 result', () => {
  const previousRunId = process.env.GITHUB_RUN_ID
  const previousRunAttempt = process.env.GITHUB_RUN_ATTEMPT
  process.env.GITHUB_RUN_ID = '123456'
  process.env.GITHUB_RUN_ATTEMPT = '3'
  try {
    const testCase = {
      id: 'reporter-test-id',
      annotations: []
    } as unknown as TestCase
    const binding = cloudHttp502EvidenceBinding({
      testId: testCase.id,
      retry: 2
    })
    const evidence = [
      {
        status: 502,
        method: 'GET',
        url: 'https://cloud.example/api',
        headers: {},
        bodyCapture: 'captured' as const
      }
    ]
    const attachments = [
      {
        name: 'cloud-http-502-responses.json',
        body: Buffer.from(
          serializeCloudHttp502PublicEvidence(evidence, binding)
        ),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-responses.json'
        )!
      },
      {
        name: 'cloud-http-502-response-bodies.enc.json',
        body: encryptCloudHttp502TestEvidence(
          [{ ...evidence[0], body: 'Bad Gateway' }],
          binding
        ),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-response-bodies.enc.json'
        )!
      }
    ]
    const result = {
      annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
      errors: [],
      steps: [],
      stdout: [],
      stderr: [],
      attachments,
      status: 'passed',
      retry: 2
    } as unknown as TestResult

    new CloudTraceReporter().onTestEnd(testCase, result)

    expect(result.status).toBe('failed')
    expect(result.errors).toEqual([
      {
        message:
          'Cloud returned an HTTP 502 response; any 502 fails Cloud S1-S12'
      }
    ])
    expect(result.attachments.map(({ name }) => name)).toEqual([
      'cloud-http-502-responses.json',
      'cloud-http-502-response-bodies.enc.json'
    ])
  } finally {
    if (previousRunId === undefined) delete process.env.GITHUB_RUN_ID
    else process.env.GITHUB_RUN_ID = previousRunId
    if (previousRunAttempt === undefined) delete process.env.GITHUB_RUN_ATTEMPT
    else process.env.GITHUB_RUN_ATTEMPT = previousRunAttempt
  }
})

test('rejects authenticated public routing evidence that contains any raw body', () => {
  const body = 'cross-record-derived-secret-full-body'
  const derivedBodyContent = 'derived-secret'
  const evidence = [
    {
      status: 502 as const,
      method: 'GET',
      url: 'https://cloud.example/api/first',
      headers: { server: derivedBodyContent },
      bodyCapture: 'captured' as const
    },
    {
      status: 502 as const,
      method: 'GET',
      url: 'https://cloud.example/api/second',
      headers: {},
      bodyCapture: 'captured' as const
    }
  ]
  const attachments = [
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        serializeCloudHttp502PublicEvidence(
          evidence,
          CLOUD_HTTP_502_TEST_BINDING
        )
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: encryptCloudHttp502TestEvidence([
        { ...evidence[0], body: 'first-private-body' },
        { ...evidence[1], body }
      ]),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    }
  ]
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(result.errors).toEqual([
    {
      message:
        'Cloud HTTP 502 evidence failed reporter authentication or result binding'
    }
  ])
  expect(
    attachments.every(({ name }) => name === 'redacted-http-502-attachment.txt')
  ).toBe(true)
  expect(
    attachments.map(({ body }) => body.toString()).join('\n')
  ).not.toContain(body)
  expect(
    attachments.map(({ body }) => body.toString()).join('\n')
  ).not.toContain(derivedBodyContent)
})

for (const [field, body] of [
  ['status', '502'],
  ['method', 'GET'],
  ['bodyCapture', 'captured']
] as const) {
  test(`rejects a captured body colliding with the public ${field}`, () => {
    const evidence = [
      {
        status: 502 as const,
        method: 'GET',
        url: 'https://cloud.example/api',
        headers: {},
        bodyCapture: 'captured' as const
      }
    ]
    const attachments = [
      {
        name: 'cloud-http-502-responses.json',
        body: Buffer.from(
          serializeCloudHttp502PublicEvidence(
            evidence,
            CLOUD_HTTP_502_TEST_BINDING
          )
        ),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-responses.json'
        )!
      },
      {
        name: 'cloud-http-502-response-bodies.enc.json',
        body: encryptCloudHttp502TestEvidence([{ ...evidence[0], body }]),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-response-bodies.enc.json'
        )!
      }
    ]
    const result = {
      annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
      errors: [],
      steps: [],
      stdout: [],
      stderr: [],
      attachments,
      status: 'passed'
    } as unknown as TestResult

    redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

    expect(result.status).toBe('failed')
    expect(result.errors).toEqual([
      {
        message:
          'Cloud HTTP 502 evidence failed reporter authentication or result binding'
      }
    ])
    expect(
      attachments.every(
        ({ name }) => name === 'redacted-http-502-attachment.txt'
      )
    ).toBe(true)
  })
}

test('rejects authenticated encrypted evidence with an invalid plaintext schema', () => {
  const evidence = [
    {
      status: 502,
      method: 'GET',
      url: 'https://cloud.example/api',
      headers: {},
      bodyCapture: 'captured'
    }
  ]
  const attachments = [
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        serializeCloudHttp502PublicEvidence(
          evidence,
          CLOUD_HTTP_502_TEST_BINDING
        )
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: encryptCloudHttp502TestEvidence({
        body: 'authenticated-lookalike'
      }),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    }
  ]
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(
    attachments.every(({ name }) => name === 'redacted-http-502-attachment.txt')
  ).toBe(true)
})

test('rejects duplicate authenticated 502 evidence attachments', () => {
  const body = Buffer.from(
    serializeCloudHttp502PublicEvidence(
      [
        {
          status: 502,
          method: 'GET',
          url: 'https://cloud.example/api',
          headers: {},
          bodyCapture: 'unavailable'
        }
      ],
      CLOUD_HTTP_502_TEST_BINDING
    )
  )
  const attachments = [0, 1].map(() => ({
    name: 'cloud-http-502-responses.json',
    body: Buffer.from(body),
    contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
      'cloud-http-502-responses.json'
    )!
  }))
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(
    attachments.every(({ name }) => name === 'redacted-http-502-attachment.txt')
  ).toBe(true)
})

test('rejects mismatched authenticated public and encrypted 502 evidence', () => {
  const publicEvidence = [
    {
      status: 502,
      method: 'GET',
      url: 'https://cloud.example/public-path',
      headers: {},
      bodyCapture: 'captured'
    }
  ]
  const attachments = [
    {
      name: 'cloud-http-502-responses.json',
      body: Buffer.from(
        serializeCloudHttp502PublicEvidence(
          publicEvidence,
          CLOUD_HTTP_502_TEST_BINDING
        )
      ),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-responses.json'
      )!
    },
    {
      name: 'cloud-http-502-response-bodies.enc.json',
      body: encryptCloudHttp502TestEvidence([
        {
          ...publicEvidence[0],
          url: 'https://cloud.example/encrypted-path',
          body: 'Bad Gateway'
        }
      ]),
      contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
        'cloud-http-502-response-bodies.enc.json'
      )!
    }
  ]
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(
    attachments.every(({ name }) => name === 'redacted-http-502-attachment.txt')
  ).toBe(true)
})

test('rejects authenticated public 502 evidence with unsafe fields', () => {
  const base = {
    status: 502,
    method: 'GET',
    url: 'https://cloud.example/api',
    headers: {},
    bodyCapture: 'captured'
  }
  const unsafeRecords = [
    { ...base, headers: { authorization: 'secret' } },
    { ...base, headers: { 'set-cookie': 'secret' } },
    { ...base, headers: { via: 'proxy?token=secret' } },
    { ...base, headers: { via: 'proxy#secret' } },
    { ...base, url: 'https://cloud.example/api?token=secret' },
    { ...base, url: 'https://cloud.example/api#secret' },
    { ...base, url: 'https://user:pass@cloud.example/api' },
    { ...base, extra: 'secret' },
    { ...base, method: 'get' },
    { ...base, bodyCapture: 'pending' }
  ]

  for (const evidence of unsafeRecords) {
    const attachments = [
      {
        name: 'cloud-http-502-responses.json',
        body: Buffer.from(
          serializeCloudHttp502PublicEvidence(
            [evidence],
            CLOUD_HTTP_502_TEST_BINDING
          )
        ),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-responses.json'
        )!
      },
      {
        name: 'cloud-http-502-response-bodies.enc.json',
        body: encryptCloudHttp502TestEvidence([
          { ...evidence, body: 'Bad Gateway' }
        ]),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-response-bodies.enc.json'
        )!
      }
    ]
    const result = {
      annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
      errors: [],
      steps: [],
      stdout: [],
      stderr: [],
      attachments,
      status: 'passed'
    } as unknown as TestResult

    redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

    expect(result.status).toBe('failed')
    expect(attachments[0]).toMatchObject({
      name: 'redacted-http-502-attachment.txt',
      contentType: 'text/plain'
    })
  }
})

test('fails closed when an annotated 502 result has no public evidence', () => {
  const attachments = [
    {
      name: 'unrelated-secret.txt',
      body: Buffer.from('secret'),
      contentType: 'text/plain'
    }
  ]
  const result = {
    annotations: [{ type: CLOUD_HTTP_502_REDACTION_ANNOTATION }],
    errors: [],
    steps: [],
    stdout: [],
    stderr: [],
    attachments,
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.status).toBe('failed')
  expect(attachments[0]).toMatchObject({
    name: 'redacted-http-502-attachment.txt',
    contentType: 'text/plain'
  })
})

test('removes result metadata at the reporter privacy boundary', () => {
  const annotationSecret = 'body-secret?token=query-secret#fragment-secret'
  const result = {
    annotations: [
      { type: CLOUD_HTTP_502_REDACTION_ANNOTATION },
      { type: annotationSecret, description: annotationSecret }
    ],
    errors: [],
    steps: [
      {
        title: annotationSecret,
        category: 'test.step',
        startTime: new Date(),
        duration: 1,
        steps: [],
        annotations: [
          { type: annotationSecret, description: annotationSecret }
        ],
        location: { file: annotationSecret, line: 1, column: 1 }
      }
    ],
    stdout: [annotationSecret],
    stderr: [annotationSecret],
    attachments: [
      {
        name: 'cloud-http-502-responses.json',
        body: Buffer.from(
          serializeCloudHttp502PublicEvidence(
            [
              {
                status: 502,
                method: 'GET',
                url: 'https://cloud.example/api',
                headers: {},
                bodyCapture: 'unavailable'
              }
            ],
            CLOUD_HTTP_502_TEST_BINDING
          )
        ),
        contentType: CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(
          'cloud-http-502-responses.json'
        )!
      }
    ],
    status: 'passed'
  } as unknown as TestResult

  redactCloudHttp502Result(result, CLOUD_HTTP_502_TEST_BINDING)

  expect(result.annotations).toEqual([])
  expect(result.steps).toEqual([])
  expect(result.stdout).toEqual([])
  expect(result.stderr).toEqual([])
})

test('arms reporter redaction after Playwright has recorded a concurrent test error', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const testInfo = {
    annotations: [] as { type: string }[],
    errors: [
      {
        message: 'assertion exposed body-secret',
        stack:
          'Error: request failed https://cloud.example/api?token=query-secret',
        value: 'body-secret',
        errorContext: 'query-secret',
        cause: { message: 'nested body-secret' }
      }
    ],
    attach: async () => {}
  }
  fake.respond({
    status: 502,
    url: 'https://cloud.example/api?token=query-secret',
    readBody: () => Promise.resolve('body-secret')
  })

  await trace.finalize(testInfo).catch(() => {})

  expect(testInfo.annotations).toEqual([
    { type: 'cloud-http-502-reporter-redaction' }
  ])
  expect(testInfo.errors).toEqual([
    {
      message:
        'Test failure details redacted because this test observed an HTTP 502; see cloud-http-502-responses.json'
    }
  ])
})

test('keeps strict Cloud diagnostics exact internally and defers safe public evidence', async () => {
  const previousEnv = process.env.CUSTOM_NODES_ENV
  process.env.CUSTOM_NODES_ENV = 'cloud'
  try {
    const fake = tracedPage()
    const trace = traceCloudPage(fake.page, true)
    const collected = collectConsoleErrors(fake.page)
    const diagnostic =
      'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/api/view?type=input&filename=beach.jpg&subfolder=]'
    fake.consoleError(diagnostic)

    expect(collected.errors).toEqual([diagnostic])
    expect(unallowlistedErrors('any-pack', collected.errors)).toEqual([])

    const attachments: { name: string; body: string }[] = []
    await attachPageDiagnosticEvidence(
      fake.page,
      {
        attach: async (name, options) => {
          attachments.push({ name, body: String(options?.body) })
        }
      },
      'console-errors.json',
      collected.errors
    )
    expect(attachments).toEqual([])

    await trace.finalize({
      attach: async (name, options) => {
        attachments.push({ name, body: String(options?.body) })
      }
    })

    expect(fake.isClosed()).toBe(true)
    expect(attachments).toEqual([
      {
        name: 'console-errors.json',
        body: JSON.stringify(
          [
            'Failed to load resource: the server responded with a status of 404 (Not Found) [http://localhost:4173/api/view'
          ],
          null,
          2
        )
      }
    ])
  } finally {
    if (previousEnv === undefined) delete process.env.CUSTOM_NODES_ENV
    else process.env.CUSTOM_NODES_ENV = previousEnv
  }
})

test('keeps the 502 listener active while closing the strict Cloud trace boundary', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  fake.beforeClose(() =>
    fake.respond({
      status: 502,
      url: 'https://cloud.example/api/late?token=secret',
      readBody: () => Promise.resolve('late-body-secret')
    })
  )

  const attachments: { name: string; body: string }[] = []
  let failure: unknown
  await trace
    .finalize({
      attach: async (name, options) => {
        attachments.push({ name, body: String(options?.body) })
      }
    })
    .catch((error: unknown) => {
      failure = error
    })

  expect(String(failure)).toContain('any 502 fails S1-S12')
  expect(String(failure)).not.toContain('token=secret')
  expect(String(failure)).not.toContain('late-body-secret')
  expect(fake.listenerCount('response')).toBe(0)
  expect(
    JSON.parse(
      attachments.find(({ name }) => name === 'cloud-http-502-responses.json')!
        .body
    ).evidence
  ).toEqual([
    {
      status: 502,
      method: 'GET',
      url: 'https://cloud.example/api/late',
      headers: {},
      bodyCapture: 'captured'
    }
  ])
})

test('redacts deferred diagnostics when strict Cloud page close fails', async () => {
  const fake = tracedPage(
    new Error(
      'opaque-lifecycle-secret close https://cloud.example/finalize?close-secret#close-fragment'
    )
  )
  const trace = traceCloudPage(fake.page, true)
  const attachments: { name: string; body: string }[] = []
  const testInfo = {
    attach: async (name: string, options?: { body?: string | Buffer }) => {
      attachments.push({ name, body: String(options?.body) })
    }
  }
  const warnings: string[] = []
  const warn = console.warn
  console.warn = (...values) => warnings.push(values.map(String).join(' '))
  fake.consoleError(
    'diagnostic https://cloud.example/api/view?token=secret#fragment-secret'
  )

  let failure: unknown
  try {
    await attachPageDiagnosticEvidence(
      fake.page,
      testInfo,
      'console-errors.json',
      ['diagnostic https://cloud.example/api/view?token=secret#fragment-secret']
    )
    expect(attachments).toEqual([])
    failure = await trace.finalize(testInfo).catch((error: unknown) => error)
  } finally {
    console.warn = warn
  }

  expect(String(failure)).not.toContain('close-secret')
  expect(String(failure)).not.toContain('close-fragment')
  expect(inspect(failure, { depth: null })).toContain(
    'Free-form Error message redacted at strict Cloud trace boundary'
  )
  expect(inspect(failure, { depth: null })).not.toContain(
    'opaque-lifecycle-secret'
  )
  expect(warnings).toEqual([
    '[trace] console.error: [free-form text redacted at strict Cloud trace boundary]'
  ])
  expect(warnings.join('\n')).not.toContain('diagnostic')
  expect(warnings.join('\n')).not.toContain('secret')
  expect(attachments).toEqual([
    {
      name: 'console-errors.json',
      body: JSON.stringify(
        ['[console.error redacted at strict Cloud trace boundary]'],
        null,
        2
      )
    }
  ])
})

test('redacts strict Cloud diagnostic attachment failures without a 502', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const testInfo = {
    attach: async () => {
      throw new Error('opaque-attachment-secret')
    }
  }

  await attachPageDiagnosticEvidence(
    fake.page,
    testInfo,
    'console-errors.json',
    ['opaque diagnostic']
  )
  const failure = await trace
    .finalize(testInfo)
    .catch((error: unknown) => error)
  const rendered = inspect(failure, { depth: null })

  expect(rendered).toContain(
    'Free-form Error message redacted at strict Cloud trace boundary'
  )
  expect(rendered).not.toContain('opaque-attachment-secret')
})

test('uses a fixed-size encrypted envelope for different 502 body sizes', async () => {
  const ciphertextLengths: number[] = []
  for (const body of ['short', 'x'.repeat(200_000)]) {
    const fake = tracedPage()
    const trace = traceCloudPage(fake.page, true)
    fake.respond({ status: 502, readBody: () => Promise.resolve(body) })

    const attachments: { name: string; body: string }[] = []
    await trace
      .finalize({
        attach: async (name, options) => {
          attachments.push({ name, body: String(options?.body) })
        }
      })
      .catch(() => {})

    const encryptedAttachment = attachments.find(
      ({ name }) => name === 'cloud-http-502-response-bodies.enc.json'
    )!
    const encrypted = JSON.parse(encryptedAttachment.body)
    ciphertextLengths.push(Buffer.from(encrypted.ciphertext, 'base64').length)
    expect(decryptCloudHttp502Evidence(encryptedAttachment.body)).toMatchObject(
      [{ body, bodyCapture: 'captured' }]
    )
  }

  expect(ciphertextLengths[0]).toBe(ciphertextLengths[1])
  expect(ciphertextLengths[0]).toBe(1024 * 1024)
})

test('fails closed when 502 evidence exceeds the fixed encrypted envelope', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  fake.respond({
    status: 502,
    readBody: () => Promise.resolve('x'.repeat(2 * 1024 * 1024))
  })

  const attachments: { name: string; body: string }[] = []
  const failure = await trace
    .finalize({
      attach: async (name, options) => {
        attachments.push({ name, body: String(options?.body) })
      }
    })
    .catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(AggregateError)
  const evidenceFailure = String((failure as AggregateError).errors[1])
  expect(evidenceFailure).toContain(
    'Cloud HTTP 502 encrypted evidence could not be retained'
  )
  expect(evidenceFailure).not.toMatch(/capacity|threshold|bytes?|size|1048576/i)
  expect(attachments.map(({ name }) => name)).toEqual([
    'cloud-http-502-responses.json'
  ])
})

test('ends a non-settling 502 body read at the trace lifecycle boundary', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  fake.respond({
    status: 502,
    readBody: () => new Promise<string>(() => {})
  })

  const attachments: { name: string; body: string }[] = []
  const failure = await trace
    .finalize({
      attach: async (name, options) => {
        attachments.push({ name, body: String(options?.body) })
      }
    })
    .catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toHaveLength(2)
  expect(attachments.map(({ name }) => name)).toEqual([
    'cloud-http-502-responses.json'
  ])
  expect(JSON.parse(attachments[0].body).evidence).toMatchObject([
    { bodyCapture: 'unavailable' }
  ])
  expect(attachments[0].body).not.toContain('bodyLength')
  expect(fake.isClosed()).toBe(true)
})

test('captures 502 evidence after page closure settles the fixture operation', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const attachments: string[] = []
  const result = runWithCollectedCleanup(
    () =>
      trace.run(async () => {
        await fake.waitForClose()
        throw new Error('page closed')
      }),
    [
      () =>
        trace.finalize({
          attach: async (_name, options) => {
            attachments.push(String(options?.body))
          }
        })
    ]
  ).catch((error: unknown) => error)

  fake.respond({
    status: 502,
    method: 'POST',
    readBody: () => Promise.resolve('Bad Gateway')
  })

  const failure = await result
  expect(String(failure)).toContain('any 502 fails S1-S12')
  expect(fake.isClosed()).toBe(true)
  expect(attachments).toHaveLength(2)
  expect(JSON.parse(attachments[0]).evidence).toMatchObject([
    {
      method: 'POST',
      bodyCapture: 'captured'
    }
  ])
  expect(attachments[0]).not.toContain('Bad Gateway')
  expect(attachments[0]).not.toContain('bodyLength')
})

test('preserves the 502 gate when attaching its evidence also fails', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const attachError = new Error('attachment failed')
  fake.respond({ status: 502 })

  const failure = await trace
    .finalize({
      attach: async () => {
        throw attachError
      }
    })
    .catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toHaveLength(3)
  expect(String((failure as AggregateError).errors[0])).toContain(
    'any 502 fails S1-S12'
  )
  for (const error of (failure as AggregateError).errors.slice(1)) {
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain(
      'Free-form Error message redacted at strict Cloud trace boundary'
    )
    expect(error).not.toBe(attachError)
  }
  expect(inspect(failure, { depth: null })).not.toContain('attachment failed')
  expect(fake.listenerCount('response')).toBe(0)
})

test('fails raw 502 capture closed when the encryption key is unavailable', async () => {
  delete process.env.CLOUD_HTTP_502_EVIDENCE_KEY
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  fake.respond({
    status: 502,
    readBody: () => Promise.resolve('sensitive upstream response')
  })

  const attachments: { name: string; body: string }[] = []
  const failure = await trace
    .finalize({
      attach: async (name, options) => {
        attachments.push({ name, body: String(options?.body) })
      }
    })
    .catch((error: unknown) => error)

  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toHaveLength(3)
  for (const error of (failure as AggregateError).errors.slice(1))
    expect(String(error)).toContain('CLOUD_HTTP_502_EVIDENCE_KEY is required')
  expect(attachments).toEqual([])
})

for (const [name, key] of [
  ['invalid base64 characters', `${CLOUD_HTTP_502_EVIDENCE_KEY}!`],
  ['31 decoded bytes', Buffer.alloc(31, 7).toString('base64')],
  ['33 decoded bytes', Buffer.alloc(33, 7).toString('base64')]
] as const) {
  test(`fails raw 502 capture closed for ${name}`, async () => {
    process.env.CLOUD_HTTP_502_EVIDENCE_KEY = key
    const fake = tracedPage()
    const trace = traceCloudPage(fake.page, true)
    fake.respond({
      status: 502,
      readBody: () => Promise.resolve('sensitive upstream response')
    })

    const attachments: string[] = []
    const failure = await trace
      .finalize({
        attach: async (attachmentName) => {
          attachments.push(attachmentName)
        }
      })
      .catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toHaveLength(3)
    for (const error of (failure as AggregateError).errors.slice(1))
      expect(String(error)).toContain(
        'must be canonical base64 for exactly 32 bytes'
      )
    expect(attachments).toEqual([])
  })
}

test('marks 502 body capture unavailable when Playwright cannot read it', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  fake.respond({
    status: 502,
    url: 'http://localhost:4173/api/first',
    readBody: () => Promise.reject(new Error('page closed'))
  })
  await Promise.resolve()

  const attachments: string[] = []
  const failure = await trace
    .finalize({
      attach: async (_name, options) => {
        attachments.push(String(options?.body))
      }
    })
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toHaveLength(2)
  expect(String((failure as AggregateError).errors[0])).toContain(
    'any 502 fails S1-S12'
  )
  expect(String((failure as AggregateError).errors[1])).toContain(
    'response-body capture was incomplete for 1 response(s)'
  )
  const publicEvidence = JSON.parse(attachments[0]).evidence
  expect(publicEvidence).toMatchObject([
    {
      url: 'http://localhost:4173/api/first',
      bodyCapture: 'unavailable'
    }
  ])
  expect(publicEvidence[0]).not.toHaveProperty('body')
  expect(fake.listenerCount('response')).toBe(0)
})

test('does not invent a hard-gate failure when Cloud returns no 502', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  let attachments = 0
  fake.respond({
    status: 500,
    readBody: () => Promise.resolve('Internal Server Error')
  })
  fake.respond({ status: 200 })
  await expect(
    trace.finalize({
      attach: async () => {
        attachments += 1
      }
    })
  ).resolves.toBeUndefined()
  expect(attachments).toBe(0)
  expect(fake.listenerCount('response')).toBe(0)
})

test('keeps Core blank and Cloud onboarding-free on its first boot', () => {
  expect(customNodeSuiteSettingsFor('core')).toMatchObject({
    'Comfy.TutorialCompleted': true,
    'Comfy.Workflow.Persist': true,
    'Comfy.RightSidePanel.ShowErrorsTab': true
  })
  expect(customNodeSuiteSettingsFor('cloud')).toMatchObject({
    'Comfy.TutorialCompleted': true,
    'Comfy.Workflow.Persist': true,
    'Comfy.RightSidePanel.ShowErrorsTab': true
  })
})

test('preseeds a restorable blank workflow before first boot', async ({
  page
}) => {
  const path = 'workflows/Custom Nodes E2E Blank Workflow.json'
  const draftKey = StorageKeys.draftKey(path)
  const keys = {
    index: StorageKeys.draftIndex('personal'),
    payload: StorageKeys.draftPayload(path, 'personal'),
    active: StorageKeys.lastActivePath('personal'),
    open: StorageKeys.lastOpenPaths('personal')
  }
  await installCustomNodeBlankStartup(page)
  await page.route('http://guard.test/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' })
  )
  await page.goto('http://guard.test/')

  const state = await page.evaluate(
    ({ keys, path }) => {
      const index = JSON.parse(localStorage.getItem(keys.index)!)
      const payload = JSON.parse(localStorage.getItem(keys.payload)!)
      return {
        storedKeys: Object.keys(localStorage)
          .filter((key) => key.startsWith('Comfy.Workflow.'))
          .sort(),
        index,
        payload,
        active: JSON.parse(localStorage.getItem(keys.active)!),
        open: JSON.parse(localStorage.getItem(keys.open)!),
        path
      }
    },
    { keys, path }
  )

  expect(state.storedKeys).toEqual(Object.values(keys).sort())
  expect(state.index).toEqual({
    v: 2,
    updatedAt: expect.any(Number),
    order: [draftKey],
    entries: {
      [draftKey]: {
        path,
        name: 'Custom Nodes E2E Blank Workflow.json',
        isTemporary: true,
        updatedAt: state.index.updatedAt
      }
    }
  })
  expect(state.payload).toEqual({
    data: JSON.stringify({
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4
    }),
    updatedAt: state.index.updatedAt
  })
  expect(state.active).toEqual({ workspaceId: 'personal', path })
  expect(state.open).toEqual({
    workspaceId: 'personal',
    paths: [path],
    activeIndex: 0
  })
})

for (const testId of ['template-filter-bar', 'getting-started-blank']) {
  test(`records transient ${testId} onboarding on the first boot`, async ({
    page
  }) => {
    await installCloudCustomNodeBootGuard(page)
    await page.route('http://guard.test/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body></body></html>'
      })
    )
    await page.goto('http://guard.test/')
    expect(await readCloudCustomNodeBootGuard(page)).toEqual({
      bootCount: 1,
      onboarding: null
    })

    await page.evaluate((id) => {
      const surface = document.createElement('div')
      surface.dataset.testid = id
      document.body.append(surface)
      surface.remove()
    }, testId)

    await expect
      .poll(() => readCloudCustomNodeBootGuard(page))
      .toEqual({ bootCount: 1, onboarding: testId })
    expect(() =>
      assertCloudCustomNodeBootGuard({ bootCount: 1, onboarding: testId })
    ).toThrow(`opened ${testId}`)
  })
}

for (const testId of ['template-filter-bar', 'getting-started-blank']) {
  test(`records transient ${testId} attribute changes`, async ({ page }) => {
    await installCloudCustomNodeBootGuard(page)
    await page.route('http://guard.test/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body></body></html>'
      })
    )
    await page.goto('http://guard.test/')

    await page.evaluate((id) => {
      const surface = document.createElement('div')
      document.body.append(surface)
      surface.dataset.testid = id
      surface.removeAttribute('data-testid')
    }, testId)

    await expect
      .poll(() => readCloudCustomNodeBootGuard(page))
      .toEqual({ bootCount: 1, onboarding: testId })
  })
}

for (const testId of ['template-filter-bar', 'getting-started-blank']) {
  test(`records ${testId} rendered synchronously during startup`, async ({
    page
  }) => {
    await installCloudCustomNodeBootGuard(page)
    await page.route('http://guard.test/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<script>
          const surface = document.createElement('div')
          surface.dataset.testid = '${testId}'
          document.documentElement.append(surface)
          surface.remove()
        </script>`
      })
    )
    await page.goto('http://guard.test/')

    await expect
      .poll(() => readCloudCustomNodeBootGuard(page))
      .toEqual({ bootCount: 1, onboarding: testId })
  })
}

test('rejects a second root boot', async ({ page }) => {
  await installCloudCustomNodeBootGuard(page)
  await page.route('http://guard.test/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body></body></html>'
    })
  )
  await page.goto('http://guard.test/')
  await page.reload()
  await expect
    .poll(() => readCloudCustomNodeBootGuard(page))
    .toEqual({ bootCount: 2, onboarding: null })
  const state = await readCloudCustomNodeBootGuard(page)
  expect(() => assertCloudCustomNodeBootGuard(state)).toThrow(
    'booted the app 2 times'
  )
})

test('does not count same-document hash navigation as a second boot', async ({
  page
}) => {
  await installCloudCustomNodeBootGuard(page)
  await page.route('http://guard.test/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body></body></html>'
    })
  )
  await page.goto('http://guard.test/')
  await page.evaluate(() => {
    location.hash = 'same-document'
  })

  await expect
    .poll(() => readCloudCustomNodeBootGuard(page))
    .toEqual({ bootCount: 1, onboarding: null })
  await expect(finalizeCloudCustomNodeBootGuard(page)).resolves.toBeUndefined()
})

test('final boot enforcement stops observation after a late failure', async () => {
  const calls: string[] = []
  const guardError = new Error('late second boot')
  const stopError = new Error('observer stop failed')
  const page = { isClosed: () => false } as Page

  let thrown: unknown
  await finalizeCloudCustomNodeBootGuard(page, {
    read: async () => {
      calls.push('read')
      return { bootCount: 2, onboarding: null }
    },
    assert: ({ bootCount }) => {
      calls.push('assert')
      if (bootCount === 2) throw guardError
    },
    close: async () => {
      calls.push('close')
    },
    readRootBootCount: () => {
      calls.push('read root boot count')
      return 1
    },
    stop: async () => {
      calls.push('stop')
      throw stopError
    }
  }).catch((error: unknown) => {
    thrown = error
  })

  expect(calls).toEqual([
    'read',
    'assert',
    'close',
    'read root boot count',
    'assert',
    'stop'
  ])
  expect(thrown).toBeInstanceOf(AggregateError)
  expect((thrown as AggregateError).errors).toEqual([guardError, stopError])
})

test('rejects a root boot that commits while finalization closes the page', async () => {
  const calls: string[] = []
  const page = { isClosed: () => false } as Page
  let rootBootCount = 1

  await expect(
    finalizeCloudCustomNodeBootGuard(page, {
      read: async () => ({ bootCount: 1, onboarding: null }),
      assert: assertCloudCustomNodeBootGuard,
      close: async () => {
        calls.push('close')
        rootBootCount = 2
      },
      readRootBootCount: () => rootBootCount,
      stop: async () => {
        calls.push('stop')
      }
    })
  ).rejects.toThrow('booted the app 2 times')
  expect(calls).toEqual(['close', 'stop'])
})

test('preserves the test failure while every cleanup runs', async () => {
  const calls: string[] = []
  const testError = new Error('original test failure')
  const guardError = new Error('guard teardown failure')

  let thrown: unknown
  await runWithCollectedCleanup(async () => {
    calls.push('test')
    throw testError
  }, [
    async () => {
      calls.push('guard')
      throw guardError
    },
    async () => {
      calls.push('perf')
    }
  ]).catch((error: unknown) => {
    thrown = error
  })

  expect(calls).toEqual(['test', 'guard', 'perf'])
  expect(thrown).toBeInstanceOf(AggregateError)
  expect((thrown as AggregateError).errors).toEqual([testError, guardError])
})

test('runs immutable finalizer slots after a fixture setup failure', async () => {
  const calls: string[] = []
  const setupError = new Error('setup failed before use')
  const guardError = new Error('guard finalized after setup failure')
  let guardInstalled = false
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const attachments: string[] = []
  fake.respond({ status: 502 })
  const cleanups: readonly (() => Promise<void>)[] = [
    async () => {
      if (!guardInstalled) return
      calls.push('guard')
      throw guardError
    },
    async () => {
      calls.push('trace')
      await trace.finalize({
        attach: async (_name, options) => {
          attachments.push(String(options?.body))
        }
      })
    }
  ]

  const failure = await runWithCollectedCleanup(async () => {
    calls.push('setup')
    guardInstalled = true
    throw setupError
  }, cleanups).catch((error: unknown) => error)

  expect(calls).toEqual(['setup', 'guard', 'trace'])
  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toEqual([
    setupError,
    guardError,
    expect.objectContaining({ message: expect.stringContaining('HTTP 502') })
  ])
  expect(JSON.parse(attachments[0]).evidence).toHaveLength(1)
  expect(fake.listenerCount('response')).toBe(0)
})

test('closes the traced page before cleanup after a fail-fast 502', async () => {
  const calls: string[] = []
  let releaseOperation = () => {}
  const operationReleased = new Promise<void>((resolve) => {
    releaseOperation = resolve
  })
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const result = runWithCollectedCleanup(
    () =>
      trace.run(async () => {
        calls.push('setup')
        await fake.waitForClose()
        calls.push('operation saw close')
        await operationReleased
        calls.push('operation settled')
        throw new Error('page closed')
      }),
    [
      async () => {
        calls.push(`cleanup page closed=${fake.isClosed()}`)
      },
      () => trace.finalize({ attach: async () => {} })
    ]
  ).catch((error: unknown) => error)

  fake.respond({ status: 502 })
  await fake.waitForClose()
  await Promise.resolve()
  expect(calls).toEqual(['setup', 'operation saw close'])
  releaseOperation()
  const failure = await result

  expect(String(failure)).toContain('any 502 fails S1-S12')
  expect(calls).toEqual([
    'setup',
    'operation saw close',
    'operation settled',
    'cleanup page closed=true'
  ])
})

test('finalizes 502 evidence when the fixture operation never settles', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const attachments: string[] = []
  const result = runWithCollectedCleanup(
    () => trace.run(() => new Promise<void>(() => {})),
    [
      () =>
        trace.finalize({
          attach: async (name) => {
            attachments.push(name)
          }
        })
    ]
  ).catch((error: unknown) => error)

  fake.respond({ status: 502, readBody: () => Promise.resolve('Bad Gateway') })
  const failure = await result

  expect(String(failure)).toContain('any 502 fails S1-S12')
  expect(fake.isClosed()).toBe(true)
  expect(attachments).toEqual([
    'cloud-http-502-responses.json',
    'cloud-http-502-response-bodies.enc.json'
  ])
})

test('sanitizes an operation rejection that wins the 502 signal race', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const failure = await runWithCollectedCleanup(
    () =>
      trace.run(async () => {
        fake.respond({ status: 502 })
        throw new Error(
          'settings?operation-race-secret#operation-race-fragment'
        )
      }),
    [() => trace.finalize({ attach: async () => {} })]
  ).catch((error: unknown) => error)
  const rendered = inspect(failure, { depth: null })

  expect(rendered).toContain('any 502 fails S1-S12')
  expect(rendered).not.toContain('operation-race-secret')
  expect(rendered).not.toContain('operation-race-fragment')
})

test('sanitizes nested fixture errors preserved beside the 502 gate', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const result = trace
    .run(async () => {
      await fake.waitForClose()
      const cause = new Error('/api/cause?cause-secret#cause-fragment')
      cause.stack =
        'Error: https://cloud.example/api/cause?stack-secret#stack-fragment'
      throw new AggregateError(
        [
          new Error('wss://socket.example/ws?nested-secret#nested-fragment'),
          '//cdn.example/asset?cdn-secret#cdn-fragment',
          'jobs?bare-secret#bare-fragment',
          '?query-only-secret',
          '#fragment-only-secret'
        ],
        '/api/operation?operation-secret#operation-fragment',
        { cause }
      )
    })
    .catch((error: unknown) => error)

  fake.respond({ status: 502 })
  const failure = await result
  const rendered = inspect(failure, { depth: null })

  expect(failure).toBeInstanceOf(AggregateError)
  expect(rendered).toContain(
    'Free-form AggregateError message redacted at strict Cloud trace boundary'
  )
  expect(rendered).toContain(
    'Free-form Error message redacted at strict Cloud trace boundary'
  )
  for (const secret of [
    'cause-secret',
    'cause-fragment',
    'stack-secret',
    'stack-fragment',
    'nested-secret',
    'nested-fragment',
    'cdn-secret',
    'cdn-fragment',
    'operation-secret',
    'operation-fragment',
    'bare-secret',
    'bare-fragment',
    'query-only-secret',
    'fragment-only-secret'
  ])
    expect(rendered).not.toContain(secret)
})

test('sanitizes page-close failures and captured 502 bodies', async () => {
  const closeCause = new Error(
    '/api/close-cause?close-cause-secret#close-cause-fragment'
  )
  const closeError = new Error(
    'close https://cloud.example/finalize?close-secret#close-fragment',
    { cause: closeCause }
  )
  const fake = tracedPage(closeError)
  const trace = traceCloudPage(fake.page, true)
  const body = JSON.stringify({ error: 'body-secret' })
  const result = trace
    .run(async () => {
      await fake.waitForClose()
      throw new Error('fixture parsed body-secret')
    })
    .catch((error: unknown) => error)

  fake.respond({ status: 502, readBody: () => Promise.resolve(body) })
  const runFailure = await result
  const finalizeFailure = await trace
    .finalize({ attach: async () => {} })
    .catch((error: unknown) => error)
  const rendered = inspect(new AggregateError([runFailure, finalizeFailure]), {
    depth: null
  })

  expect(rendered).toContain('any 502 fails S1-S12')
  for (const secret of [
    'body-secret',
    'close-secret',
    'close-fragment',
    'close-cause-secret',
    'close-cause-fragment'
  ])
    expect(rendered).not.toContain(secret)
})

test('sanitizes an operation failure before a 502 appears in cleanup', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const failure = await runWithCollectedCleanup(
    () =>
      trace.run(async () => {
        throw new Error(
          '/api/fixture?late-operation-secret#late-operation-fragment'
        )
      }),
    [
      async () => fake.respond({ status: 502 }),
      () => trace.finalize({ attach: async () => {} })
    ]
  ).catch((error: unknown) => trace.sanitize(error))
  const rendered = inspect(failure, { depth: null })

  expect(rendered).toContain('any 502 fails S1-S12')
  expect(rendered).not.toContain('late-operation-secret')
  expect(rendered).not.toContain('late-operation-fragment')
})

test('redacts boot-finalizer failures without hiding ordinary operation errors', async () => {
  const fake = tracedPage()
  const trace = traceCloudPage(fake.page, true)
  const closedPage = { isClosed: () => true } as Page
  const failure = await runWithCollectedCleanup(async () => {
    throw new Error('actionable operation failure')
  }, [
    () =>
      finalizeCloudCustomNodeBootGuardAtTraceBoundary(
        closedPage,
        (error, redactFreeform) =>
          trace.sanitize(
            new AggregateError(
              [error, new Error('boot-finalizer-secret-swordfish')],
              'boot-finalizer-secret-swordfish'
            ),
            redactFreeform
          )
      ),
    () => trace.finalize({ attach: async () => {} })
  ]).catch((error: unknown) => trace.sanitize(error))
  const rendered = inspect(failure, { depth: null })

  expect(rendered).toContain('actionable operation failure')
  expect(rendered).toContain(
    'Free-form Error message redacted at strict Cloud trace boundary'
  )
  expect(rendered).not.toContain('boot-finalizer-secret-swordfish')
})

test('preserves a test failure when a closed page makes the guard unavailable', async () => {
  const calls: string[] = []
  const testError = new Error('original test failure')
  const page = { isClosed: () => true } as Page

  let thrown: unknown
  await runWithCollectedCleanup(async () => {
    throw testError
  }, [
    () => finalizeCloudCustomNodeBootGuard(page),
    async () => {
      calls.push('later cleanup')
    }
  ]).catch((error: unknown) => {
    thrown = error
  })

  expect(calls).toEqual(['later cleanup'])
  expect(thrown).toBeInstanceOf(AggregateError)
  expect((thrown as AggregateError).errors[0]).toBe(testError)
  expect(String((thrown as AggregateError).errors[1])).toContain(
    'boot guard unavailable: page closed'
  )
})

test('stops observation after a crash-shaped guard read failure', async () => {
  const calls: string[] = []
  const readError = new Error('page.evaluate: target crashed')
  const stopError = new Error('observer stop failed')
  const page = { isClosed: () => false } as Page

  let thrown: unknown
  await finalizeCloudCustomNodeBootGuard(page, {
    read: async () => {
      calls.push('read')
      throw readError
    },
    assert: () => {
      calls.push('assert')
    },
    close: async () => {
      calls.push('close')
    },
    readRootBootCount: () => {
      calls.push('read root boot count')
      return 1
    },
    stop: async () => {
      calls.push('stop')
      throw stopError
    }
  }).catch((error: unknown) => {
    thrown = error
  })

  expect(calls).toEqual([
    'read',
    'close',
    'read root boot count',
    'assert',
    'stop'
  ])
  expect(thrown).toBeInstanceOf(AggregateError)
  expect((thrown as AggregateError).errors).toEqual([readError, stopError])
})

test('rethrows a sole run or cleanup error by identity', async () => {
  const runError = new Error('run failed')
  const cleanupError = new Error('cleanup failed')

  await expect(
    runWithCollectedCleanup(async () => {
      throw runError
    }, [])
  ).rejects.toBe(runError)
  await expect(
    runWithCollectedCleanup(async () => {}, [
      async () => {
        throw cleanupError
      }
    ])
  ).rejects.toBe(cleanupError)
})

test.describe('drainBackendToIdle', () => {
  test('installing twice leaves one response listener', () => {
    const fake = scriptedPage([IDLE])
    trackSubmittedPrompts(fake.page)
    trackSubmittedPrompts(fake.page)
    expect(fake.listenerCount()).toBe(1)
  })

  test('refuses to run on a page whose submissions were never tracked', async () => {
    const fake = scriptedPage([IDLE])
    let message = ''
    await drainBackendToIdle(fake.page, 0).catch((error: unknown) => {
      message = error instanceof Error ? error.message : String(error)
    })
    expect(message).toContain('call trackSubmittedPrompts(page) in beforeEach')
  })

  test('cancels our running and pending entries before giving up on the budget', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'ours-run' }], Pending: [{ id: 'ours-pend' }] }
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours-run')
    fake.submit('ours-pend')
    expect(await drainBackendToIdle(fake.page, 0)).toBe(1)
    expect(fake.interrupted).toEqual(['ours-run'])
    expect(fake.deleted).toEqual(['queue:ours-pend'])
  })

  test('reports idle once our entries clear', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'ours' }], Pending: [] },
      IDLE
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 60_000)).toBe(0)
    expect(fake.interrupted).toEqual(['ours'])
  })

  test('never touches or fails on a queue owned by another client', async () => {
    const fake = scriptedPage([
      { Running: [{ id: 'theirs' }], Pending: [{ id: 'theirs-2' }] }
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 0)).toBe(0)
    expect(fake.interrupted).toEqual([])
    expect(fake.deleted).toEqual([])
  })

  // Pins the reason the cancellation pass sits INSIDE the poll loop: deleting a
  // pending entry cannot stop it once the backend promotes it to running, so a
  // one-shot cancel would leak it onto the shared queue.
  test('re-cancels a pending entry promoted to running between polls', async () => {
    const fake = scriptedPage([
      { Running: [], Pending: [{ id: 'ours' }] },
      { Running: [{ id: 'ours' }], Pending: [] },
      IDLE
    ])
    trackSubmittedPrompts(fake.page)
    fake.submit('ours')
    expect(await drainBackendToIdle(fake.page, 60_000)).toBe(0)
    expect(fake.deleted).toEqual(['queue:ours'])
    expect(fake.interrupted).toEqual(['ours'])
  })
})

test.describe('waitForQueueQuiet', () => {
  test('reports a busy queue it did not submit without cancelling it', async () => {
    const fake = scriptedPage([{ Running: [{ id: 'theirs' }], Pending: [] }])
    expect(await waitForQueueQuiet(fake.page, 0)).toBe(1)
    expect(fake.interrupted).toEqual([])
    expect(fake.deleted).toEqual([])
  })

  test('reports an empty queue as quiet', async () => {
    expect(await waitForQueueQuiet(scriptedPage([IDLE]).page, 0)).toBe(0)
  })
})
