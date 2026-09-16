/**
 * Joining a caller to a shared in-flight read without letting either one
 * decide the other's fate.
 *
 * Deduplication and cancellation pull in opposite directions: if the request
 * carries the first caller's signal, that caller aborting fails every reader
 * that joined it, and a joiner aborting does nothing at all. So the shared
 * request carries no caller signal — it is bounded by its own timeout — and
 * each caller's signal releases only that caller's wait.
 *
 * This is the semantic `SessionClient.ensureFresh` already documents for its
 * shared mint: concurrent callers share one request, and a later caller's
 * signal releases that caller with a transient failure without cancelling the
 * work the others are still waiting on.
 */
import type {
  BillingRequest,
  BillingResult,
  BillingTransport
} from './billingContracts.js'
import type { BillingScopeContext } from './billingScope.js'
import { sameBillingScope } from './billingScope.js'
import { readBillingErrorCode } from './billingErrorBody.js'
import { codeForHttpStatus } from './httpStatus.js'

/**
 * An abandoned wait is transient, the same bucket the transport reports an
 * abort under: the caller stopped waiting, which says nothing about whether
 * the read would have succeeded.
 */
const ABANDONED = {
  status: 'error',
  code: 'REQUEST_FAILED'
} as const satisfies BillingResult<never>

type ParsedBody<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false }

interface ValidatedBillingResponse<T> {
  readonly data: T
  readonly body: unknown
  readonly httpStatus: number
}

export function matchesScopedRead<
  T extends { readonly context: BillingScopeContext }
>(read: T | undefined, context: BillingScopeContext): read is T {
  return (
    read !== undefined &&
    read.context.generation === context.generation &&
    sameBillingScope(read.context.scope, context.scope)
  )
}

export async function readValidatedBillingResponse<T>(
  transport: BillingTransport,
  request: BillingRequest,
  parse: (body: unknown) => ParsedBody<T>
): Promise<BillingResult<ValidatedBillingResponse<T>>> {
  const response = await transport(request)
  if (response.status === 'error') return response

  const { httpStatus, body } = response.value
  if (httpStatus < 200 || httpStatus >= 300) {
    const serverCode = readBillingErrorCode(body)
    return {
      status: 'error',
      code: codeForHttpStatus(response.value),
      httpStatus,
      ...(serverCode === undefined ? {} : { serverCode })
    }
  }

  const parsed = parse(body)
  if (!parsed.success) {
    return { status: 'error', code: 'MALFORMED_RESPONSE', httpStatus }
  }

  return { status: 'ok', value: { data: parsed.data, body, httpStatus } }
}

export function releaseOnAbort<T>(
  shared: Promise<BillingResult<T>>,
  signal: AbortSignal | undefined
): Promise<BillingResult<T>> {
  if (signal === undefined) return shared.catch(() => ABANDONED)
  // An 'abort' listener never fires for a signal that is already aborted, so
  // a caller who cancelled before joining would otherwise wait for the full
  // shared read.
  if (signal.aborted) {
    void shared.catch(() => {})
    return Promise.resolve(ABANDONED)
  }

  return new Promise<BillingResult<T>>((resolve) => {
    const onAbort = () => resolve(ABANDONED)
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve(ABANDONED)
      }
    )
  })
}
