import { describe, expect, it } from 'vitest'

import {
  parsePersistedAgentPanelSize,
  serializeAgentPanelSize,
  shouldRestoreFullscreen
} from './agentPanelSize'
import type { StartupSizeInput } from './agentPanelSize'

describe('persisted agent panel size', () => {
  it('stores full screen together with the user who chose it', () => {
    const raw = serializeAgentPanelSize({ mode: 'fullscreen' }, 'user-a')

    expect(parsePersistedAgentPanelSize(raw)).toEqual({
      mode: 'fullscreen',
      owner: 'user-a'
    })
  })

  it.for([
    { size: { mode: 'docked' }, owner: 'user-a' },
    { size: { mode: 'wide' }, owner: 'user-a' },
    { size: { mode: 'fullscreen' }, owner: undefined },
    { size: { mode: 'fullscreen' }, owner: '' }
  ] as const)(
    'stores nothing for $size.mode owned by $owner',
    ({ size, owner }) => {
      expect(serializeAgentPanelSize(size, owner)).toBeNull()
    }
  )

  it.for([
    null,
    '',
    'not json',
    'null',
    '"fullscreen"',
    '{"mode":"wide","owner":"user-a"}',
    '{"mode":"fullscreen"}',
    '{"mode":"fullscreen","owner":""}',
    '{"mode":"fullscreen","owner":7}'
  ])('reads %j as no stored preference', (raw) => {
    expect(parsePersistedAgentPanelSize(raw)).toBeNull()
  })
})

describe('shouldRestoreFullscreen', () => {
  const restorable: StartupSizeInput = {
    persisted: { mode: 'fullscreen', owner: 'user-a' },
    userId: 'user-a',
    redesign: true,
    panelVisible: true,
    startupDecided: true,
    screenHeld: false,
    urlClaimsGraph: false
  }

  it('restores full screen for the user who left it on', () => {
    expect(shouldRestoreFullscreen(restorable)).toBe(true)
  })

  it.for([
    { name: 'nothing was stored', change: { persisted: null } },
    { name: 'another user is signed in', change: { userId: 'user-b' } },
    { name: 'no user is resolved', change: { userId: undefined } },
    { name: 'the redesign is off', change: { redesign: false } },
    { name: 'the panel is not on screen', change: { panelVisible: false } },
    { name: 'startup was not decided', change: { startupDecided: false } },
    { name: 'a tour or dialog holds the screen', change: { screenHeld: true } },
    {
      name: 'the URL opens something on the graph',
      change: { urlClaimsGraph: true }
    }
  ] satisfies { name: string; change: Partial<StartupSizeInput> }[])(
    'starts docked when $name',
    ({ change }) => {
      expect(shouldRestoreFullscreen({ ...restorable, ...change })).toBe(false)
    }
  )
})
