export function isTestCheckoutUrl(url: string): boolean {
  try {
    const value = new URL(url)
    return /(?:^|[^A-Za-z0-9])cs_test_[A-Za-z0-9_]+/.test(
      `${value.pathname}${value.search}`
    )
  } catch {
    return false
  }
}
