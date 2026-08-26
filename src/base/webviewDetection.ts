const SOCIAL_APP_PATTERNS =
  /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly/i

const IOS_FIRST_PARTY_BROWSER_PATTERNS = /CriOS|FxiOS|OPiOS|EdgiOS/i

function isAndroidWebView(ua: string): boolean {
  return /\bwv\b/.test(ua) && /Android/.test(ua)
}

function isIOSWebView(ua: string): boolean {
  if (!/AppleWebKit/i.test(ua)) return false
  if (/Safari\//i.test(ua)) return false
  if (IOS_FIRST_PARTY_BROWSER_PATTERNS.test(ua)) return false
  return true
}

function isSocialAppBrowser(ua: string): boolean {
  return SOCIAL_APP_PATTERNS.test(ua)
}

function isFirstPartyIOSBrowser(ua: string): boolean {
  if (IOS_FIRST_PARTY_BROWSER_PATTERNS.test(ua)) return true
  if (!/iPhone|iPad|iPod|Macintosh.*Mobile\//i.test(ua)) return false
  return /Safari\//i.test(ua) && /Version\//i.test(ua)
}

function hasWkWebViewMessageBridge(): boolean {
  try {
    const win = globalThis as Record<string, unknown>
    return (
      typeof win.webkit === 'object' &&
      win.webkit !== null &&
      typeof (win.webkit as Record<string, unknown>).messageHandlers ===
        'object'
    )
  } catch {
    return false
  }
}

function hasReactNativeWebViewBridge(): boolean {
  try {
    const win = globalThis as Record<string, unknown>
    return win.ReactNativeWebView != null
  } catch {
    return false
  }
}

export function isEmbeddedWebView(ua: string = navigator.userAgent): boolean {
  if (isSocialAppBrowser(ua)) return true
  if (isAndroidWebView(ua)) return true
  if (isIOSWebView(ua)) return true
  if (hasReactNativeWebViewBridge()) return true
  if (!isFirstPartyIOSBrowser(ua) && hasWkWebViewMessageBridge()) return true
  return false
}
