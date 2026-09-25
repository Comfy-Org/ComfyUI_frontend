import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import MediaLightboxItem from '@/components/common/MediaLightboxItem.vue'
import type { LightboxItem } from '@/types/lightboxItem'

const renderStub = (name: string) => ({
  name,
  props: ['url', 'mimeType', 'advancedPreviewUrl', 'content', 'src', 'alt'],
  template: `<div data-testid="${name}" />`
})

function renderItem(item: LightboxItem) {
  return render(MediaLightboxItem, {
    props: { item },
    global: {
      stubs: {
        ComfyImage: renderStub('ComfyImage'),
        LightboxVideo: renderStub('LightboxVideo'),
        LightboxAudio: renderStub('LightboxAudio'),
        LightboxText: renderStub('LightboxText')
      }
    }
  })
}

const RENDERERS = [
  'ComfyImage',
  'LightboxVideo',
  'LightboxAudio',
  'LightboxText'
] as const

describe('MediaLightboxItem', () => {
  it.for([
    [{ kind: 'image', url: '/a.png', alt: 'a' }, 'ComfyImage'],
    [{ kind: 'video', url: '/a.mp4', mimeType: 'video/mp4' }, 'LightboxVideo'],
    [{ kind: 'audio', url: '/a.mp3' }, 'LightboxAudio'],
    [{ kind: 'text', url: '/a.txt' }, 'LightboxText']
  ] as const satisfies readonly (readonly [
    LightboxItem,
    (typeof RENDERERS)[number]
  ])[])('routes a %o item to its renderer alone', ([item, expected]) => {
    renderItem(item)

    const rendered = RENDERERS.filter(
      (name) => screen.queryByTestId(name) !== null
    )

    expect(rendered).toEqual([expected])
  })
})
