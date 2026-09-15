import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'

import { workshopModelAvailability } from '../src/config/workshop-model-availability'

const kindSchema = z.enum(['image', 'video', 'audio'])
const modalitySchema = z.enum([...kindSchema.options, '3d', 'text', 'other'])
const dateSchema = z.string().datetime({ offset: true })
const fieldsSchema = z
  .array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_.[\]-]{0,79}$/))
  .max(100)
const sourceSchema = z.object({
  revision: z
    .string()
    .regex(/^[a-f0-9]{7,40}$/)
    .optional(),
  dirty: z.boolean().optional(),
  runId: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/)
    .optional()
})
const failureSchema = z.enum([
  'invalid-defaults',
  'invalid-input',
  'missing-input',
  'concurrency-limit',
  'rate-limit',
  'unavailable',
  'authentication',
  'no-credits',
  'policy',
  'provider-error',
  'upload',
  'invalid-artifact',
  'output-kind',
  'timeout',
  'cancelled',
  'unknown',
  'not-run-after-fix'
])
const artifactSchema = z
  .object({
    kind: kindSchema,
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    durationSeconds: z.number().positive().optional(),
    channels: z.number().int().positive().optional()
  })
  .refine(
    (artifact) =>
      (artifact.kind === 'audio' || (artifact.width && artifact.height)) &&
      (artifact.kind === 'image' || artifact.durationSeconds),
    'Artifacts require decoded dimensions or a positive playable duration'
  )
const preflightSchema = z.object({
  status: z.enum(['ready', 'failed']),
  at: dateSchema,
  fields: fieldsSchema.optional(),
  source: sourceSchema.optional()
})
const liveSchema = z
  .object({
    status: z.enum(['passed', 'failed', 'blocked', 'cancelled', 'not-run']),
    at: dateSchema,
    requestId: z.string().uuid().optional(),
    source: sourceSchema.optional(),
    completion: z.literal('collected-after-timeout').optional(),
    failure: failureSchema.optional(),
    fields: fieldsSchema.optional(),
    httpStatus: z.number().int().min(100).max(599).optional(),
    artifacts: z.array(artifactSchema).max(100).optional()
  })
  .refine(
    (live) => live.status !== 'passed' || Boolean(live.artifacts?.length),
    'A live pass requires decoded artifact evidence'
  )
  .refine(
    (live) =>
      ![
        'concurrency-limit',
        'rate-limit',
        'unavailable',
        'authentication',
        'no-credits'
      ].includes(live.failure ?? '') || live.status === 'blocked',
    'Unavailable account or endpoint capacity is blocked, not a model failure'
  )
  .refine(
    (live) => live.status !== 'passed' || !live.failure,
    'A live pass cannot include a failure'
  )
const updateSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,249}$/),
  routerId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_./-]{0,249}$/),
  modality: modalitySchema,
  environment: z.enum(['prod', 'staging', 'test']),
  inputMode: z.enum(['page-defaults', 'custom-inputs']),
  preflight: preflightSchema.optional(),
  live: liveSchema.optional()
})
const rowSchema = updateSchema
  .extend({ lastSuccess: liveSchema.optional() })
  .refine(
    (row) => !row.lastSuccess || row.lastSuccess.status === 'passed',
    'Last success must be a live pass'
  )
  .refine(
    (row) =>
      [row.live, row.lastSuccess].every(
        (live) =>
          live?.artifacts?.every(
            (artifact) => artifact.kind === row.modality
          ) ?? true
      ),
    'Artifact kind must match the model modality'
  )
const reportSchema = z.object({
  version: z.literal(1),
  models: z.array(rowSchema)
})

export type RouterModelReportUpdate = z.infer<typeof updateSchema>
export type ReportFailureCode = z.infer<typeof failureSchema>
export type ReportSource = z.infer<typeof sourceSchema>
type ReportRow = z.infer<typeof rowSchema>

