import type { WorkshopModelDetail } from './models-catalogue'
import type {
  RouterParameterMappings,
  RouterRenderParameters
} from './router-parameters'
import {
  mapRouterParameters,
  routerParameterMappings
} from './router-parameters'
import type { WorkshopContract } from './workshop-contract'
import { initialWorkshopPageState } from './workshop-page-state'
import type { FieldSchema, FormValues } from './workshop-playground'
import { validateForm } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { runWorkshopRouter } from './workshop-router'
import { WorkshopRouterError } from './workshop-router-errors'
import type { RunOutput } from './workshop-run'
import type { WorkshopUrlEncoder } from './workshop-url-input'
import { createWorkshopUrlUploader } from './workshop-url-upload'
import type { WorkshopSvgRasterizer } from './workshop-svg-output'

const upload = createWorkshopUrlUploader()

export interface RouterRenderOptions {
  readonly token?: string | (() => Promise<string>)
  readonly idempotencyKey?:
    | string
    | ((body: Readonly<Record<string, unknown>>) => string)
  readonly signal?: AbortSignal
  readonly model?: WorkshopModelDetail
  readonly form?: {
    readonly schema: readonly FieldSchema[]
    readonly values: FormValues
  }
  readonly mappings?: RouterParameterMappings
  readonly uploadFile?: WorkshopUrlEncoder
  readonly rasterizeSvg?: WorkshopSvgRasterizer
  readonly onRequestId?: (requestId: string | null) => void
  readonly onPrepared?: (prepared: PreparedRouterRender) => void | Promise<void>
}

export interface ResolvedRouterRender {
  readonly slug: string
  readonly routerId: string
  readonly expectedKind: 'image' | 'video' | 'audio' | '3d' | 'text'
  readonly contract: WorkshopContract
  readonly values: FormValues
}

export interface PreparedRouterRender extends ResolvedRouterRender {
  readonly body: Readonly<Record<string, unknown>>
}

export interface RouterRenderResult {
  readonly slug: string
  readonly routerId: string
  readonly expectedKind: ResolvedRouterRender['expectedKind']
  readonly requestId: string | null
  readonly outputs: readonly RunOutput[]
  readonly deadlineCollections: number
}

export function resolveModelRouterRender(
  model: WorkshopModelDetail,
  parameters: RouterRenderParameters = {},
  options: Pick<RouterRenderOptions, 'form' | 'mappings'> = {}
): ResolvedRouterRender {
  if (!model.execution || !model.modality || model.incompleteReason)
    throw new WorkshopRouterError('unavailable')
  if (options.form && Object.keys(parameters).length)
    throw new WorkshopRouterError('validation', null, {
      request_body: 'rejected'
    })
  const initial = options.form ?? initialWorkshopPageState(model)
  const values = options.form
    ? options.form.values
    : mapRouterParameters(initial.schema, initial.values, parameters, {
        ...routerParameterMappings(model.execution, model.modality),
        ...options.mappings
      })
  const errors = validateForm(initial.schema, values)
  if (Object.keys(errors).length)
    throw new WorkshopRouterError('validation', null, errors)
  return {
    slug: model.slug,
    routerId: model.routerId,
    expectedKind: model.modality,
    contract: model.execution,
    values
  }
}

async function credential(options: RouterRenderOptions): Promise<string> {
  const token =
    typeof options.token === 'function' ? await options.token() : options.token
  if (!token) throw new WorkshopRouterError('unavailable')
  return token
}

export async function prepareModelRouterRender(
  model: WorkshopModelDetail,
  parameters: RouterRenderParameters = {},
  options: RouterRenderOptions = {}
): Promise<PreparedRouterRender> {
  const signal = options.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const resolved = resolveModelRouterRender(model, parameters, options)
  const body = await prepareWorkshopRouterInput(
    resolved.contract,
    resolved.values,
    signal,
    undefined,
    options.uploadFile ??
      (async (file, uploadSignal) => {
        const token = await credential(options)
        return upload(file, token, token, uploadSignal)
      })
  )
  return { ...resolved, body }
}

export async function router_render(
  slug: string,
  parameters: RouterRenderParameters = {},
  options: RouterRenderOptions = {}
): Promise<RouterRenderResult> {
  const signal = options.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const model =
    options.model ??
    (await import('./workshop-router-content')).getRouterWorkshopModelDetail(
      slug
    )
  if (!model || (options.model && model.slug !== slug))
    throw new WorkshopRouterError('unavailable')
  const prepared = await prepareModelRouterRender(model, parameters, {
    ...options,
    signal
  })
  const token = await credential(options)
  signal.throwIfAborted()
  if (options.onPrepared) await options.onPrepared(prepared)
  signal.throwIfAborted()
  const idempotencyKey =
    typeof options.idempotencyKey === 'function'
      ? options.idempotencyKey(prepared.body)
      : (options.idempotencyKey ?? crypto.randomUUID())
  const result = await runWorkshopRouter({
    contract: prepared.contract,
    body: prepared.body,
    token,
    idempotencyKey,
    signal,
    rasterizeSvg: options.rasterizeSvg,
    ...(options.onRequestId ? { onRequestId: options.onRequestId } : {})
  })
  return {
    slug: prepared.slug,
    routerId: prepared.routerId,
    expectedKind: prepared.expectedKind,
    ...result
  }
}
