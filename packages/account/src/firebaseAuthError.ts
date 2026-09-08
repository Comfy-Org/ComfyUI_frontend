/**
 * Classification of Firebase Auth failures, shared so both hosts branch on
 * the same buckets. Typed structurally rather than via `instanceof
 * FirebaseError` so this package needs no firebase dependency — a host passes
 * whatever it caught and unknown shapes land in 'unknown'.
 */

export interface FirebaseAuthErrorLike {
  code: string
  message: string
}

/**
 * The user or their browser dismissed/blocked the popup — an outcome to warn
 * about and retry on a fresh gesture, never an app fault.
 */
const POPUP_DISMISSED_CODES: readonly string[] = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/popup-blocked'
]

/**
 * The origin is not on the Firebase authorized-domains list (or a continue
 * URI is unauthorized): auth cannot work here at all until configuration
 * changes, so the host should say so rather than offer a retry.
 */
const UNAUTHORIZED_DOMAIN_CODES: readonly string[] = [
  'auth/unauthorized-domain',
  'auth/invalid-dynamic-link-domain',
  'auth/unauthorized-continue-uri'
]

export type AuthErrorClassification =
  | { kind: 'unauthorized-domain'; code: string }
  | { kind: 'signup-blocked'; code: string }
  | { kind: 'popup-dismissed'; code: string }
  | { kind: 'auth'; code: string }
  | { kind: 'unknown' }

export function isFirebaseAuthErrorLike(
  error: unknown
): error is FirebaseAuthErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('auth/') &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

export function classifyAuthError(error: unknown): AuthErrorClassification {
  if (!isFirebaseAuthErrorLike(error)) return { kind: 'unknown' }
  if (UNAUTHORIZED_DOMAIN_CODES.includes(error.code)) {
    return { kind: 'unauthorized-domain', code: error.code }
  }
  // Match on `error.message`, not `error.code`: Firebase `beforeUserCreated`
  // rejections collapse the thrown code into a generic `auth/internal-error`,
  // so the message is the only reliable channel. `signup_blocked` is a
  // cross-repo contract token; matched case-insensitively.
  if (error.message.toLowerCase().includes('signup_blocked')) {
    return { kind: 'signup-blocked', code: error.code }
  }
  if (POPUP_DISMISSED_CODES.includes(error.code)) {
    return { kind: 'popup-dismissed', code: error.code }
  }
  return { kind: 'auth', code: error.code }
}

/**
 * English source copy for auth failures, extracted verbatim from the cloud
 * app's shipped strings (src/locales/en/main.json, auth.errors.*) so hosts
 * never invent independently worded copy for the same failure. Keyed by the
 * Firebase code, plus the two named fallbacks. `AUTH_ERROR_COPY` carries the
 * same table per shipped locale; `authErrorMessage` resolves one failure.
 */
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled':
    'This account has been disabled. Please contact support.',
  'auth/user-not-found':
    'No account found with this email. Would you like to create a new account?',
  'auth/wrong-password':
    'The password you entered is incorrect. Please try again.',
  'auth/email-already-in-use':
    'An account with this email already exists. Try signing in instead.',
  'auth/weak-password':
    'Password is too weak. Please use a stronger password with at least 6 characters.',
  'auth/too-many-requests':
    'Too many login attempts. Please wait a moment and try again.',
  'auth/operation-not-allowed':
    'This sign-in method is not currently supported.',
  'auth/invalid-credential':
    'Invalid login credentials. Please check your email and password.',
  'auth/network-request-failed':
    'Network error. Please check your connection and try again.',
  'auth/popup-closed-by-user':
    'The sign-in window closed before sign-in finished. Please try again.',
  'auth/cancelled-popup-request':
    'Another sign-in window was already open, so this one was cancelled. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in window. Please allow pop-ups for this site and try again.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email address but uses a different sign-in method. Please sign in the way you did originally.',
  generic: 'Something went wrong while signing you in. Please try again.',
  signupBlocked:
    "We couldn't create your account right now. Please try again later. If this keeps happening, email support@comfy.org."
}

export type AuthToastSeverity = 'error' | 'warn'

/**
 * The cloud app's toast-severity policy for classified auth failures: a
 * dismissed popup is the user changing their mind, not an application
 * error; everything else alarms.
 */
export function severityForAuthError(
  classification: AuthErrorClassification
): AuthToastSeverity {
  return classification.kind === 'popup-dismissed' ? 'warn' : 'error'
}

/** The locales both hosts ship auth copy for; each table mirrors src/locales/<locale>/main.json. */
export type AuthCopyLocale = 'en' | 'zh-CN' | 'ja'

export const AUTH_ERROR_COPY: Readonly<
  Record<AuthCopyLocale, Readonly<Record<string, string>>>