const failureLabels: Record<z.infer<typeof failureSchema>, string> = {
  'invalid-defaults': 'Fix the initial page inputs',
  'invalid-input': 'Router rejected the mapped inputs',
  'missing-input': 'Supply required default inputs',
  'concurrency-limit': 'Account concurrency limit; retry when capacity is free',
  'rate-limit': 'Request rate limit; retry later',
  unavailable: 'Endpoint is unavailable or not enabled',
  authentication: 'Authentication failed',
  'no-credits': 'Account needs credits',
  policy: 'Request rejected by provider policy',
  'provider-error': 'Provider or Router failed',
  upload: 'Input conversion or temporary upload failed',
  'invalid-artifact': 'Returned media could not be downloaded and decoded',
  'output-kind': 'Page parser did not produce the expected media type',
  timeout: 'Check timed out; remote generation may still finish',
  cancelled: 'Check cancelled; remote generation may still finish',
  unknown: 'Inspect the private run evidence',
  'not-run-after-fix': 'Inputs changed; run live verification again'
}

function rowKey(row: RouterModelReportUpdate): string {
  return `${row.environment}:${row.inputMode}:${row.slug}`
}

function newer<T extends { at: string }>(
  previous?: T,
  next?: T
): T | undefined {
  return next && (!previous || Date.parse(next.at) >= Date.parse(previous.at))
    ? next
    : previous
}

