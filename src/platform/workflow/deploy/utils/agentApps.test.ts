// @vitest-environment-options {"happyDOM":{"settings":{"disableIframePageLoading":false}}}
import { describe, expect, it, vi } from 'vitest'

import { openAgentApp } from './agentApps'

function recordFrameNavigations() {
  const navigations: { url: string; hidden: boolean }[] = []
  vi.spyOn(HTMLIFrameElement.prototype, 'src', 'set').mockImplementation(
    function (this: HTMLIFrameElement, url: string) {
      navigations.push({ url, hidden: this.hidden && this.isConnected })
    }
  )
  return navigations
}

describe('openAgentApp', () => {
  it.for([
    { app: 'claude', url: 'claude://code/new?q=a%20b%0Ac%26d%3D1%23e' },
    { app: 'chatGpt', url: 'codex://new?prompt=a%20b%0Ac%26d%3D1%23e' }
  ] as const)(
    'hands the whole prompt, encoded, to the $app app from a hidden frame',
    ({ app, url }) => {
      const navigations = recordFrameNavigations()

      openAgentApp(app, 'a b\nc&d=1#e')

      expect(navigations).toEqual([{ url, hidden: true }])
    }
  )

  it('replaces a lone surrogate instead of throwing, and keeps a pair whole', () => {
    const navigations = recordFrameNavigations()

    openAgentApp('chatGpt', '\uD800 build \uDC00 🙂')

    expect(navigations.map(({ url }) => url)).toEqual([
      'codex://new?prompt=%EF%BF%BD%20build%20%EF%BF%BD%20%F0%9F%99%82'
    ])
  })

  it('reuses one frame for every launch', () => {
    const navigations = recordFrameNavigations()

    openAgentApp('claude', 'first')
    openAgentApp('chatGpt', 'second')

    expect(navigations.map(({ url }) => url)).toEqual([
      'claude://code/new?q=first',
      'codex://new?prompt=second'
    ])
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
  })
})
