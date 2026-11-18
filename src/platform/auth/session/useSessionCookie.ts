import { useCurrentUserAccess } from '@/platform/auth/currentUserAccess'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { isCloud } from '@/platform/distribution/types'

/** The Cloud session cookie, served by the shared web session. */
export const useSessionCookie = () => {
  const isApiKeyLogin = () => useCurrentUserAccess().isApiKeyLogin.value

  const startedWebSession = () => {
    const webSession = useCloudWebSessionStore()
    webSession.start()
    return webSession
  }

  const ensureSessionCookie = async (): Promise<void> => {
    if (!isCloud || isApiKeyLogin()) return
    return startedWebSession().whenReady()
  }

  const createSession = async (): Promise<void> => {
    if (!isCloud || isApiKeyLogin()) return
    startedWebSession()
  }

  /** After an interactive sign-in: whether ingest refused its session for SSO. */
  const sessionRequiresSso = async (): Promise<boolean> => {
    if (!isCloud || isApiKeyLogin()) return false
    return (await startedWebSession().whenSessionCreated()) === 'SSO_REQUIRED'
  }

  const createSessionOrThrow = async (): Promise<void> => {
    if (!isCloud) return
    return startedWebSession().whenReady()
  }

  return {
    createSession,
    createSessionOrThrow,
    sessionRequiresSso,
    ensureSessionCookie
  }
}
