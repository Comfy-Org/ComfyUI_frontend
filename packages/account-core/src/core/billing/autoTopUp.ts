import type {
  AutoReloadSettingsRequest,
  GetBillingAutoReloadPreviewData
} from '@comfyorg/ingest-types'
import {
  zGetBillingAutoReloadPreviewQuery,
  zGetBillingAutoReloadPreviewResponse,
  zGetBillingAutoReloadResponse,
  zPutBillingAutoReloadBody,
  zPutBillingAutoReloadResponse
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import type { BillingResult, BillingTransport } from './billingContracts'
import type { BillingScope, BillingScopeSource } from './billingScope'
import { createScopedReader } from './scopedReader'
import { readValidatedBillingResponse } from './sharedRead'
import { wireCents } from './wireCents'

export const AUTO_TOP_UP_ROUTE = '/billing/auto-reload'
export const AUTO_TOP_UP_PREVIEW_ROUTE = '/billing/auto-reload/preview'

const settingsWireCents = {
  max_monthly_budget_cents: wireCents,
  max_reload_credits: wireCents.nullable(),
  min_reload_credits: wireCents,
  monthly_budget_cents: wireCents.nullable(),
  reload_amount_cents: wireCents.nullable(),
  reload_credits: wireCents.nullable(),
  spent_this_cycle_cents: wireCents,
  target_credits: wireCents.nullable(),
  threshold_credits: wireCents.nullable()
}

const ReadSettingsSchema =
  zGetBillingAutoReloadResponse.extend(settingsWireCents)
const SavedSettingsSchema =
  zPutBillingAutoReloadResponse.extend(settingsWireCents)
const PreviewSchema = zGetBillingAutoReloadPreviewResponse.extend({
  charge_cents: wireCents.nullable(),
  charge_credits: wireCents.nullable()
})

/** The server's auto top-up settings and this cycle's automatic spend, as published. */
export type AutoReloadSettings = z.infer<typeof ReadSettingsSchema>

/** The server's estimate of what saving the proposed settings would charge. */
export type AutoReloadPreview = z.infer<typeof PreviewSchema>

export type SaveAutoTopUpInput = AutoReloadSettingsRequest

export type PreviewAutoTopUpQuery = GetBillingAutoReloadPreviewData['query']

/** A failure of the typed operation, or an input the generated request contract refuses before anything is sent. */
export type AutoTopUpCommandResult<T> =
  | BillingResult<T>
  | { readonly status: 'error'; readonly code: 'INVALID_REQUEST' }

export interface AutoTopUpCommandOptions {
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export type AutoTopUpScope = BillingScope

export interface AutoTopUpSnapshot {
  readonly scope: AutoTopUpScope
  readonly settings: AutoReloadSettings
  /** ms since epoch at which this read settled. */
  readonly readAt: number
}

export interface AutoTopUpReadOptions {
  readonly signal?: AbortSignal
  /** Bounds the request, when this caller is the one that issues it. */
  readonly timeoutMs?: number
}

export interface AutoTopUpReader {
  /** Always requests. Concurrent callers for one scope share a single request. */
  read: (
    options?: AutoTopUpReadOptions
  ) => Promise<BillingResult<AutoTopUpSnapshot>>
  /** The last settings published for the current scope. */
  getSnapshot: () => AutoTopUpSnapshot | undefined
  /** Drops the published settings, and keeps a read already in flight from publishing. */
  invalidate: () => void
  dispose: () => void
}

export interface AutoTopUpReaderOptions {
  readonly transport: BillingTransport
  readonly scopeSource: BillingScopeSource
  readonly now?: () => number
}

const INVALID_REQUEST = { status: 'error', code: 'INVALID_REQUEST' } as const

function requestBudget(options: AutoTopUpCommandOptions) {
  return {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  }
}

function previewRoute(query: PreviewAutoTopUpQuery): string {
  const search = new URLSearchParams({
    threshold_credits: String(query.threshold_credits),
    target_credits: String(query.target_credits)
  })
  if (query.monthly_budget_cents !== undefined) {
    search.set('monthly_budget_cents', String(query.monthly_budget_cents))
  }
  return `${AUTO_TOP_UP_PREVIEW_ROUTE}?${search.toString()}`
}

export function createAutoTopUpReader(
  options: AutoTopUpReaderOptions
): AutoTopUpReader {
  const { transport, scopeSource, now = Date.now } = options

  const reader = createScopedReader<
    AutoReloadSettings,
    AutoTopUpSnapshot,
    AutoTopUpReadOptions
  >({
    transport,
    scopeSource,
    route: AUTO_TOP_UP_ROUTE,
    parse: (body) => ReadSettingsSchema.safeParse(body),
    timeoutMs: (readOptions) => readOptions?.timeoutMs,
    project: ({ data }, scope) => ({
      status: 'ok',
      value: { scope, settings: data, readAt: now() }
    }),
    publish: (value, fenced) => (fenced ? undefined : value)
  })

  return {
    read: reader.read,
    getSnapshot: reader.getSnapshot,
    invalidate: () => {
      reader.setSnapshot(undefined)
      reader.fenceInFlight({ detach: true })
    },
    dispose: reader.dispose
  }
}

/**
 * Saves the settings and returns what the server stored. Sent without an
 * idempotency key, so a stale token is reported rather than replayed.
 */
export async function saveAutoTopUp(
  transport: BillingTransport,
  input: SaveAutoTopUpInput,
  options: AutoTopUpCommandOptions = {}
): Promise<AutoTopUpCommandResult<AutoReloadSettings>> {
  if (!zPutBillingAutoReloadBody.safeParse(input).success) {
    return INVALID_REQUEST
  }
  const response = await readValidatedBillingResponse(
    transport,
    {
      method: 'PUT',
      route: AUTO_TOP_UP_ROUTE,
      body: input,
      ...requestBudget(options)
    },
    (raw) => SavedSettingsSchema.safeParse(raw)
  )
  return response.status === 'error'
    ? response
    : { status: 'ok', value: response.value.data }
}

/** Asks the server what saving these settings would charge now, without saving them. */
export async function previewAutoTopUp(
  transport: BillingTransport,
  query: PreviewAutoTopUpQuery,
  options: AutoTopUpCommandOptions = {}
): Promise<AutoTopUpCommandResult<AutoReloadPreview>> {
  if (!zGetBillingAutoReloadPreviewQuery.safeParse(query).success) {
    return INVALID_REQUEST
  }
  const response = await readValidatedBillingResponse(
    transport,
    { method: 'GET', route: previewRoute(query), ...requestBudget(options) },
    (raw) => PreviewSchema.safeParse(raw)
  )
  return response.status === 'error'
    ? response
    : { status: 'ok', value: response.value.data }
}
