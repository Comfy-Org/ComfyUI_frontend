import { expect, it, vi } from 'vitest'

import { isLocalDesktopHost } from './agentHost'

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: __DISTRIBUTION__,
  isNightly: false,
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

it.for([
  {
    host: 'Electron Desktop',
    cloud: false,
    desktop: true,
    bridge: undefined,
    legacyRemote: undefined,
    local: true
  },
  {
    host: 'ordinary browser',
    cloud: false,
    desktop: false,
    bridge: undefined,
    legacyRemote: undefined,
    local: false
  },
  {
    host: 'browser with only a legacy local flag',
    cloud: false,
    desktop: false,
    bridge: undefined,
    legacyRemote: false,
    local: false
  },
  {
    host: 'modern local Desktop 2 overriding the legacy remote flag',
    cloud: false,
    desktop: false,
    bridge: { isRemote: () => false },
    legacyRemote: true,
    local: true
  },
  {
    host: 'modern remote Desktop 2 overriding the legacy local flag',
    cloud: false,
    desktop: false,
    bridge: { isRemote: () => true },
    legacyRemote: false,
    local: false
  },
  {
    host: 'legacy local Desktop 2 with no remote flag',
    cloud: false,
    desktop: false,
    bridge: {},
    legacyRemote: undefined,
    local: true
  },
  {
    host: 'legacy local Desktop 2 with an explicit local flag',
    cloud: false,
    desktop: false,
    bridge: {},
    legacyRemote: false,
    local: true
  },
  {
    host: 'legacy remote Desktop 2',
    cloud: false,
    desktop: false,
    bridge: {},
    legacyRemote: true,
    local: false
  },
  {
    host: 'Cloud with an Electron marker',
    cloud: true,
    desktop: true,
    bridge: undefined,
    legacyRemote: undefined,
    local: false
  },
  {
    host: 'Cloud with a modern local Desktop 2 bridge',
    cloud: true,
    desktop: false,
    bridge: { isRemote: () => false },
    legacyRemote: undefined,
    local: false
  },
  {
    host: 'Cloud with a legacy local Desktop 2 bridge',
    cloud: true,
    desktop: false,
    bridge: {},
    legacyRemote: undefined,
    local: false
  }
])(
  'classifies $host for local Desktop consent',
  ({ cloud, desktop, bridge, legacyRemote, local }) => {
    distribution.isCloud = cloud
    distribution.isDesktop = desktop
    vi.stubGlobal('__comfyDesktop2', bridge)
    vi.stubGlobal('__comfyDesktop2Remote', legacyRemote)

    expect(isLocalDesktopHost()).toBe(local)
  }
)
