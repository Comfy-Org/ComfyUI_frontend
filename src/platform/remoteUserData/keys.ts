/**
 * PostHog feature-flag keys whose JSON payloads are exposed via
 * {@link useRemoteUserData}. The cloud provider only collects payloads for keys
 * listed here.
 */
export const REMOTE_USER_DATA_KEYS = ['app-mode-template-order'] as const

export type RemoteUserDataKey = (typeof REMOTE_USER_DATA_KEYS)[number]
