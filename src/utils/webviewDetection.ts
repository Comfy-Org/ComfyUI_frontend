/**
 * Detects whether the app is running inside an embedded webview.
 *
 * Google blocks OAuth via `signInWithPopup` in embedded webviews,
 * returning a 403 `disallowed_useragent` error (policy since 2021).
 * This utility is used to hide the Google SSO button in those contexts.
 *
 * Detection covers:
 *   • Android WebView (`wv` token in UA)
 *   • iOS WKWebView (has `AppleWebKit` but lacks `Safari/`)
 *   • Social app in-app browsers (Facebook, Instagram, TikTok, etc.)
 *   • JS bridge objects (`window.webkit.messageHandlers`, `ReactNativeWebView`)
 */

const SOCIAL_APP_PATTERNS =
  /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly/i

function isAndroidWebView(ua: string): boolean {
  return /\bwv\b/.test(ua) && /Android/.test(ua)
}

function isIOSWebView(ua: string): boolean {
  if (!/AppleWebKit/i.test(ua)) return false
  if (/Safari\//i.test(ua)) return false
  if (/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)) return false
  return true
}

function isSocialAppBrowser(ua: string): boolean {
  return SOCIAL_APP_PATTERNS.test(ua)
}

function hasWebViewBridge(): boolean {
  try {
    const win = globalThis as Record<string, unknown>
    if (
      typeof win.webkit === 'object' &&
      win.webkit !== null &&
      typeof (win.webkit as Record<string, unknown>).messageHandlers ===
        'object'
    ) {
      return true
    }
    if (win.ReactNativeWebView != null) return true
  } catch {
    // Access to bridge objects may throw in sandboxed contexts
  }
  return false
}

export function isEmbeddedWebView(ua: string = navigator.userAgent): boolean {
  if (isSocialAppBrowser(ua)) return true
  if (isAndroidWebView(ua)) return true
  if (isIOSWebView(ua)) return true
  if (hasWebViewBridge()) return true
  return false
}
