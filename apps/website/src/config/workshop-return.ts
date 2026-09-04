/**
 * Where a visitor may be sent back to after sign-in or a purchase. Only a
 * same-origin absolute path qualifies — anything else ('//evil.com',
 * 'https://…', 'javascript:…', a backslash variant browsers normalize into
 * '//') is an open redirect and falls back to the Workshop home. Mirrors the
 * platform app's previousFullPath guard.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (
    typeof raw === 'string' &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.startsWith('/\\')
  ) {
    return raw
  }
  return '/workshop/'
}
