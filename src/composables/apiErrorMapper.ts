import axios from 'axios'

import type { ApiErrorMapper } from '@/composables/useApiRequest'

interface ResponseFallbackArgs {
  context: string
  status: number
  dataMessage?: string
  axiosMessage: string
}

export interface DefaultErrorMapperOptions {
  /** Joins the context with a message for the non-axios and no-response guards. */
  formatFallback: (context: string, message: string) => string
  /** Rendered in place of a thrown non-`Error` value; defaults to `String(err)`. */
  unknownErrorMessage?: string
  /** Per-status copy; a function receives the response body's message when present. */
  statusMessages?: Record<number, string | ((dataMessage?: string) => string)>
  /** Final fallback when no route-specific or status entry matches. */
  responseFallback: (args: ResponseFallbackArgs) => string
}

/**
 * Builds the error mapper every axios-backed service shares: guard the
 * non-axios and no-response cases, then resolve the status against the
 * caller's route-specific copy, its own status table, and its fallback.
 * Only the copy differs between services, so only the copy is configured.
 */
export function createDefaultErrorMapper({
  formatFallback,
  unknownErrorMessage,
  statusMessages,
  responseFallback
}: DefaultErrorMapperOptions): ApiErrorMapper {
  return (err, context, routeSpecificErrors) => {
    if (!axios.isAxiosError<{ message?: string }>(err))
      return formatFallback(
        context,
        err instanceof Error
          ? err.message
          : (unknownErrorMessage ?? String(err))
      )

    if (!err.response) return formatFallback(context, err.message)

    const { status, data } = err.response
    const dataMessage = data?.message

    if (routeSpecificErrors?.[status]) return routeSpecificErrors[status]

    const statusMessage = statusMessages?.[status]
    if (statusMessage !== undefined)
      return typeof statusMessage === 'function'
        ? statusMessage(dataMessage)
        : statusMessage

    return responseFallback({
      context,
      status,
      dataMessage,
      axiosMessage: err.message
    })
  }
}
