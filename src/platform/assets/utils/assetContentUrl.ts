import { api } from '@/scripts/api'

export function assetContentUrl(id: string): string {
  return api.apiURL(`/assets/${id}/content?disposition=inline`)
}
