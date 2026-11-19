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
  offersAutoTopUpAtLocalCheckout,
  opensLocalBillingHandoff,
  setLocalAutoTopUpAtCheckoutEnabled,
  setLocalBillingNewUxEnabled,
  setLocalBillingWebEnabled,
  showsCloudBillingNewUxOnLocal
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

describe('showsCloudBillingNewUxOnLocal', () => {
  beforeEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
  })

  afterEach(() => {
    stopDesktopHostSession()
    setLocalBillingWebEnabled(false)
    setLocalBillingNewUxEnabled(false)
  })

  it.for<{
    name: string
    handoffFlag: boolean
    newUx: boolean
    isCloud?: boolean
    isDesktop?: boolean
    expected: boolean
  }>([
    {
      name: 'local web with the handoff and the new UX on',
      handoffFlag: true,
      newUx: true,
      expected: true
    },
    {
      name: 'local web with the new UX on and the handoff off',
      handoffFlag: false,
      newUx: true,
      expected: false
    },
    {
      name: 'local web with the handoff on and the new UX off',
      handoffFlag: true,
      newUx: false,
      expected: false
    },
    {
      name: 'a Desktop that cannot issue a handoff, with both on',
      handoffFlag: true,
      newUx: true,
      isDesktop: true,
      expected: false
    },
    {
      name: 'Cloud with both on',
      handoffFlag: true,
      newUx: true,
      isCloud: true,
      expected: false
    }
  ])(
    'is $expected on $name',
    ({ handoffFlag, newUx, isCloud = false, isDesktop = false, expected }) => {
      Object.assign(distribution, { isCloud, isDesktop })
      setLocalBillingWebEnabled(handoffFlag)
      setLocalBillingNewUxEnabled(newUx)

      expect(showsCloudBillingNewUxOnLocal()).toBe(expected)
    }
  )
})

describe('offersAutoTopUpAtLocalCheckout', () => {
  beforeEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
  })

  afterEach(() => {
    stopDesktopHostSession()
    setLocalBillingWebEnabled(false)
    setLocalAutoTopUpAtCheckoutEnabled(false)
  })

  it.for<{
    name: string
    handoffFlag: boolean
    atCheckout: boolean
    isCloud?: boolean
    isDesktop?: boolean
    host?: Host
    expected: boolean
  }>([
    {
      name: 'local web with the handoff and auto top-up at checkout served',
      handoffFlag: true,
      atCheckout: true,
      expected: true
    },
    {
      name: 'local web with auto top-up at checkout not served',
      handoffFlag: true,
      atCheckout: false,
      expected: false
    },
    {
      name: 'local web with the handoff off',
      handoffFlag: false,
      atCheckout: true,
      expected: false
    },
    {
      name: 'Desktop, whose handoff bridge carries no auto top-up settings',
      handoffFlag: true,
      atCheckout: true,
      isDesktop: true,
      host: 'signed_in',
      expected: false
    },
    {
      name: 'Cloud',
      handoffFlag: true,
      atCheckout: true,
      isCloud: true,
      expected: false
    }
  ])(
    'is $expected on $name',
    async ({
      handoffFlag,
      atCheckout,
      isCloud = false,
      isDesktop = false,
      host = 'none',
      expected
    }) => {
      Object.assign(distribution, { isCloud, isDesktop })
      await startHost(host, true)
      setLocalBillingWebEnabled(handoffFlag)
      setLocalAutoTopUpAtCheckoutEnabled(atCheckout)

      expect(offersAutoTopUpAtLocalCheckout()).toBe(expected)
    }
  )
})
