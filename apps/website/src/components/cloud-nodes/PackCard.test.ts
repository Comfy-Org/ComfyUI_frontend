// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { GridPack } from '../../data/cloudNodes'
import PackCard from './PackCard.vue'

const pack: GridPack = {
  id: 'comfyui-kjnodes',
  displayName: 'KJNodes',
  description: 'A pack of utility nodes.',
  bannerUrl: 'https://media.comfy.org/banner.webp',
  iconUrl: 'https://media.comfy.org/icon.webp',
  repoUrl: 'https://github.com/kijai/ComfyUI-KJNodes',
  downloads: 1200,
  lastUpdated: '2026-01-01',
  nodes: [{ name: 'a', displayName: 'A', category: 'util' }]
}

const detailHref = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
    .find((href) => href?.includes('supported-nodes'))

describe('PackCard', () => {
  it('links to the unprefixed detail page for English', () => {
    render(PackCard, { props: { pack } })

    expect(detailHref()).toBe('/cloud/supported-nodes/comfyui-kjnodes/')
  })

  it('keeps a Chinese reader in their locale', () => {
    render(PackCard, { props: { pack, locale: 'zh-CN' } })

    expect(detailHref()).toBe('/zh-CN/cloud/supported-nodes/comfyui-kjnodes/')
  })

  /**
   * Japanese publishes six routes and this is not one of them, so the prefixed
   * URL would be a page held back from indexing. `localizeHref` answers that by
   * leaving the path English.
   */
  it('sends a Japanese reader to the page that is actually published', () => {
    render(PackCard, { props: { pack, locale: 'ja' } })

    expect(detailHref()).toBe('/cloud/supported-nodes/comfyui-kjnodes/')
  })

  /**
   * The card is rendered from a `v-for`, so Vue reuses one instance for
   * whichever pack occupies that slot. A href read once at setup keeps the
   * first pack's link under the second pack's name — the same defect
   * `StoryCard` carried, and invisible in the markup because every other field
   * is correct.
   */
  it('follows the pack it is given when reused for another one', async () => {
    const { rerender } = render(PackCard, { props: { pack } })

    await rerender({ pack: { ...pack, id: 'comfyui-essentials' } })

    expect(detailHref()).toBe('/cloud/supported-nodes/comfyui-essentials/')
  })
})
