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
 *   • `window.ReactNativeWebView` — unconditional; no shipping browser
 *     exposes this.
 *   • `window.webkit.messageHandlers` — UA-gated, because iOS forces
 *     every browser (Chrome, Firefox, Edge, Opera, Safari itself) onto
 *     WKWebView, and modern iOS Chrome exposes this global for its own
 *     internal native bridge. Treating it as a webview signal in
 *     first-party iOS browsers is a false positive that hides the Google
 *     SSO button for regular mobile users.
 */

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
  if (!/iPhone|iPad|iPod|Macintosh.*Mobile\//i.test(ua)) return false
  if (IOS_FIRST_PARTY_BROWSER_PATTERNS.test(ua)) return true
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

/**
 * Reason why Google SSO is blocked in the current environment, or `null` if it
 * is available. Modeled as a discriminated string so call sites read as
 * "if blocked, here's why" rather than an opaque boolean. Extend this union
 * (e.g. `'unauthorized-host'`) as new blocking conditions are detected.
 */
type GoogleSsoBlockedReason = 'embedded-webview' | null

export function getGoogleSsoBlockedReason(
  ua: string = navigator.userAgent
): GoogleSsoBlockedReason {
  if (isEmbeddedWebView(ua)) return 'embedded-webview'
  return null
}
