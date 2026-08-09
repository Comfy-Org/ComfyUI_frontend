import type { TestInfoError } from '@playwright/test'
import { readFileSync, statSync } from 'node:fs'
import type {
  Reporter,
  TestCase,
  TestError,
  TestResult
} from '@playwright/test/reporter'

import {
  authenticatedCloudHttp502PublicEvidence,
  cloudHttp502EvidenceBinding,
  decryptCloudHttp502EncryptedEnvelope
} from '@e2e/fixtures/customNode/cloudHttp502Evidence'
import type { CloudHttp502EvidenceBinding } from '@e2e/fixtures/customNode/cloudHttp502Evidence'

export const CLOUD_HTTP_502_REDACTION_ANNOTATION =
  'cloud-http-502-reporter-redaction'

const REDACTED_ERROR =
  'Test failure details redacted because this test observed an HTTP 502; see cloud-http-502-responses.json'
const REDACTED_ATTACHMENT = Buffer.from(
  '[attachment redacted because this test observed an HTTP 502]\n'
)
const REDACTED_ATTACHMENT_NAME = 'redacted-http-502-attachment.txt'
const EVIDENCE_INTEGRITY_ERROR =
  'Cloud HTTP 502 evidence failed reporter authentication or result binding'
const HTTP_502_RESULT_ERROR =
  'Cloud returned an HTTP 502 response; any 502 fails Cloud S1-S12'
const MAX_RETAINED_ATTACHMENT_BYTES = 2 * 1024 * 1024
const CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES = 1024 * 1024
const ROUTING_HEADER_NAMES = new Set(['cf-ray', 'server', 'via'])

export const CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES = new Map([
  [
    'cloud-http-502-responses.json',
    'application/vnd.comfy.cloud-http-502-responses+json'
  ],
  [
    'cloud-http-502-response-bodies.enc.json',
    'application/vnd.comfy.cloud-http-502-bodies+json'
  ]
])

type ReporterAttachment = TestResult['attachments'][number]

interface CloudHttp502PublicEvidenceRecord {
  status: 502
  method: string
  url: string
  headers: Record<string, string>
  bodyCapture: 'captured' | 'unavailable'
}

interface CloudHttp502EncryptedEvidenceRecord extends CloudHttp502PublicEvidenceRecord {
  body: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  )
}

function attachmentBody(attachment: ReporterAttachment): Buffer | undefined {
  if (attachment.body) return attachment.body
  if (!attachment.path) return
  try {
    if (statSync(attachment.path).size > MAX_RETAINED_ATTACHMENT_BYTES) return
    return readFileSync(attachment.path)
  } catch {
    return
  }
}

function isCanonicalBase64(value: unknown, expectedBytes: number) {
  if (typeof value !== 'string') return false
  const decoded = Buffer.from(value, 'base64')
  return (
    decoded.length === expectedBytes && decoded.toString('base64') === value
  )
}

function isRoutingHeaders(value: unknown, publicEvidence: boolean) {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([name, headerValue]) =>
        ROUTING_HEADER_NAMES.has(name) &&
        typeof headerValue === 'string' &&
        headerValue.length <= 512 &&
        !/[\r\n]/.test(headerValue) &&
        (!publicEvidence || !/[?#]/.test(headerValue))
    )
  )
}

function safeNetworkUrl(value: string) {
  const url = new URL(value)
  return `${url.origin}${url.pathname}`
}

function privateUrlValues(value: string) {
  const url = new URL(value)
  const sections = [url.search.slice(1), url.hash.slice(1)].filter(Boolean)
  const rawValues = sections.flatMap((section) => [
    section,
    ...section.split('&').map((part) => {
      const separator = part.indexOf('=')
      return separator === -1 ? part : part.slice(separator + 1)
    })
  ])
  const values = new Set([...rawValues, ...url.searchParams.values()])
  for (const rawValue of rawValues) {
    try {
      values.add(decodeURIComponent(rawValue.replaceAll('+', ' ')))
    } catch {
      continue
    }
  }
  values.delete('')
  return [...values]
}

function isSafePublicEvidence(
  value: unknown
): value is CloudHttp502PublicEvidenceRecord[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((record) => {
    if (
      !isRecord(record) ||
      !hasExactKeys(record, [
        'status',
        'method',
        'url',
        'headers',
        'bodyCapture'
      ]) ||
      record.status !== 502 ||
      typeof record.method !== 'string' ||
      !/^[A-Z]+$/.test(record.method) ||
      typeof record.url !== 'string' ||
      !isRoutingHeaders(record.headers, true) ||
      record.bodyCapture !== 'captured'
    )
      return false
    try {
      const url = new URL(record.url)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        record.url !== `${url.origin}${url.pathname}`
      )
        return false
    } catch {
      return false
    }
    return true
  })
}

