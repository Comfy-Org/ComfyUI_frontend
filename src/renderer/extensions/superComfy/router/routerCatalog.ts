import { useStorage } from '@vueuse/core'
import { Semaphore, sortBy } from 'es-toolkit'
import { computed, ref, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { z } from 'zod'

import { t } from '@/i18n'
import { zModality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  GenerateContract,
  Modality
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type { RouterFailure } from '@/renderer/extensions/superComfy/router/routerApi'
import {
  routerFailureMessage,
  routerFetch,
  routerModelPath
} from '@/renderer/extensions/superComfy/router/routerApi'
import type { RouterModelSummary } from '@/renderer/extensions/superComfy/router/routerContract'
import {
  deriveRouterContract,
  summarizeRouterSchema,
  toGenerateContract
} from '@/renderer/extensions/superComfy/router/routerContract'
import { parseOpenApiDoc } from '@/renderer/extensions/superComfy/router/routerSchema'
import type {
  OpenApiDoc,
  RouterContract
} from '@/renderer/extensions/superComfy/router/routerTypes'

interface RouterCatalogEntry {
  id: string
  label: string
  provider: string
}

export type RouterCatalogState =
  | {
      status: 'loading'
      done: number
      total: number
      models: RouterCatalogEntry[]
    }
  | { status: 'ready'; models: RouterCatalogEntry[]; unsupported: number }
  | { status: 'refused'; detail: string }
  | { status: 'failed'; message: string }

export type RouterAccess =
  | { status: 'ok' }
  | { status: 'refused'; detail: string }
  | { status: 'unreachable'; message: string }

export interface RouterListEntry {
  id: string
  provider: string
  model: string
  etag: string | null
}

export type CatalogListOutcome =
  | { ok: true; models: RouterListEntry[] }
  | { ok: false; refused: true; detail: string }
  | { ok: false; refused: false; message: string }

export type SchemaOutcome =
  | { ok: true; doc: OpenApiDoc }
  | { ok: false; message: string }

export type RouterContractLoad =
  | { ok: true; contract: RouterContract }
  | { ok: false; message: string }

export interface CatalogIndexDeps {
  listModels(): Promise<CatalogListOutcome>
  fetchSchema(modelId: string): Promise<SchemaOutcome>
  summaries: Ref<Record<string, unknown>>
  now(): number
}

export interface CatalogIndex {
  catalog(modality: Modality): ComputedRef<RouterCatalogState>
  refresh(): Promise<void>
}

type IndexPhase =
  | { status: 'idle' }
  | { status: 'loading'; done: number; total: number }
  | { status: 'ready'; at: number }
  | { status: 'refused'; detail: string }
  | { status: 'failed'; message: string }

const INDEX_STORAGE_KEY = 'Comfy.SuperComfy.RouterIndex.v1'
const PUBLIC_SCHEMA_BASE = 'https://docs.comfy.org/router-schemas'
const LIST_PAGE_SIZE = 100
const LIST_MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 15_000
const LIST_TTL_MS = 10 * 60 * 1000
const SCHEMA_CONCURRENCY = 6
const HIDDEN_PROVIDERS: ReadonlySet<string> = new Set(['openrouter'])

const zListPage = z.looseObject({
  data: z.array(
    z.looseObject({
      id: z.string(),
      provider: z.string().optional(),
      model: z.string().optional(),
      schema_etag: z.string().nullish()
    })
  ),
  has_more: z.boolean().optional(),
  next_cursor: z.string().nullish()
})

const zSummary = z.object({
  id: z.string(),
  etag: z.string().nullable(),
  primary: zModality.nullable(),
  status: z.enum(['supported', 'unsupported', 'hidden'])
})

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function modelSegment(modelId: string): string {
  return modelId.slice(modelId.indexOf('/') + 1)
}

function providerOf(modelId: string): string {
  return modelId.slice(0, Math.max(0, modelId.indexOf('/')))
}

type AccessRefusal = Exclude<RouterFailure, { reason: 'network' }>

function isAccessRefusal(failure: RouterFailure): failure is AccessRefusal {
  if (failure.reason === 'unauthenticated') return true
  return (
    failure.reason === 'refused' &&
    (failure.status === 401 || failure.status === 403)
  )
}

function listFailure(failure: RouterFailure): CatalogListOutcome {
  if (!isAccessRefusal(failure)) {
    return { ok: false, refused: false, message: routerFailureMessage(failure) }
  }
  return { ok: false, refused: true, detail: failure.detail }
}

function toListEntry(raw: z.infer<typeof zListPage>['data'][number]) {
  return {
    id: raw.id,
    provider: raw.provider ?? providerOf(raw.id),
    model: raw.model ?? modelSegment(raw.id),
    etag: raw.schema_etag ?? null
  }
}

async function fetchModelPages(): Promise<CatalogListOutcome> {
  const models: RouterListEntry[] = []
  let cursor: string | null = null
  for (let page = 0; page < LIST_MAX_PAGES; page++) {
    const query = new URLSearchParams({ limit: String(LIST_PAGE_SIZE) })
    if (cursor) query.set('cursor', cursor)
    const response = await routerFetch({
      path: `/v2/models?${query.toString()}`,
      method: 'GET',
      timeoutMs: REQUEST_TIMEOUT_MS
    })
    if (!response.ok) return listFailure(response)
    const parsed = zListPage.safeParse(response.json)
    if (!parsed.success) {
      return {
        ok: false,
        refused: false,
        message: t('superComfy.model.loadFailed')
      }
    }
    models.push(...parsed.data.data.map(toListEntry))
    cursor = parsed.data.next_cursor ?? null
    if (!parsed.data.has_more || !cursor) break
  }
  return { ok: true, models }
}

let listCache: { at: number; models: RouterListEntry[] } | null = null

async function listRouterModels(): Promise<CatalogListOutcome> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) {
    return { ok: true, models: listCache.models }
  }
  const fetched = await fetchModelPages()
  if (fetched.ok) {
    listCache = { at: Date.now(), models: fetched.models }
    return fetched
  }
  return listCache ? { ok: true, models: listCache.models } : fetched
}

