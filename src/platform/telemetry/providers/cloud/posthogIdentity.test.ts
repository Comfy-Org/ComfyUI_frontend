import type { PostHog } from 'posthog-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  identifyPostHogUser,
  setPostHogIdentityClient
} from './posthogIdentity'

describe('posthogIdentity', () => {
  beforeEach(() => {
    setPostHogIdentityClient(null)
  })

  afterEach(() => {
    setPostHogIdentityClient(null)
  })

  it('queues identify calls until the PostHog client is ready', () => {
    identifyPostHogUser('user-123')

    const posthog = {
      identify: vi.fn()
    } as unknown as PostHog
    setPostHogIdentityClient(posthog)

    expect(posthog.identify).toHaveBeenCalledWith('user-123')
  })

  it('identifies immediately when the PostHog client is ready', () => {
    const posthog = {
      identify: vi.fn()
    } as unknown as PostHog
    setPostHogIdentityClient(posthog)

    identifyPostHogUser('user-123')

    expect(posthog.identify).toHaveBeenCalledWith('user-123')
  })
})
