const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function getBillingWebUrl(): URL | null {
  const value = import.meta.env.VITE_BILLING_WEB_URL
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (url.protocol === 'https:') return url

    if (
      import.meta.env.DEV &&
      url.protocol === 'http:' &&
      LOCAL_HOSTNAMES.has(url.hostname)
    ) {
      return url
    }
  } catch {
    return null
  }

  return null
}
