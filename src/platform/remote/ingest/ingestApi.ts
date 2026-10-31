import type { AxiosInstance } from 'axios'
import axios from 'axios'
import {
  webSessionRequests,
  webSessionSend
} from '@/platform/auth/session/webSessionFetch'
import {
  UNKNOWN_ERROR_CODE,
  errorResponseFromBody
} from '@/platform/remote/comfyui/errors'
import type { AuthHeader } from '@/types/authTypes'
import { createWebSessionAdapter } from './webSessionAdapter'
import { attachCapabilityRevisionInterceptor } from './capabilityRevision'
import {
  NO_WORKSPACE_ACCESS,
  NoWorkspaceAccessError,
  WorkspaceApiError
} from './ingestApiError'
export interface IngestApiAuth {
  getWorkspaceAuthHeader(): Promise<AuthHeader>
  getFirebaseAuthHeader(): Promise<AuthHeader>
  attachRetryInterceptor(client: AxiosInstance): void
}

export const ingestApiClient = axios.create({
  headers: {
    'Content-Type': 'application/json'
  }
})

attachCapabilityRevisionInterceptor(ingestApiClient)

let ingestApiAuth: IngestApiAuth | undefined

export function setIngestApiAuth(auth: IngestApiAuth): void {
  ingestApiAuth = auth
  auth.attachRetryInterceptor(ingestApiClient)
}

export function requireIngestApiAuth(): IngestApiAuth {
  if (!ingestApiAuth) {
    throw new WorkspaceApiError('Workspace API auth is not installed', 401)
  }
  return ingestApiAuth
}

export async function requestAuth() {
  if (webSessionRequests()) {
    const send = await webSessionSend()
    if (send) return { adapter: createWebSessionAdapter(send) }
  }
  return { headers: await requireIngestApiAuth().getWorkspaceAuthHeader() }
}

export function handleAxiosError(err: unknown, operation: string): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const { code, message } = errorResponseFromBody(
      err.response?.data,
      err.message
    )
    if (status === 403 && code === NO_WORKSPACE_ACCESS) {
      throw new NoWorkspaceAccessError(message, status, operation)
    }

    throw new WorkspaceApiError(
      message,
      status,
      code === UNKNOWN_ERROR_CODE ? undefined : code,
      undefined,
      operation
    )
  }
  throw err
}
