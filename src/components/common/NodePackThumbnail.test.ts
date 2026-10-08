import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import { createNodePackThumbnail } from '@/platform/customNodes/utils/nodePackThumbnail'

import NodePackThumbnail from './NodePackThumbnail.vue'
import PackCardLayout from './PackCardLayout.vue'

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

describe('NodePackThumbnail', () => {
  it('uses the pack name as identity when no explicit identity is provided', async () => {
    const { rerender } = render(NodePackThumbnail, {
      props: { name: 'Image Tools' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img')).toHaveClass(
      createNodePackThumbnail('Image Tools').palette
    )
    await rerender({ name: 'Audio Tools' })
    expect(screen.getByRole('img')).toHaveClass(
      createNodePackThumbnail('Audio Tools').palette
    )
  })

  it('renders accessible vector artwork without a remote image', () => {
    render(NodePackThumbnail, {
      props: { name: 'ComfyUI-VideoHelperSuite' },
      global: { plugins: [i18n] }
    })
    const artwork = screen.getByRole('img', {
      name: 'Generated thumbnail for ComfyUI-VideoHelperSuite'
    })
    expect(artwork).toHaveAttribute('viewBox', '0 0 560 240')
    expect(screen.getByText('VHS')).toBeInTheDocument()
    expect(artwork.outerHTML).toMatch(/<g[^>]*aria-hidden="true"><svg/)
    expect(artwork.outerHTML).not.toMatch(/<(?:img|script|foreignObject)\b/)
  })

  it('gives each instance its own paint servers', () => {
    render(
      {
        components: { NodePackThumbnail },
        template:
          '<NodePackThumbnail name="Same" /><NodePackThumbnail name="Same" />'
      },
      { global: { plugins: [i18n] } }
    )
    const artworks = screen.getAllByRole('img')
    const ids = artworks.flatMap((artwork) =>
      Array.from(
        artwork.outerHTML.matchAll(/\bid="([^"]+)"/g),
        (match) => match[1]
      )
    )
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    for (const artwork of artworks) {
      for (const [, id] of artwork.outerHTML.matchAll(
        /fill="url\(#([^)]+)\)"/g
      )) {
        expect(artwork.outerHTML).toContain(`id="${id}"`)
      }
    }
  })

  it('reacts to a new name without recreating identity-derived colors', async () => {
    const { rerender } = render(NodePackThumbnail, {
      props: { name: 'Image Tools', identity: 'same-pack' },
      global: { plugins: [i18n] }
    })
    const classes = screen.getByRole('img').getAttribute('class')
    await rerender({ name: 'Audio Tools', identity: 'same-pack' })
    expect(screen.getByRole('img')).toHaveAttribute('class', classes)
    expect(screen.getByText('AT')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Generated thumbnail for Audio Tools'
    )
  })

  it('handles unnamed packs and escapes names supplied by a pack', () => {
    render(NodePackThumbnail, {
      props: { name: '' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img')).toHaveAccessibleName(en.g.defaultBanner)
    expect(screen.getByText('CN')).toBeInTheDocument()
    render(NodePackThumbnail, {
      props: { name: '<img src=x onerror=alert(1)>' },
      global: { plugins: [i18n] }
    })
    const artwork = screen.getByRole('img', {
      name: 'Generated thumbnail for <img src=x onerror=alert(1)>'
    })
    expect(artwork.tagName.toLowerCase()).toBe('svg')
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(artwork).not.toHaveAttribute('onerror')
  })
})

describe('PackCardLayout artwork', () => {
  it('generates a thumbnail for Cloud and uploaded pack cards by default', () => {
    render(PackCardLayout, {
      props: { name: 'Custom Pack' },
      global: { plugins: [i18n] }
    })
    expect(
      screen.getByRole('img', { name: 'Generated thumbnail for Custom Pack' })
    ).toBeInTheDocument()
  })

  it('preserves explicitly supplied artwork', () => {
    render(PackCardLayout, {
      props: { name: 'Custom Pack' },
      slots: { banner: '<img src="/existing.png" alt="Existing artwork" />' },
      global: { plugins: [i18n] }
    })
    expect(screen.getByRole('img')).toHaveAccessibleName('Existing artwork')
    expect(screen.queryByText('CP')).not.toBeInTheDocument()
  })
})