> = {
  en: AUTH_ERROR_MESSAGES,
  'zh-CN': {
    'auth/invalid-email': '请输入有效的电子邮件地址。',
    'auth/user-disabled': '此账户已被禁用。请联系客服。',
    'auth/user-not-found':
      '未找到使用此电子邮件的账户。您想要创建一个新账户吗？',
    'auth/wrong-password': '您输入的密码不正确，请重试。',
    'auth/email-already-in-use': '已存在使用此电子邮件的账户。请尝试登录。',
    'auth/weak-password': '密码强度太弱。请使用至少6个字符的更强密码。',
    'auth/too-many-requests': '登录尝试次数过多。请稍等片刻再试。',
    'auth/operation-not-allowed': '此登录方法目前不受支持。',
    'auth/invalid-credential': '登录凭据无效。请检查您的邮箱和密码。',
    'auth/network-request-failed': '网络错误。请检查您的连接并重试。',
    'auth/popup-closed-by-user': '登录完成前登录窗口已关闭。请重试。',
    'auth/cancelled-popup-request':
      '另一个登录窗口已打开，因此此窗口已取消。请重试。',
    'auth/popup-blocked':
      '您的浏览器阻止了登录窗口。请允许此网站的弹出窗口后重试。',
    'auth/account-exists-with-different-credential':
      '已存在使用此电子邮件地址的账户，但其使用了其他登录方式。请使用您最初的登录方式登录。',
    generic: '登录时出现问题，请重试。',
    signupBlocked:
      '我们目前无法创建您的账户。请稍后再试。如果问题持续，请发送邮件至 support@comfy.org。'
  },
  ja: {
    'auth/invalid-email': '有効なメールアドレスを入力してください。',
    'auth/user-disabled':
      'このアカウントは無効化されています。サポートまでご連絡ください。',
    'auth/user-not-found':
      'このメールアドレスに紐づくアカウントが見つかりません。新しいアカウントを作成しますか？',
    'auth/wrong-password':
      '入力されたパスワードが正しくありません。もう一度お試しください。',
    'auth/email-already-in-use':
      'このメールアドレスのアカウントは既に存在します。代わりにサインインをお試しください。',
    'auth/weak-password':
      'パスワードが弱すぎます。6文字以上のより強力なパスワードを使用してください。',
    'auth/too-many-requests':
      'ログイン試行回数が多すぎます。しばらく待ってからもう一度お試しください。',
    'auth/operation-not-allowed':
      'このサインイン方法は現在サポートされていません。',
    'auth/invalid-credential':
      'ログイン認証情報が無効です。メールアドレスとパスワードを確認してください。',
    'auth/network-request-failed':
      'ネットワークエラー。接続を確認してからもう一度お試しください。',
    'auth/popup-closed-by-user':
      'サインインが完了する前にサインインウィンドウが閉じられました。もう一度お試しください。',
    'auth/cancelled-popup-request':
      '別のサインインウィンドウがすでに開いていたため、このリクエストはキャンセルされました。もう一度お試しください。',
    'auth/popup-blocked':
      'ブラウザによってサインインウィンドウがブロックされました。このサイトのポップアップを許可して、もう一度お試しください。',
    'auth/account-exists-with-different-credential':
      'このメールアドレスのアカウントはすでに存在しますが、別のサインイン方法を使用しています。最初に使用した方法でサインインしてください。',
    generic: 'サインイン中に問題が発生しました。もう一度お試しください。',
    signupBlocked:
      '現在アカウントを作成できません。しばらくしてから再度お試しください。繰り返し発生する場合は support@comfy.org までご連絡ください。'
  }
}

/** toastMessages.unauthorizedDomain; `{domain}` and `{email}` are the host's own values. */
export const UNAUTHORIZED_DOMAIN_MESSAGES: Readonly<
  Record<AuthCopyLocale, string>
> = {
  en: 'Your domain {domain} is not authorized to use this service. Please contact {email} to add your domain to the whitelist.',
  'zh-CN':
    '您的域名 {domain} 未被授权使用此服务。请联系 {email} 将您的域名添加到白名单。',
  ja: 'あなたのドメイン {domain} はこのサービスを利用する権限がありません。ご利用のドメインをホワイトリストに追加するには、{email} までご連絡ください。'
}

/** g.error / g.warning: the summaries the cloud app's auth toasts carry. */
export const AUTH_TOAST_SUMMARIES: Readonly<
  Record<AuthCopyLocale, Readonly<Record<AuthToastSeverity, string>>>
> = {
  en: { error: 'Error', warn: 'Warning' },
  'zh-CN': { error: '错误', warn: '警告' },
  ja: { error: 'エラー', warn: '警告' }
}

export function unauthorizedDomainMessage(
  values: { domain: string; email: string },
  locale: AuthCopyLocale = 'en'
): string {
  return UNAUTHORIZED_DOMAIN_MESSAGES[locale]
    .replace('{domain}', values.domain)
    .replace('{email}', values.email)
}

/**
 * The detail copy for a classified failure, the way useAuthActions resolves
 * it: a code the table knows gets its own line, anything else the generic
 * line, a blocked sign-up its named copy. Unauthorized domains need the
 * host's domain and support address, so hosts call
 * `unauthorizedDomainMessage` for that kind.
 */
export function authErrorMessage(
  classification: AuthErrorClassification,
  locale: AuthCopyLocale = 'en'
): string {
  const copy = AUTH_ERROR_COPY[locale]
  switch (classification.kind) {
    case 'signup-blocked':
      return copy.signupBlocked
    case 'popup-dismissed':
    case 'auth':
      return copy[classification.code] ?? copy.generic
    case 'unauthorized-domain':
    case 'unknown':
      return copy.generic
  }
}
