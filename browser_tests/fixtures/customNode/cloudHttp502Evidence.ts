import { createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto'

export const CLOUD_HTTP_502_EVIDENCE_KEY_ENV = 'CLOUD_HTTP_502_EVIDENCE_KEY'

const PUBLIC_EVIDENCE_AUTH_CONTEXT = 'comfy-cloud-http-502-public-evidence-v1'
const ENCRYPTED_EVIDENCE_AUTH_CONTEXT =
  'comfy-cloud-http-502-encrypted-evidence-v1'

export interface CloudHttp502EvidenceBinding {
  runId: string
  runAttempt: string
  testId: string
  retry: number
}

export class CloudHttp502EvidenceError extends Error {}

export function cloudHttp502EvidenceKey() {
  const encodedKey = process.env[CLOUD_HTTP_502_EVIDENCE_KEY_ENV]
  if (!encodedKey)
    throw new CloudHttp502EvidenceError(
      `${CLOUD_HTTP_502_EVIDENCE_KEY_ENV} is required to retain Cloud 502 evidence`
    )
  const key = Buffer.from(encodedKey, 'base64')
  if (key.length !== 32 || key.toString('base64') !== encodedKey)
    throw new CloudHttp502EvidenceError(
      `${CLOUD_HTTP_502_EVIDENCE_KEY_ENV} must be canonical base64 for exactly 32 bytes`
    )
  return key
}

export function cloudHttp502EvidenceBinding({
  testId,
  retry
}: {
  testId: string
  retry: number
}): CloudHttp502EvidenceBinding {
  return {
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '0',
    testId,
    retry
  }
}

function bindingPayload(binding: CloudHttp502EvidenceBinding) {
  return JSON.stringify(binding)
}

export function cloudHttp502EvidenceAdditionalAuthenticatedData(
  binding: CloudHttp502EvidenceBinding
) {
  return Buffer.from(
    `${ENCRYPTED_EVIDENCE_AUTH_CONTEXT}\0${bindingPayload(binding)}`
  )
}

function publicEvidenceAuthentication(
  evidence: unknown,
  binding: CloudHttp502EvidenceBinding
) {
  const authenticationKey = createHmac('sha256', cloudHttp502EvidenceKey())
    .update(PUBLIC_EVIDENCE_AUTH_CONTEXT)
    .digest()
  return createHmac('sha256', authenticationKey)
    .update(JSON.stringify({ binding, evidence }))
    .digest('base64')
}

export function serializeCloudHttp502PublicEvidence(
  evidence: unknown,
  binding: CloudHttp502EvidenceBinding
) {
  return JSON.stringify(
    {
      binding,
      evidence,
      authentication: {
        algorithm: 'hmac-sha256',
        value: publicEvidenceAuthentication(evidence, binding)
      }
    },
    null,
    2
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function authenticatedCloudHttp502PublicEvidence(
  value: unknown,
  expectedBinding: CloudHttp502EvidenceBinding
) {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    !Object.hasOwn(value, 'binding') ||
    !Object.hasOwn(value, 'evidence') ||
    JSON.stringify(value.binding) !== bindingPayload(expectedBinding) ||
    !isRecord(value.authentication) ||
    Object.keys(value.authentication).length !== 2 ||
    value.authentication.algorithm !== 'hmac-sha256' ||
    typeof value.authentication.value !== 'string'
  )
    return
  const actual = Buffer.from(value.authentication.value, 'base64')
  if (
    actual.length !== 32 ||
    actual.toString('base64') !== value.authentication.value
  )
    return
  let expected: Buffer
  try {
    expected = Buffer.from(
      publicEvidenceAuthentication(value.evidence, expectedBinding),
      'base64'
    )
  } catch {
    return
  }
  return timingSafeEqual(actual, expected) ? value.evidence : undefined
}

export function decryptCloudHttp502EncryptedEnvelope(
  value: { iv: string; authTag: string; ciphertext: string },
  binding: CloudHttp502EvidenceBinding
) {
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      cloudHttp502EvidenceKey(),
      Buffer.from(value.iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(value.authTag, 'base64'))
    decipher.setAAD(cloudHttp502EvidenceAdditionalAuthenticatedData(binding))
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64')),
      decipher.final()
    ])
  } catch {
    return
  }
}
