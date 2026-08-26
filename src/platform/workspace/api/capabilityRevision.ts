import type { AxiosInstance, AxiosResponse, RawAxiosHeaders } from 'axios'
import axios, { AxiosHeaders } from 'axios'

const CAPABILITY_REVISION_HEADER = 'X-Capability-Revision'
// The capability read echoes the header on its own response, so only a
// mutation counts as an invalidation signal: publishing a read's own revision
// would mark that read stale and refetch it forever.
const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete'])

type CapabilityRevisionListener = (revision: number) => void

const listeners = new Set<CapabilityRevisionListener>()

export function onCapabilityRevision(
  listener: CapabilityRevisionListener
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isMutationResponse(response: AxiosResponse | undefined): boolean {
  const method = response?.config?.method
  return (
    typeof method === 'string' && MUTATION_METHODS.has(method.toLowerCase())
  )
}

function readCapabilityRevision(
  response: AxiosResponse | undefined
): number | null {
  const headers = response?.headers
  if (!headers) return null
  const raw = AxiosHeaders.from(headers as RawAxiosHeaders).get(
    CAPABILITY_REVISION_HEADER
  )
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const revision = Number(value)
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null
}

/**
 * Installs a response interceptor that republishes the capability revision a
 * mutation reports to {@link onCapabilityRevision} subscribers.
 *
 * The header is stamped before the handler runs, so a rejected mutation
 * carries it too and the error arm has to read it as well. It is absent
 * whenever CORS is bypassed (local desktop origins), so every read degrades to
 * "no revision reported" rather than assuming presence.
 */
export function attachCapabilityRevisionInterceptor(
  client: AxiosInstance
): void {
  const publish = (response: AxiosResponse | undefined) => {
    if (!isMutationResponse(response)) return
    const revision = readCapabilityRevision(response)
    if (revision !== null) {
      for (const listener of [...listeners]) listener(revision)
    }
  }

  client.interceptors.response.use(
    (response) => {
      publish(response)
      return response
    },
    (error: unknown) => {
      publish(axios.isAxiosError(error) ? error.response : undefined)
      throw error
    }
  )
}
