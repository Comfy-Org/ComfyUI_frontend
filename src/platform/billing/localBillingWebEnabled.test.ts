import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import {
  opensLocalBillingHandoff,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isNightly: false,
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

type Host = 'none' | 'signed_out' | 'signed_in'

async function startHost(host: Host, handoffBridge: boolean) {
  if (host === 'none') return
  const state: DesktopHostAuthState =
    host === 'signed_in'
      ? { status: 'signed_in', userId: 'user-1', workspaceId: 'ws-1' }
      : { status: 'signed_out' }
  const bridge: DesktopHostAuthBridge = {
    getState: async () => state,
    getWorkspaceToken: async () => 'token-ws-1',
    requestSignIn: async () => state,
    signOut: async () => ({ status: 'signed_out' }),
    onChanged: () => () => {},
    ...(handoffBridge && {
      issueBillingHandoff: async () => ({ status: 'disabled' as const })
    })
  }
  await startDesktopHostSession(bridge)
}

describe('opensLocalBillingHandoff', () => {
  beforeEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
  })

  afterEach(() => {
    stopDesktopHostSession()
    setLocalBillingWebEnabled(false)
  })

  it.for<{
    name: string
    flag: boolean
    isCloud?: boolean
    isDesktop?: boolean
    host?: Host
    bridge?: boolean
    expected: boolean
  }>([
    { name: 'local web, flag on', flag: true, expected: true },
    { name: 'local web, flag off', flag: false, expected: false },
    {
      name: 'Cloud, flag on',
      flag: true,
      isCloud: true,
      expected: false
    },
    {
      name: 'Cloud inside Desktop with the handoff bridge, flag on',
      flag: true,
      isCloud: true,
      isDesktop: true,
      host: 'signed_in',
      bridge: true,
      expected: false
    },
    {
      name: 'Desktop signed in with the handoff bridge, flag on',
      flag: true,
      isDesktop: true,
      host: 'signed_in',
      bridge: true,
      expected: true
    },
    {
      name: 'Desktop signed in with the handoff bridge, flag off',
      flag: false,
      isDesktop: true,
      host: 'signed_in',
      bridge: true,
      expected: false
    },
    {
      name: 'Desktop signed in without the handoff bridge, flag on',
      flag: true,
      isDesktop: true,
      host: 'signed_in',
      expected: false
    },
    {
      name: 'Desktop signed out with the handoff bridge, flag on',
      flag: true,
      isDesktop: true,
      host: 'signed_out',
      bridge: true,
      expected: false
    },
    {
      name: 'Desktop that shares no session, flag on',
      flag: true,
      isDesktop: true,
      expected: false
    }
  ])(
    'is $expected on $name',
    async ({
      flag,
      isCloud = false,
      isDesktop = false,
      host = 'none',
      bridge = false,
      expected
    }) => {
      Object.assign(distribution, { isCloud, isDesktop })
      await startHost(host, bridge)
      setLocalBillingWebEnabled(flag)

      expect(opensLocalBillingHandoff()).toBe(expected)
    }
  )
})
