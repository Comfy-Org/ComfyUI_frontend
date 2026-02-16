import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import { isPreviewPseudoWidget } from './proxyWidgetUtils'

function widget(
  overrides: Partial<
    Pick<IBaseWidget, 'name' | 'serialize' | 'type' | 'options'>
  >
): IBaseWidget {
  return { name: 'widget', ...overrides } as unknown as IBaseWidget
}

describe('isPreviewPseudoWidget', () => {
  it('returns true for $$-prefixed widget names', () => {
    expect(
      isPreviewPseudoWidget(widget({ name: '$$canvas-image-preview' }))
    ).toBe(true)
    expect(isPreviewPseudoWidget(widget({ name: '$$anything' }))).toBe(true)
  })

  it('returns true for serialize:false with type "preview"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'videopreview', serialize: false, type: 'preview' })
      )
    ).toBe(true)
  })

  it('returns true for options.serialize:false with type "preview" (VHS pattern)', () => {
    expect(
      isPreviewPseudoWidget(
        widget({
          name: 'videopreview',
          type: 'preview',
          options: { serialize: false }
        })
      )
    ).toBe(true)
  })

  it('returns true for serialize:false with type "video"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'vid', serialize: false, type: 'video' })
      )
    ).toBe(true)
  })

  it('returns true for serialize:false with type "audioUI"', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'audio', serialize: false, type: 'audioUI' })
      )
    ).toBe(true)
  })

  it('returns false for type "preview" when serialize is not false', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'videopreview', serialize: true, type: 'preview' })
      )
    ).toBe(false)
  })

  it('returns false for regular widgets', () => {
    expect(
      isPreviewPseudoWidget(widget({ name: 'seed', type: 'number' }))
    ).toBe(false)
  })

  it('returns false for serialize:false with unknown type', () => {
    expect(
      isPreviewPseudoWidget(
        widget({ name: 'text', serialize: false, type: 'customtext' })
      )
    ).toBe(false)
  })
})