function isSafeEncryptedEvidence(
  value: unknown
): value is CloudHttp502EncryptedEvidenceRecord[] {
  if (!Array.isArray(value) || value.length === 0) return false
  for (const record of value) {
    if (
      !isRecord(record) ||
      !hasExactKeys(record, [
        'status',
        'method',
        'url',
        'headers',
        'body',
        'bodyCapture'
      ]) ||
      record.status !== 502 ||
      typeof record.method !== 'string' ||
      !/^[A-Z]+$/.test(record.method) ||
      typeof record.url !== 'string' ||
      !isRoutingHeaders(record.headers, false) ||
      record.bodyCapture !== 'captured' ||
      typeof record.body !== 'string'
    )
      return false
    try {
      const url = new URL(record.url)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return false
    } catch {
      return false
    }
  }
  return true
}

function isEncryptedEvidenceEnvelope(
  value: unknown,
  binding: CloudHttp502EvidenceBinding
): CloudHttp502EncryptedEvidenceRecord[] | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['algorithm', 'iv', 'authTag', 'ciphertext']) ||
    value.algorithm !== 'aes-256-gcm' ||
    !isCanonicalBase64(value.iv, 12) ||
    !isCanonicalBase64(value.authTag, 16) ||
    !isCanonicalBase64(
      value.ciphertext,
      CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES
    )
  )
    return
  const plaintext = decryptCloudHttp502EncryptedEnvelope(
    {
      iv: value.iv as string,
      authTag: value.authTag as string,
      ciphertext: value.ciphertext as string
    },
    binding
  )
  if (
    !plaintext ||
    plaintext.length !== CLOUD_HTTP_502_EVIDENCE_PLAINTEXT_BYTES
  )
    return
  const payloadLength = plaintext.readUInt32BE(0)
  if (payloadLength === 0 || payloadLength > plaintext.length - 4) return
  try {
    const evidence: unknown = JSON.parse(
      plaintext.subarray(4, 4 + payloadLength).toString('utf8')
    )
    return isSafeEncryptedEvidence(evidence) ? evidence : undefined
  } catch {
    return
  }
}

function publicEvidenceContainsRawBody(
  publicEvidence: CloudHttp502PublicEvidenceRecord[],
  encryptedEvidence: CloudHttp502EncryptedEvidenceRecord[]
) {
  const privateValues = encryptedEvidence.flatMap(({ body, url }) => [
    ...(body ? [body] : []),
    ...privateUrlValues(url)
  ])
  return publicEvidence.some((record) =>
    [
      String(record.status),
      record.method,
      record.url,
      record.bodyCapture,
      ...Object.values(record.headers)
    ].some(
      (value) =>
        value.length > 0 &&
        privateValues.some(
          (privateValue) =>
            value.includes(privateValue) || privateValue.includes(value)
        )
    )
  )
}

function validatedCloudHttp502Attachment(
  attachment: ReporterAttachment,
  binding: CloudHttp502EvidenceBinding
):
  | {
      body: Buffer
      publicEvidence?: CloudHttp502PublicEvidenceRecord[]
      encryptedEvidence?: CloudHttp502EncryptedEvidenceRecord[]
    }
  | undefined {
  if (
    CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(attachment.name) !==
    attachment.contentType
  )
    return
  const body = attachmentBody(attachment)
  if (!body || body.length > MAX_RETAINED_ATTACHMENT_BYTES) return
  try {
    const value: unknown = JSON.parse(body.toString('utf8'))
    const publicEvidence =
      attachment.name === 'cloud-http-502-responses.json'
        ? authenticatedCloudHttp502PublicEvidence(value, binding)
        : undefined
    const safePublicEvidence = isSafePublicEvidence(publicEvidence)
      ? publicEvidence
      : undefined
    const encryptedEvidence = safePublicEvidence
      ? undefined
      : attachment.name === 'cloud-http-502-response-bodies.enc.json' &&
        isEncryptedEvidenceEnvelope(value, binding)
    if (!safePublicEvidence && !encryptedEvidence) return
    const canonical = Buffer.from(JSON.stringify(value, null, 2))
    if (!body.equals(canonical)) return
    return {
      body: canonical,
      publicEvidence: safePublicEvidence,
      encryptedEvidence: encryptedEvidence || undefined
    }
  } catch {
    return
  }
}

