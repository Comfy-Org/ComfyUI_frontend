import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import WorkshopCardMedia from './WorkshopCardMedia.vue'

describe('Hub browsing thumbnails', () => {
  it.for(['image', 'video'] as const)(
    'loads only the still thumbnail for %s cards',
    async (kind) => {
      const html = await renderToString(
        createSSRApp(WorkshopCardMedia, {
          model: {
            name: 'Card',
            thumbnail: {
              url: '/original/full-resolution',
              kind,
              poster: '/preview-media/7/thumb/exact-version',
              staticUrl: '/preview-media/7/thumb/exact-version'
            }
          }
        })
      )
      expect(html).toContain('<img')
      expect(html).toContain('src="/preview-media/7/thumb/exact-version"')
      expect(html).not.toContain('<video')
      expect(html).not.toContain('/original/full-resolution')
    }
  )
  it('shows the placeholder instead of an image for an audio card with no still', async () => {
    const html = await renderToString(
      createSSRApp(WorkshopCardMedia, {
        model: {
          name: 'Card',
          thumbnail: { url: '/catalog-media/hero/song', kind: 'audio' }
        }
      })
    )
    expect(html).not.toContain('/catalog-media/hero/song')
    expect(html).toContain('data-testid="model-media-placeholder"')
  })

  const compare = {
    name: 'Relight',
    thumbnail: {
      url: '/hero.webp',
      kind: 'image',
      variant: 'compareSlider',
      primaryUrl: '/after.webp',
      secondaryUrl: '/before.webp'
    }
  } as const

  it.for([
    { locale: 'en', after: 'Relight - After', before: 'Relight - Before' },
    { locale: 'zh-CN', after: 'Relight - 处理后', before: 'Relight - 处理前' }
  ] as const)(
    'names the compare stills in $locale',
    ({ locale, after, before }) => {
      render(WorkshopCardMedia, { props: { model: compare, locale } })
      expect(screen.getByRole('img', { name: after })).toHaveProperty(
        'src',
        expect.stringContaining('/after.webp')
      )
      expect(screen.getByRole('img', { name: before })).toHaveProperty(
        'src',
        expect.stringContaining('/before.webp')
      )
    }
  )

  it('leaves every click on a compare card to its link', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      defineComponent(
        () => () =>
          h('a', { href: '/workflows/relight', onClick }, [
            h(WorkshopCardMedia, { model: compare })
          ])
      )
    )
    const link = screen.getByRole('link')
    await user.tab()
    expect(link).toHaveFocus()
    await user.tab()
    expect(link).not.toHaveFocus()
    expect(screen.getByTestId('compare-handle')).not.toHaveFocus()
    expect(screen.queryByRole('slider')).toBeNull()
    const parts = [
      screen.getByTestId('compare-handle'),
      ...screen.getAllByRole('img')
    ]
    for (const part of parts) {
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      part.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(false)
    }
    expect(onClick).toHaveBeenCalledTimes(parts.length)
  })

  it('keeps a sideways touch drag on the compare image', async () => {
    render(WorkshopCardMedia, { props: { model: compare } })
    await nextTick()
    const after = screen.getByRole('img', { name: 'Relight - After' })
    const dragged = new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true
    })
    after.dispatchEvent(dragged)
    expect(dragged.defaultPrevented).toBe(true)
  })

  it('fades to the second still on a hover dissolve card', () => {
    render(WorkshopCardMedia, {
      props: {
        model: {
          ...compare,
          thumbnail: { ...compare.thumbnail, variant: 'hoverDissolve' }
        }
      }
    })
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByRole('img', { name: 'Relight - 2' })).toHaveProperty(
      'src',
      expect.stringContaining('/before.webp')
    )
  })

  it.for(['compareSlider', 'hoverDissolve'] as const)(
    'shows the card still for a %s card with no second image',
    (variant) => {
      render(WorkshopCardMedia, {
        props: {
          model: {
            name: 'Relight',
            thumbnail: {
              url: '/hero.webp',
              kind: 'image',
              variant,
              primaryUrl: '/after.webp'
            }
          }
        }
      })
      expect(screen.queryByRole('img', { name: 'Relight' })).toBeNull()
      expect(screen.getByTestId('model-card-media')).toHaveProperty(
        'src',
        expect.stringContaining('/hero.webp')
      )
    }
  )
})
