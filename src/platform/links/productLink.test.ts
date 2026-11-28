import { describe, expect, it, vi } from 'vitest'

import { productLink } from '@/platform/links/productLink'

function utmOf(url: string) {
  const { searchParams } = new URL(url)
  return {
    source: searchParams.get('utm_source'),
    medium: searchParams.get('utm_medium'),
    campaign: searchParams.get('utm_campaign')
  }
}

describe('productLink', () => {
  it.for([
    { build: 'cloud', source: 'comfy_cloud' },
    { build: 'desktop', source: 'comfy_desktop' },
    { build: 'localhost', source: 'comfyui_local' }
  ] as const)(
    'names $source as the source in the $build build',
    ({ build, source }) => {
      vi.stubGlobal('__DISTRIBUTION__', build)

      expect(
        utmOf(productLink('https://docs.comfy.org/changelog', 'help_center'))
      ).toEqual({ source, medium: 'product', campaign: 'help_center' })
    }
  )

  it('keeps the path, other parameters and the hash', () => {
    expect(
      productLink(
        'https://comfy.org/cloud/?template=wan&utm_id=modal#plans',
        'pricing_table'
      )
    ).toBe(
      'https://comfy.org/cloud/?template=wan&utm_id=modal&utm_source=comfyui_local&utm_medium=product&utm_campaign=pricing_table#plans'
    )
  })

  it('replaces UTM parameters the link already had', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')

    expect(
      utmOf(
        productLink(
          'https://comfy.org/?utm_source=desktop&utm_medium=modal&utm_campaign=old',
          'cloud_notification'
        )
      )
    ).toEqual({
      source: 'comfy_cloud',
      medium: 'product',
      campaign: 'cloud_notification'
    })
  })

  it.for([
    'https://github.com/Comfy-Org/ComfyUI',
    'https://notcomfy.org/page',
    'https://comfy.org.evil.com/page'
  ])('leaves %s unchanged', (url) => {
    expect(productLink(url, 'help_center')).toBe(url)
  })
})
