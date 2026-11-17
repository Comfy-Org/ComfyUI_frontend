import { getCurrentAuthUser } from '@/platform/auth/authStoreAccess'
import {
  desktopHostUser,
  isDesktopHostSessionActive
} from '@/platform/auth/desktopHost/desktopHostSession'
import { webSessionUser } from '@/platform/auth/session/webSessionUser'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'

export function hasLocalAgentEmployeeAccess(): boolean {
  return pendingServerFact('BE-26582', isEmployeeSignedIn()) === true
}

function isEmployeeSignedIn(): boolean {
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
