import { COMFY_API_BASE_URL } from '@/config/comfyApi'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

export type AuditLogType =
  | 'account_created'
  | 'credit_added'
  | 'api_usage_started'
  | 'api_usage_completed'

export interface AuditLog {
  event_type: AuditLogType
  event_id: string
  params: Record<string, any> // Using Record since it's additionalProperties: true
  createdAt: string
}

interface CustomerEventsResponse {
  events: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getMyEvents({
  page = 1,
  limit = 10
}: {
  page?: number
  limit?: number
} = {}): Promise<CustomerEventsResponse> {
  const headers = await useFirebaseAuthStore().getAuthHeader()

  const url = new URL(`${COMFY_API_BASE_URL}/customers/events`)
  url.searchParams.append('page', page.toString())
  url.searchParams.append('limit', limit.toString())

  if (!headers) {
    throw new Error('Authentication header is missing')
  }

  const response = await fetch(url.toString(), {
    headers
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`)
  }

  return await response.json()
}
