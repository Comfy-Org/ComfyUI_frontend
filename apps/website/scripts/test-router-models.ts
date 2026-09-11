import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { routerWorkshopModels } from '../src/config/workshop-browse-content'
import { resolveWorkshopCloudEnv } from '../src/config/workshop-cloud-env'
import { WORKSHOP_ROUTER_BASE_URL } from '../src/config/workshop-env'
import { releaseRouterOutputs } from '../src/config/workshop-response'
import { WorkshopRouterError } from '../src/config/workshop-router-errors'
import type { RunOutput } from '../src/config/workshop-run'
import type { MediaKind } from './router-model-artifacts'
import { checkMediaDecoders, validateArtifact } from './router-model-artifacts'
import { createStartGate, mapConcurrent } from './router-model-batch'
import { captureRouterOutputs } from './router-model-evidence'
import { openRouterModelReport } from './router-model-report'
import { routerReportUpdate } from './router-model-report-events'
import { openRouterModelTransport } from './router-model-transport'
import { resolveRouterRender, router_render } from './router-render'
import { openRouterSvgRasterizer } from './router-model-svg'

const HELP = `Test every published image, video and audio page with its initial defaults.

pnpm --filter @comfyorg/website test:router-models [options]

  --execute                Make paid Router calls after preflight (default: dry)
  --slug SLUG              Test one page; repeat to select more pages
  --modality KIND          Select image, video or audio pages
  --concurrency N          Simultaneous cases, 1–128 (default: 16)
  --starts-per-second N    Pace new requests; fractions allowed (default: 2)
  --timeout-seconds N      Whole-case deadline (default: 2700)
  --max-artifact-mb N      Limit each downloaded artifact (default: 256)
  --output PATH            New evidence directory (default: repo temp directory)
  --report PATH.md         Persistent public results grid (default: MODELS_TEST_RESULTS.md)
  --help                   Show this help

--execute requires COMFY_KEY, PUBLIC_WORKSHOP_CLOUD_ENV=prod|staging|test,
and ffprobe/ffmpeg on PATH. A request is repeated only to collect a generation
Router parked at its deadline, with the same key and body; nothing else retries.
Preflight validates defaults without network calls; ready is not a generation pass.
Each run writes manifest.json, append-only events.jsonl, summary.json and artifacts.
Parsed outputs and full JSON/text attachments are saved before media verification.
The public Markdown grid and JSON state update after each result; commit both files.
An interrupted request may still complete and be billed by the provider.
`

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error('Numeric options must be positive finite numbers')
  return parsed
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = positiveNumber(value, fallback)
  if (!Number.isSafeInteger(parsed))
    throw new Error('Numeric options must be positive integers')
  return parsed
}

function isMediaKind(value: unknown): value is MediaKind {
  return value === 'image' || value === 'video' || value === 'audio'
}

