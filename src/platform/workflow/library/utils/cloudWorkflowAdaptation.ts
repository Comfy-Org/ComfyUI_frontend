import { isEqual, isPlainObject } from 'es-toolkit'
import { visit } from 'jsonc-parser'
import { z } from 'zod'
import type { TestWorkflowDetail } from '@comfyorg/ingest-types/test-workflows'
import { zTestWorkflowDetail } from '@comfyorg/ingest-types/test-workflows/zod'

const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const pointer = z.string().regex(/^(?:\/(?:[^~]|~[01])*)+$/)
const zCloudAdaptation = z.object({
  version: z.literal('cloud-reference-adaptation-v1'),
  original_sha256: sha256,
  workflow_file: z.literal('workflow.cloud.json'),
  workflow_sha256: sha256,
  execution_verified: z.literal(false),
  qualification: z.string(),
  changes: z
    .array(
      z.object({
        location: pointer,
        original: z.string(),
        cloud_value: z.string(),
        sha256,
        evidence: z.literal('exact-declared-sha256-and-operator-loader-mapping')
      })
    )
    .min(1),
  blocked: z.array(z.object({ location: pointer, reason: z.string() }))
})

export const zCommunityWorkflowDetail = zTestWorkflowDetail.extend({
  community_cloud_adaptation_available: z.boolean().optional(),
  community_cloud_workflow_json: z.string().optional()
})
export type CommunityWorkflowDetail = z.infer<typeof zCommunityWorkflowDetail>
export type TestWorkflowGraphVariant = 'original' | 'cloud'

export function getCloudAdaptation(record: TestWorkflowDetail) {
  const result = zCloudAdaptation.safeParse(record.metadata.cloud_adaptation)
  if (
    !result.success ||
    result.data.original_sha256 !== record.summary.workflow_sha256 ||
    result.data.original_sha256 !== record.metadata.workflow_sha256
  )
    return undefined
  return result.data
}

export async function workflowDigest(raw: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw)
  )
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0')
  ).join('')
}

export async function verifyCloudWorkflow(
  record: TestWorkflowDetail,
  original: string,
  adapted: string
) {
  const ledger = getCloudAdaptation(record)
  if (!ledger) return false
  const [originalHash, adaptedHash] = await Promise.all([
    workflowDigest(original),
    workflowDigest(adapted)
  ])
  if (
    originalHash !== ledger.original_sha256 ||
    adaptedHash !== ledger.workflow_sha256
  )
    return false
  const originalNumbers = graphNumberEvidence(original)
  const adaptedNumbers = graphNumberEvidence(adapted)
  if (
    !originalNumbers ||
    !adaptedNumbers ||
    !isEqual(originalNumbers, adaptedNumbers)
  )
    return false
  try {
    const expected: unknown = JSON.parse(original)
    const actual: unknown = JSON.parse(adapted)
    const seen = new Set<string>()
    for (const change of ledger.changes) {
      if (seen.has(change.location)) return false
      seen.add(change.location)
      const keys = change.location
        .slice(1)
        .split('/')
        .map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'))
      let parent: unknown = expected
      for (const key of keys.slice(0, -1)) {
        if (
          (!isPlainObject(parent) && !Array.isArray(parent)) ||
          !Object.hasOwn(parent, key)
        )
          return false
        parent = Object.getOwnPropertyDescriptor(parent, key)?.value
      }
      const key = keys.at(-1)
      if (
        key === undefined ||
        (!isPlainObject(parent) && !Array.isArray(parent)) ||
        !Object.hasOwn(parent, key) ||
        Object.getOwnPropertyDescriptor(parent, key)?.value !== change.original
      )
        return false
      Object.defineProperty(parent, key, { value: change.cloud_value })
    }
    return isEqual(expected, actual)
  } catch {
    return false
  }
}

function graphNumberEvidence(raw: string) {
  const properties = new Set<string>()
  const numbers = new Map<string, string>()
  let valid = true
  visit(
    raw,
    {
      onObjectProperty(property, _offset, _length, _line, _character, path) {
        const key = JSON.stringify([...path(), property])
        if (properties.has(key)) valid = false
        properties.add(key)
      },
      onLiteralValue(value: unknown, offset, length, _line, _character, path) {
        if (typeof value === 'number')
          numbers.set(
            JSON.stringify(path()),
            normalizeNumber(raw.slice(offset, offset + length))
          )
      },
      onError() {
        valid = false
      }
    },
    { disallowComments: true, allowTrailingComma: false }
  )
  return valid ? numbers : undefined
}

function normalizeNumber(raw: string) {
  const [mantissa, exponent = '0'] = raw.toLowerCase().split('e')
  const [integer, fraction = ''] = mantissa.replace(/^-/, '').split('.')
  const digits = (integer + fraction).replace(/^0+/, '')
  if (!digits) return '0'
  const significant = digits.replace(/0+$/, '')
  const power =
    BigInt(exponent) -
    BigInt(fraction.length) +
    BigInt(digits.length - significant.length)
  return `${mantissa.startsWith('-') ? '-' : ''}${significant}e${power}`
}