async function fetchPublicSchema(modelId: string): Promise<SchemaOutcome> {
  try {
    const response = await fetch(
      `${PUBLIC_SCHEMA_BASE}/${routerModelPath(modelId)}.json`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
    )
    if (!response.ok) {
      return {
        ok: false,
        message: response.statusText || String(response.status)
      }
    }
    const raw: unknown = await response.json()
    const doc = parseOpenApiDoc(raw)
    return doc
      ? { ok: true, doc }
      : { ok: false, message: t('superComfy.model.loadFailed') }
  } catch (error) {
    return { ok: false, message: errorText(error) }
  }
}

async function fetchLiveSchema(modelId: string): Promise<SchemaOutcome> {
  const response = await routerFetch({
    path: `/v2/models/${routerModelPath(modelId)}/openapi.json`,
    method: 'GET',
    timeoutMs: REQUEST_TIMEOUT_MS
  })
  if (!response.ok) {
    return { ok: false, message: routerFailureMessage(response) }
  }
  const doc = parseOpenApiDoc(response.json)
  return doc
    ? { ok: true, doc }
    : { ok: false, message: t('superComfy.model.loadFailed') }
}

async function fetchLiveThenPublic(modelId: string): Promise<SchemaOutcome> {
  const live = await fetchLiveSchema(modelId)
  if (live.ok) return live
  const published = await fetchPublicSchema(modelId)
  return published.ok ? published : live
}

const schemaCache = new Map<string, Promise<SchemaOutcome>>()

function getRouterSchema(
  modelId: string,
  prefer: 'live' | 'public'
): Promise<SchemaOutcome> {
  const key = `${prefer}:${modelId}`
  const cached = schemaCache.get(key)
  if (cached) return cached
  const pending =
    prefer === 'live'
      ? fetchLiveThenPublic(modelId)
      : fetchPublicSchema(modelId)
  schemaCache.set(key, pending)
  void pending.then((outcome) => {
    if (!outcome.ok) schemaCache.delete(key)
  })
  return pending
}

export async function loadRouterContract(
  modelId: string,
  modality: Modality
): Promise<RouterContractLoad> {
  const schema = await getRouterSchema(modelId, 'live')
  if (!schema.ok) return schema
  const derived = deriveRouterContract(modelId, schema.doc, modality)
  return derived.ok
    ? derived
    : { ok: false, message: t('superComfy.model.notSupported') }
}

export async function resolveModelContract(
  modelId: string,
  modality: Modality
): Promise<
  | { ok: true; contract: GenerateContract; label: string }
  | { ok: false; message: string }
> {
  const loaded = await loadRouterContract(modelId, modality)
  if (!loaded.ok) return loaded
  return {
    ok: true,
    contract: toGenerateContract(loaded.contract),
    label: modelSegment(modelId)
  }
}

export async function probeRouterAccess(): Promise<RouterAccess> {
  const response = await routerFetch({
    path: '/v2/models?limit=1',
    method: 'GET',
    timeoutMs: REQUEST_TIMEOUT_MS
  })
  if (response.ok) return { status: 'ok' }
  if (response.reason === 'network') {
    return { status: 'unreachable', message: response.message }
  }
  if (isAccessRefusal(response)) {
    return { status: 'refused', detail: response.detail }
  }
  return { status: 'unreachable', message: routerFailureMessage(response) }
}

function summaryOf(
  summaries: Record<string, unknown>,
  id: string
): RouterModelSummary | undefined {
  if (!Object.hasOwn(summaries, id)) return undefined
  const parsed = zSummary.safeParse(summaries[id])
  return parsed.success ? parsed.data : undefined
}