function redactError(error: TestInfoError | TestError) {
  error.message = REDACTED_ERROR
  delete error.cause
  delete error.stack
  delete error.value
  if ('errorContext' in error) delete error.errorContext
  if ('snippet' in error) delete error.snippet
}

export function armCloudHttp502ReporterBoundary(testInfo: {
  annotations?: { type: string; description?: string }[]
  errors?: TestInfoError[]
}) {
  if (
    testInfo.annotations &&
    !testInfo.annotations.some(
      ({ type }) => type === CLOUD_HTTP_502_REDACTION_ANNOTATION
    )
  )
    testInfo.annotations.push({ type: CLOUD_HTTP_502_REDACTION_ANNOTATION })
  for (const error of testInfo.errors ?? []) redactError(error)
}

export function redactCloudHttp502Result(
  result: TestResult,
  binding?: CloudHttp502EvidenceBinding
) {
  if (
    !result.annotations.some(
      ({ type }) => type === CLOUD_HTTP_502_REDACTION_ANNOTATION
    )
  )
    return

  for (const error of result.errors) redactError(error)
  result.error = result.errors[0]
  result.steps.splice(0)
  result.stdout.splice(0)
  result.stderr.splice(0)
  result.annotations.splice(0)

  const reservedContentTypes = new Set(
    CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.values()
  )
  const evidenceAttachments = result.attachments.filter(
    ({ name, contentType }) =>
      CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.has(name) ||
      reservedContentTypes.has(contentType)
  )
  const publicAttachments = evidenceAttachments.filter(
    ({ name }) => name === 'cloud-http-502-responses.json'
  )
  const encryptedAttachments = evidenceAttachments.filter(
    ({ name }) => name === 'cloud-http-502-response-bodies.enc.json'
  )
  const validatedAttachments = new Map<
    ReporterAttachment,
    NonNullable<ReturnType<typeof validatedCloudHttp502Attachment>>
  >()
  let integrityFailure =
    !binding ||
    publicAttachments.length !== 1 ||
    encryptedAttachments.length > 1 ||
    evidenceAttachments.some((attachment) => {
      if (
        CLOUD_HTTP_502_PUBLIC_ATTACHMENT_TYPES.get(attachment.name) !==
        attachment.contentType
      )
        return true
      const validated = validatedCloudHttp502Attachment(attachment, binding!)
      if (!validated) return true
      validatedAttachments.set(attachment, validated)
      return false
    })
  if (!integrityFailure) {
    const publicEvidence = validatedAttachments.get(
      publicAttachments[0]
    )!.publicEvidence!
    const captured = publicEvidence.some(
      ({ bodyCapture }) => bodyCapture === 'captured'
    )
    integrityFailure = encryptedAttachments.length !== (captured ? 1 : 0)
    if (!integrityFailure && captured) {
      const encryptedEvidence = validatedAttachments.get(
        encryptedAttachments[0]
      )!.encryptedEvidence!
      integrityFailure =
        JSON.stringify(publicEvidence) !==
          JSON.stringify(
            encryptedEvidence.map(({ body: _body, ...record }) => ({
              ...record,
              url: safeNetworkUrl(record.url)
            }))
          ) || publicEvidenceContainsRawBody(publicEvidence, encryptedEvidence)
    }
  }
  if (integrityFailure) {
    const error = { message: EVIDENCE_INTEGRITY_ERROR } as TestError
    result.errors.push(error)
    result.error = error
    result.status = 'failed'
  } else {
    if (result.errors.length === 0) {
      const error = { message: HTTP_502_RESULT_ERROR } as TestError
      result.errors.push(error)
      result.error = error
    }
    result.status = 'failed'
  }
  for (const attachment of result.attachments) {
    const retainedBody = integrityFailure
      ? undefined
      : validatedAttachments.get(attachment)?.body
    if (retainedBody) {
      delete attachment.path
      attachment.body = retainedBody
      continue
    }
    attachment.name = REDACTED_ATTACHMENT_NAME
    delete attachment.path
    attachment.body = REDACTED_ATTACHMENT
    attachment.contentType = 'text/plain'
  }
}

export default class CloudTraceReporter implements Reporter {
  printsToStdio() {
    return false
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const shouldRedact = result.annotations.some(
      ({ type }) => type === CLOUD_HTTP_502_REDACTION_ANNOTATION
    )
    redactCloudHttp502Result(
      result,
      cloudHttp502EvidenceBinding({ testId: test.id, retry: result.retry })
    )
    if (shouldRedact) test.annotations.splice(0)
  }
}
