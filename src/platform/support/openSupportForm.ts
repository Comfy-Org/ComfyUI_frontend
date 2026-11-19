import { useCurrentUserAccess } from '@/platform/auth/currentUserAccess'
import type { SupportForm } from '@/platform/support/config'
import { buildSupportUrl } from '@/platform/support/config'

/** Opens a support form in a new tab, pre-filled with the signed-in user's details. */
export function openSupportForm(form: SupportForm): void {
  const { userEmail, resolvedUserInfo } = useCurrentUserAccess()
  const url = buildSupportUrl(form, {
    email: userEmail.value,
    userId: resolvedUserInfo.value?.id
  })
  window.open(url, '_blank', 'noopener,noreferrer')
}