function isListable(entry: RouterListEntry): boolean {
  return !HIDDEN_PROVIDERS.has(entry.provider)
}

function entriesFor(
  modality: Modality,
  models: readonly RouterListEntry[],
  summaries: Record<string, unknown>
): RouterCatalogEntry[] {
  const supported = models.filter((entry) => {
    const summary = summaryOf(summaries, entry.id)
    return summary?.status === 'supported' && summary.primary === modality
  })
  return sortBy(
    supported.map((entry) => ({
      id: entry.id,
      label: entry.model,
      provider: entry.provider
    })),
    ['provider', 'label']
  )
}

function unsupportedCount(
  modality: Modality,
  models: readonly RouterListEntry[],
  summaries: Record<string, unknown>
): number {
  return models.filter((entry) => {
    const summary = summaryOf(summaries, entry.id)
    return summary?.status === 'unsupported' && summary.primary === modality
  }).length
}

function catalogState(
  modality: Modality,
  phase: IndexPhase,
  models: readonly RouterListEntry[],
  summaries: Record<string, unknown>
): RouterCatalogState {
  switch (phase.status) {
    case 'refused':
      return { status: 'refused', detail: phase.detail }
    case 'failed':
      return { status: 'failed', message: phase.message }
    case 'idle':
      return { status: 'loading', done: 0, total: 0, models: [] }
    case 'loading':
      return {
        status: 'loading',
        done: phase.done,
        total: phase.total,
        models: entriesFor(modality, models, summaries)
      }
    case 'ready':
      return {
        status: 'ready',
        models: entriesFor(modality, models, summaries),
        unsupported: unsupportedCount(modality, models, summaries)
      }
  }
}

export function createCatalogIndex(deps: CatalogIndexDeps): CatalogIndex {
  const phase = shallowRef<IndexPhase>({ status: 'idle' })
  const listed = shallowRef<RouterListEntry[]>([])
  let inFlight: Promise<void> | null = null

  async function summarize(entry: RouterListEntry): Promise<void> {
    const schema = await deps.fetchSchema(entry.id)
    if (!schema.ok) return
    deps.summaries.value = {
      ...deps.summaries.value,
      [entry.id]: summarizeRouterSchema(entry.id, entry.etag, schema.doc)
    }
  }

  async function indexMissing(missing: readonly RouterListEntry[]) {
    const semaphore = new Semaphore(SCHEMA_CONCURRENCY)
    let done = 0
    phase.value = { status: 'loading', done, total: missing.length }
    await Promise.all(
      missing.map(async (entry) => {
        await semaphore.acquire()
        try {
          await summarize(entry)
        } finally {
          semaphore.release()
          done += 1
          phase.value = { status: 'loading', done, total: missing.length }
        }
      })
    )
  }

  async function build(): Promise<void> {
    if (phase.value.status !== 'ready') {
      phase.value = { status: 'loading', done: 0, total: 0 }
    }
    const listing = await deps.listModels()
    if (!listing.ok) {
      phase.value = listing.refused
        ? { status: 'refused', detail: listing.detail }
        : { status: 'failed', message: listing.message }
      return
    }
    listed.value = listing.models.filter(isListable)
    const missing = listed.value.filter((entry) => {
      const known = summaryOf(deps.summaries.value, entry.id)
      return !known || known.etag !== entry.etag
    })
    if (missing.length > 0) await indexMissing(missing)
    phase.value = { status: 'ready', at: deps.now() }
  }

  function isFresh(): boolean {
    const current = phase.value
    return current.status === 'ready' && deps.now() - current.at < LIST_TTL_MS
  }

  function refresh(): Promise<void> {
    if (inFlight) return inFlight
    if (isFresh()) return Promise.resolve()
    inFlight = build().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  function catalog(modality: Modality): ComputedRef<RouterCatalogState> {
    void refresh()
    return computed(() =>
      catalogState(modality, phase.value, listed.value, deps.summaries.value)
    )
  }

  return { catalog, refresh }
}

function openSummaryStorage(): Ref<Record<string, unknown>> {
  try {
    return useStorage<Record<string, unknown>>(INDEX_STORAGE_KEY, {})
  } catch {
    return ref<Record<string, unknown>>({})
  }
}

let sharedIndex: CatalogIndex | null = null

function catalogIndex(): CatalogIndex {
  sharedIndex ??= createCatalogIndex({
    listModels: listRouterModels,
    fetchSchema: fetchPublicSchema,
    summaries: openSummaryStorage(),
    now: Date.now
  })
  return sharedIndex
}

export function useRouterCatalog(
  modality: Modality
): Readonly<Ref<RouterCatalogState>> {
  return catalogIndex().catalog(modality)
}
