import { describe, expect, it, vi } from 'vitest'

import { takeLeavePromptSkip } from '@/platform/workflow/management/leavePrompt'

import { openAgentApp } from './agentApps'

function recordPageNavigations() {
  const navigations: { url: string; leavePromptSkipped: boolean }[] = []
  vi.stubGlobal('location', {
    assign: vi.fn((url: string) => {
      navigations.push({ url, leavePromptSkipped: takeLeavePromptSkip() })
    })
  })
  return navigations
}

describe('openAgentApp', () => {
  it.for([
    { app: 'claude', url: 'claude://code/new?q=a%20b%0Ac%26d%3D1%23e' },
    { app: 'codex', url: 'codex://new?prompt=a%20b%0Ac%26d%3D1%23e' }
  ] as const)(
    'opens the whole prompt, encoded, in the $app app by navigating the page',
    ({ app, url }) => {
      const navigations = recordPageNavigations()

      openAgentApp(app, 'a b\nc&d=1#e')

      expect(navigations).toEqual([{ url, leavePromptSkipped: true }])
    }
  )

  it('replaces a lone surrogate instead of throwing, and keeps a pair whole', () => {
    const navigations = recordPageNavigations()

    openAgentApp('codex', '\uD800 build \uDC00 🙂')

    expect(navigations.map(({ url }) => url)).toEqual([
      'codex://new?prompt=%EF%BF%BD%20build%20%EF%BF%BD%20%F0%9F%99%82'
    ])
  })

  it('keeps the leave prompt for later unloads when the navigation runs no unload check', () => {
    vi.stubGlobal('location', { assign: vi.fn() })

    openAgentApp('claude', 'Deploy')

    expect(takeLeavePromptSkip()).toBe(false)
  })

  it('keeps the leave prompt for later unloads when the navigation throws', () => {
    vi.stubGlobal('location', {
      assign: vi.fn(() => {
        throw new DOMException('Navigation refused', 'SecurityError')
      })
    })

    expect(() => openAgentApp('claude', 'Deploy')).toThrow('Navigation refused')
    expect(takeLeavePromptSkip()).toBe(false)
  })
})
