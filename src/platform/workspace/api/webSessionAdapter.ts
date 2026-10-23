import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'
import axios, { AxiosError } from 'axios'

import type { WebSessionSend } from '@/platform/auth/session/webSessionFetch'

function requestHeaders({ headers }: InternalAxiosRequestConfig): Headers {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers.toJSON(true))) {
    if (typeof value === 'string') result.set(name, value)
  }
  return result
}

function requestSignal({
  signal,
  timeout
}: InternalAxiosRequestConfig): AbortSignal {
  const signals: AbortSignal[] = []
  if (signal instanceof AbortSignal) signals.push(signal)
  if (timeout) signals.push(AbortSignal.timeout(timeout))
  return AbortSignal.any(signals)
}

function statusError(
  config: InternalAxiosRequestConfig,
  response: AxiosResponse<string>
): AxiosError {
  return new AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 500
      ? AxiosError.ERR_BAD_RESPONSE
      : AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response
  )
}

/** Sends an axios request on the web session and hands back the raw text. */
export function createWebSessionAdapter(send: WebSessionSend): AxiosAdapter {
  return async (config) => {
    const signal = requestSignal(config)
    let response: Response
    try {
      response = await send(axios.getUri(config), {
        method: config.method?.toUpperCase(),
        headers: requestHeaders(config),
        body: config.data,
        signal
      })
    } catch (error) {
      throw AxiosError.from(
        error,
        signal.aborted
          ? signal.reason instanceof DOMException &&
            signal.reason.name === 'TimeoutError'
            ? AxiosError.ETIMEDOUT
            : AxiosError.ERR_CANCELED
          : AxiosError.ERR_NETWORK,
        config
      )
    }

    const result: AxiosResponse<string> = {
      data: await response.text(),
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      config
    }
    if (config.validateStatus?.(result.status) === false) {
      throw statusError(config, result)
    }
    return result
  }
}
