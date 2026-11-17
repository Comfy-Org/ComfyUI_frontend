import { getCurrentAuthUser } from '@/platform/auth/authStoreAccess'
import {
  desktopHostUser,
  isDesktopHostSessionActive
} from '@/platform/auth/desktopHost/desktopHostSession'
import { webSessionUser } from '@/platform/auth/session/webSessionUser'

export function hasLocalAgentEmployeeAccess(): boolean {
  if (isDesktopHostSessionActive()) {
    return (
      desktopHostUser.value?.email?.toLowerCase().endsWith('@comfy.org') ===
      true
    )
  }

  const user = webSessionUser.value ?? getCurrentAuthUser()
  return (
    user?.emailVerified === true &&
    user.email?.toLowerCase().endsWith('@comfy.org') === true
  )
}