function cell(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll(/[\\`*_[\]]/g, '\\$&')
    .replaceAll(/[\r\n]/g, ' ')
}

function revision(source: ReportSource | undefined): string {
  return `${source?.revision?.slice(0, 8) ?? 'unknown'}${source?.dirty ? ' + uncommitted changes' : ''}`
}

function disabledReason(slug: string): string | undefined {
  const availability = workshopModelAvailability.get(slug)
  return availability?.disabled ? availability.reason : undefined
}

function markdown(rows: readonly ReportRow[]): string {
  const statuses = ['passed', 'failed', 'blocked', 'cancelled', 'not-run']
  const counts = statuses.map(
    (status) =>
      `${status}: ${rows.filter((row) => (row.live?.status ?? 'not-run') === status).length}`
  )
  const disabledPages = [...workshopModelAvailability.values()].filter(
    (availability) => availability.disabled
  ).length
  const lines = rows.map((row) => {
    const { live, preflight, lastSuccess } = row
    const disabled = disabledReason(row.slug)
    const detail = [
      disabled && `Disabled on the site: ${disabled}`,
      !live &&
        !kindSchema.safeParse(row.modality).success &&
        'Live verification is not supported for this output type',
      live?.failure && failureLabels[live.failure],
      live?.httpStatus && `HTTP ${live.httpStatus}`,
      live?.completion === 'collected-after-timeout' &&
        'Collected after initial timeout',
      preflight?.status === 'failed' && 'Initial inputs failed validation',
      ...(preflight?.status === 'failed' ? (preflight.fields ?? []) : []),
      ...(live?.fields ?? []),
      ...(live?.artifacts?.map(
        (artifact) =>
          `${artifact.kind}: ${artifact.bytes} bytes${artifact.width && artifact.height ? `, ${artifact.width}×${artifact.height}` : ''}${artifact.durationSeconds ? `, ${artifact.durationSeconds}s` : ''}, SHA256 ${artifact.sha256.slice(0, 12)}`
      ) ?? []),
      live?.requestId && `Request ${live.requestId}`
    ].filter((value): value is string => typeof value === 'string')
    return `| [${cell(row.slug)}](https://www.comfy.org/models/${encodeURIComponent(row.slug)}/) | ${row.modality} | ${row.environment} / ${row.inputMode} | ${preflight ? `${preflight.status} (${preflight.at})` : 'not checked'} | ${live ? `${live.status} (${live.at})` : 'not-run'} | ${detail.map(cell).join('<br>') || '—'} | ${lastSuccess ? `${lastSuccess.at}${lastSuccess.requestId ? `<br>Request ${lastSuccess.requestId}` : ''}` : '—'} | ${preflight ? `Defaults: ${revision(preflight.source)}` : ''}${preflight && live ? '<br>' : ''}${live ? `Live: ${revision(live.source)}` : ''} |`
  })
  const attention = rows
    .filter(
      (row) =>
        row.preflight?.status === 'failed' || row.live?.status === 'failed'
    )
    .map((row) => {
      const problem =
        row.preflight?.status === 'failed'
          ? `Invalid inputs: ${(row.preflight.fields ?? []).join(', ')}`
          : failureLabels[row.live?.failure ?? 'unknown']
      return `| ${cell(row.slug)} | ${row.environment} / ${row.inputMode} | ${cell(problem)} | ${disabledReason(row.slug) ? 'Disabled' : 'Published'} |`
    })
  return [
    '# Model test results',
    '',
    'Generated by the Router model tester. Commit this file together with `testing/models-test-results.json`; the JSON preserves results between partial runs.',
    '',
    'Each row identifies a model page, environment, and input mode. A live pass requires downloaded, decoded media of the expected type. Ready defaults are only a local validation result. Results describe the recorded revision and date, not a guarantee about a newer revision.',
    '',
    'Blocked checks reflect account capacity or rate limits and do not establish that a model is broken. Custom-input checks do not verify the initial page defaults. A page is published unless [`src/data/workshop-model-availability.json`](src/data/workshop-model-availability.json) disables it; this report never changes availability itself.',
    '',
    'See [Model testing](MODEL_TESTING.md) for running instructions, disabling and re-enabling pages, and verification limits, including collection after an initial timeout.',
    '',
    `${rows.length} cases — ${counts.join('; ')}. Default preflight failures: ${rows.filter((row) => row.preflight?.status === 'failed' && row.inputMode === 'page-defaults').length}. Pages disabled on the site: ${disabledPages}.`,
    '',
    ...(attention.length
      ? [
          '## Needs attention',
          '',
          '| Model page | Environment / inputs | Problem | Site |',
          '| --- | --- | --- | --- |',
          ...attention,
          '',
          '## All results'
        ]
      : []),
    '',
    '| Model page | Media | Environment / inputs | Input preflight | Last live check | Detail / evidence | Last live pass | Checked revision |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...lines,
    ''
  ].join('\n')
}

function atomicWrite(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, contents, { flag: 'wx', mode: 0o644 })
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

export function openRouterModelReport(paths: {
  jsonPath: string
  markdownPath: string
}) {
  mkdirSync(dirname(paths.jsonPath), { recursive: true })
  const lockPath = `${paths.jsonPath}.lock`
  let lock: number
  try {
    lock = openSync(lockPath, 'wx', 0o600)
  } catch {
    throw new Error(
      'Model report is locked or unwritable. Stop the other tester before retrying; remove a stale .lock file only after confirming no tester is running.'
    )
  }
  let closed = false
  function close(): void {
    if (closed) return
    closed = true
    closeSync(lock)
    unlinkSync(lockPath)
  }
  try {
    const previous = existsSync(paths.jsonPath)
      ? reportSchema.parse(JSON.parse(readFileSync(paths.jsonPath, 'utf8')))
      : { version: 1, models: [] }
    const rows = new Map(previous.models.map((row) => [rowKey(row), row]))
    function flush(): void {
      if (closed) throw new Error('Model report is closed')
      const models = [...rows.values()].sort((a, b) =>
        rowKey(a).localeCompare(rowKey(b))
      )
      atomicWrite(
        paths.jsonPath,
        `${JSON.stringify({ version: 1, models }, null, 2)}\n`
      )
      atomicWrite(paths.markdownPath, markdown(models))
    }
    function update(record: RouterModelReportUpdate): void {
      const incoming = updateSchema.parse(record)
      const existing = rows.get(rowKey(incoming))
      const next = rowSchema.parse({
        ...existing,
        ...incoming,
        preflight: newer(existing?.preflight, incoming.preflight),
        live: newer(existing?.live, incoming.live),
        lastSuccess: newer(
          existing?.lastSuccess,
          incoming.live?.status === 'passed' ? incoming.live : undefined
        )
      })
      rows.set(rowKey(next), next)
      flush()
    }
    return { update, flush, close }
  } catch (error) {
    close()
    throw error
  }
}