function failureEvidence(error: unknown, token: string) {
  const message = error instanceof Error ? error.message : 'Unknown failure'
  return {
    reason:
      error instanceof WorkshopRouterError ? error.reason : 'verification',
    message: token ? message.replaceAll(token, '[redacted]') : message,
    ...(error instanceof WorkshopRouterError
      ? {
          requestId: error.requestId,
          fieldErrors: error.fieldErrors,
          ...(error.response
            ? {
                response: {
                  ...error.response,
                  body: token
                    ? error.response.body.replaceAll(token, '[redacted]')
                    : error.response.body
                }
              }
            : {})
        }
      : {})
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      execute: { type: 'boolean', default: false },
      slug: { type: 'string', multiple: true },
      modality: { type: 'string' },
      concurrency: { type: 'string' },
      'starts-per-second': { type: 'string' },
      'timeout-seconds': { type: 'string' },
      'max-artifact-mb': { type: 'string' },
      output: { type: 'string' },
      report: { type: 'string' },
      help: { type: 'boolean' }
    }
  })
  if (values.help) {
    process.stdout.write(HELP)
    return
  }
  const concurrency = positiveInteger(values.concurrency, 16)
  const startsPerSecond = positiveNumber(values['starts-per-second'], 2)
  if (values.modality !== undefined && !isMediaKind(values.modality))
    throw new Error('--modality must be image, video or audio')
  if (concurrency > 128) throw new Error('Concurrency cannot exceed 128')
  const timeoutMs = positiveInteger(values['timeout-seconds'], 2700) * 1000
  const maxBytes = positiveInteger(values['max-artifact-mb'], 256) * 1024 * 1024
  const token = process.env.COMFY_KEY ?? ''
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`
  const directory = values.output
    ? resolve(values.output)
    : fileURLToPath(
        new URL(`../../../temp/router-model-tests/${runId}/`, import.meta.url)
      )
  const models = routerWorkshopModels.filter(
    (model) =>
      isMediaKind(model.modality) &&
      (!values.modality || model.modality === values.modality)
  )
  const selected = new Set(values.slug ?? models.map((model) => model.slug))
  for (const slug of selected)
    if (!models.some((model) => model.slug === slug))
      throw new Error(`Not a published media page: ${slug}`)
  const cases = models.filter((model) => selected.has(model.slug))
  if (!cases.length) throw new Error('No published media pages selected')
  if (values.report && !values.report.endsWith('.md'))
    throw new Error('--report must name a .md file')
  const markdownPath = values.report
    ? resolve(values.report)
    : fileURLToPath(new URL('../MODELS_TEST_RESULTS.md', import.meta.url))
  const jsonPath = values.report
    ? markdownPath.replace(/\.md$/, '.json')
    : fileURLToPath(
        new URL('../testing/models-test-results.json', import.meta.url)
      )
  const environment = resolveWorkshopCloudEnv(
    process.env.PUBLIC_WORKSHOP_CLOUD_ENV
  )
  const repoDirectory = fileURLToPath(new URL('../../../', import.meta.url))
  const source = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoDirectory,
      encoding: 'utf8'
    }).trim(),
    dirty: Boolean(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: repoDirectory,
        encoding: 'utf8'
      }).trim()
    ),
    runId
  }
  const report = openRouterModelReport({ jsonPath, markdownPath })
  try {
    for (const model of routerWorkshopModels) {
      report.update({
        slug: model.slug,
        routerId: model.routerId,
        modality: model.modality ?? 'other',
        environment,
        inputMode: 'page-defaults'
      })
    }
    await mkdir(resolve(directory, '..'), { recursive: true })
    await mkdir(directory, { mode: 0o700 })
    const journal = join(directory, 'events.jsonl')
    function record(event: Readonly<Record<string, unknown>>) {
      const dated = { ...event, at: new Date().toISOString() }
      appendFileSync(journal, `${JSON.stringify(dated)}\n`, { mode: 0o600 })
      const model = cases.find((item) => item.slug === event.slug)
      if (model && isMediaKind(model.modality)) {
        try {
          const update = routerReportUpdate(
            {
              slug: model.slug,
              routerId: model.routerId,
              modality: model.modality
            },
            environment,
            source,
            dated
          )
          if (update) report.update(update)
        } catch {
          process.stderr.write(
            `Report update rejected for ${model.slug}; event retained in ${journal}\n`
          )
          process.exitCode = 1
        }
      }
    }
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify(
        {
          runId,
          mode: values.execute ? 'execute' : 'preflight',
          routerOrigin: WORKSHOP_ROUTER_BASE_URL,
          source,
          concurrency,
          startsPerSecond,
          timeoutMs,
          maxBytes,
          parameters: {},
          cases: cases.map(({ slug, routerId, modality }) => ({
            slug,
            routerId,
            modality
          }))
        },
        null,
        2
      ),
      { flag: 'wx', mode: 0o600 }
    )
    const preflight = []
    for (const model of cases) {
      try {
        const resolved = resolveRouterRender(model.slug, {})
        const inputHash = createHash('sha256')
          .update(JSON.stringify(resolved.values))
          .digest('hex')
        preflight.push({ model, ready: true })
        record({
          phase: 'preflight',
          status: 'ready',
          slug: model.slug,
          inputHash
        })
      } catch (error) {
        preflight.push({ model, ready: false })
        record({
          phase: 'preflight',
          status: 'failed',
          slug: model.slug,
          ...failureEvidence(error, token)
        })
      }
    }
    const ready = preflight.filter((item) => item.ready)
    const failedPreflight = cases.length - ready.length
    process.stdout.write(
      `Preflight: ${ready.length}/${cases.length} ready; ${failedPreflight} failed. Evidence: ${directory}\n`
    )
    let results: string[] = []
    if (values.execute && ready.length) {
      if (!token) throw new Error('Set COMFY_KEY before using --execute')
      if (
        !['prod', 'staging', 'test'].includes(
          process.env.PUBLIC_WORKSHOP_CLOUD_ENV ?? ''
        )
      )
        throw new Error(
          'Set PUBLIC_WORKSHOP_CLOUD_ENV=prod|staging|test before --execute'
        )
      await checkMediaDecoders()
      const campaign = new AbortController()
      const waitToStart = createStartGate(startsPerSecond)
      const closeTransport = openRouterModelTransport(timeoutMs)
      const svgRasterizer = openRouterSvgRasterizer()
      function stop() {
        campaign.abort(new Error('Campaign interrupted'))
      }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
      try {
        results = await mapConcurrent(ready, concurrency, async ({ model }) => {
          if (campaign.signal.aborted) {
            record({
              phase: 'generation',
              status: 'cancelled',
              slug: model.slug
            })
            return 'cancelled'
          }
          const idempotencyKey = randomUUID()
          const signal = AbortSignal.any([
            campaign.signal,
            AbortSignal.timeout(timeoutMs)
          ])
          const started = Date.now()
          let requestId: string | null = null
          let outputs: readonly RunOutput[] = []
          record({
            phase: 'generation',
            status: 'started',
            slug: model.slug,
            idempotencyKey
          })
          let result: Readonly<Record<string, unknown>>
          let status: string
          try {
            await waitToStart(signal)
            const artifactDirectory = join(directory, model.slug)
            await mkdir(artifactDirectory, { mode: 0o700 })
            const rendered = await router_render(
              model.slug,
              {},
              {
                token,
                idempotencyKey,
                signal,
                rasterizeSvg: svgRasterizer.rasterize,
                onPrepared: async (prepared) => {
                  const body = JSON.stringify(prepared.body, null, 2)
                  await writeFile(
                    join(artifactDirectory, 'request.json'),
                    body,
                    {
                      flag: 'wx',
                      mode: 0o600
                    }
                  )
                  record({
                    phase: 'generation',
                    status: 'prepared',
                    slug: model.slug,
                    requestHash: createHash('sha256')
                      .update(body)
                      .digest('hex'),
                    idempotencyKey
                  })
                },
                onRequestId: (id) => {
                  requestId = id
                  record({
                    phase: 'generation',
                    status: 'response',
                    slug: model.slug,
                    requestId,
                    idempotencyKey
                  })
                }
              }
            )
            requestId = rendered.requestId
            outputs = rendered.outputs
            await captureRouterOutputs(
              outputs,
              artifactDirectory,
              token,
              maxBytes
            )
            if (!isMediaKind(rendered.expectedKind))
              throw new Error('Unsupported output kind')
            const media = outputs.filter(
              (output) => output.kind === rendered.expectedKind
            )
            if (!media.length)
              throw new Error(
                `Page parser returned no ${rendered.expectedKind} output`
              )
            const artifacts = []
            for (const [index, output] of media.entries()) {
              const name = `${index + 1}-${output.fileName.replaceAll(/[^\w.-]/g, '_')}`
              artifacts.push(
                await validateArtifact(
                  output,
                  rendered.expectedKind,
                  join(artifactDirectory, name),
                  signal,
                  maxBytes
                )
              )
            }
            status = 'passed'
            result = {
              artifacts,
              ...(rendered.deadlineCollections
                ? { completion: 'collected-after-timeout' }
                : {})
            }
          } catch (error) {
            status = signal.aborted ? 'cancelled' : 'failed'
            const failure = failureEvidence(error, token)
            requestId = failure.requestId ?? requestId
            result = {
              ...failure,
              reason: signal.aborted ? 'timeout-or-cancelled' : failure.reason
            }
          } finally {
            releaseRouterOutputs(outputs)
          }
          record({
            ...result,
            phase: 'generation',
            status,
            slug: model.slug,
            requestId,
            idempotencyKey,
            elapsedMs: Date.now() - started
          })
          process.stdout.write(
            `${status.toUpperCase()} ${model.slug}${requestId ? ` (${requestId})` : ''}\n`
          )
          return status
        })
      } finally {
        process.removeListener('SIGINT', stop)
        process.removeListener('SIGTERM', stop)
        await svgRasterizer.close()
        await closeTransport()
      }
    }
    const summary = {
      mode: values.execute ? 'execute' : 'preflight',
      pages: cases.length,
      ready: ready.length,
      failedPreflight,
      passed: results.filter((status) => status === 'passed').length,
      failedGeneration: results.filter((status) => status === 'failed').length,
      cancelled: results.filter((status) => status === 'cancelled').length
    }
    await writeFile(
      join(directory, 'summary.json'),
      JSON.stringify(summary, null, 2),
      { flag: 'wx', mode: 0o600 }
    )
    process.stdout.write(`${JSON.stringify(summary)}\n`)
    if (failedPreflight || summary.failedGeneration || summary.cancelled)
      process.exitCode = 1
    process.stdout.write(`Public results: ${markdownPath}\n`)
  } finally {
    report.close()
  }
}

main().catch((error: unknown) => {
  console.error(failureEvidence(error, process.env.COMFY_KEY ?? '').message)
  process.exitCode = 1
})
