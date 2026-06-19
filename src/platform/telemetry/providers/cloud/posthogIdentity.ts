import type { PostHog } from 'posthog-js'

let posthogClient: PostHog | null = null
const pendingUserIds = new Set<string>()

function tryIdentify(userId: string): void {
  if (!posthogClient) {
    pendingUserIds.add(userId)
    return
  }

  try {
    posthogClient.identify(userId)
  } catch (error) {
    console.error('Failed to identify PostHog user:', error)
  }
}

export function setPostHogIdentityClient(client: PostHog | null): void {
  posthogClient = client
  if (!client) {
    pendingUserIds.clear()
    return
  }

  const queuedUserIds = Array.from(pendingUserIds)
  pendingUserIds.clear()
  for (const userId of queuedUserIds) {
    tryIdentify(userId)
  }
}

export function identifyPostHogUser(userId: string | null | undefined): void {
  if (!userId) return
  tryIdentify(userId)
}
