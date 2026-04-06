const DEFAULT_COMFY_CLOUD_URL = 'https://cloud.comfy.org'

function normalizeCloudUrl(raw?: string): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_COMFY_CLOUD_URL

  try {
    return new URL(value).origin
  } catch {
    return DEFAULT_COMFY_CLOUD_URL
  }
}

export function getComfyCloudBaseUrl(): string {
  return normalizeCloudUrl(import.meta.env.PUBLIC_COMFY_CLOUD_URL)
}

export function getCloudLandingUrl(ctaContent: string): string {
  const params = new URLSearchParams({
    utm_source: 'workflow_hub',
    utm_medium: 'site_CTA',
    utm_campaign: 'hub_preview',
    utm_content: ctaContent
  })

  return `${getComfyCloudBaseUrl()}/?${params.toString()}`
}

export function getCloudCtaUrl(shareId: string, ctaLocation: string): string {
  const params = new URLSearchParams({
    share: shareId,
    utm_source: 'workflow_hub',
    utm_medium: 'site_CTA',
    utm_campaign: 'hub_preview',
    utm_content: shareId,
    utm_term: ctaLocation
  })

  return `${getComfyCloudBaseUrl()}/?${params.toString()}`
}

export function getWorkflowDownloadUrl(
  shareId: string,
  filename?: string
): string {
  const params = new URLSearchParams()
  if (filename) params.set('filename', filename)
  const query = params.toString()

  return `/workflows/download/${encodeURIComponent(shareId)}.json${query ? `?${query}` : ''}`
}
