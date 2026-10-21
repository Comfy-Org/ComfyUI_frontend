// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import type { HubCreator } from '@/lib/hub/creators'
import CreatorProfileHeader from './CreatorProfileHeader.vue'

const creator: HubCreator = {
  username: 'purz',
  displayName: 'Purz <b>bold</b>',
  description: 'Live <script>alert(1)</script> host',
  websiteUrls: ['https://www.purz.xyz/about']
}

const render = (locale: 'en' | 'ja' = 'en') =>
  renderToString(
    createSSRApp({
      render: () => h(CreatorProfileHeader, { creator, locale })
    })
  )

describe('CreatorProfileHeader on the server', () => {
  it('escapes the name and bio the profile supplies', async () => {
    const html = await render()

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>bold</b>')
    expect(html).toContain('Live &lt;script&gt;alert(1)&lt;/script&gt; host')
    expect(html).toContain('@purz')
  })

  it('opens a website link in a new tab with no opener, referrer or ranking credit', async () => {
    const html = await render()

    expect(html).toMatch(
      /<a href="https:\/\/www\.purz\.xyz\/about" target="_blank" rel="noopener noreferrer nofollow ugc"[^>]*>purz\.xyz/
    )
  })

  it('labels the profile in the page locale', async () => {
    expect(await render('ja')).toContain('クリエイター')
  })
})
