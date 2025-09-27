export function normalizeI18nKey(key: string) {
  return typeof key === 'string' ? key.replace(/\./g, '_') : ''
}

export function isValidUrl(url: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch {
    return false
  }
}
