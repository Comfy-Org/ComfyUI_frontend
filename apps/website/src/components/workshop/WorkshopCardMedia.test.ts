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
    { variant: 'compareSlider', staticUrl: undefined, after: '/after.webp' },
    {
      variant: 'compareSlider',
      staticUrl: '/still.webp',
      after: '/still.webp'
    },
    { variant: 'hoverDissolve', staticUrl: undefined, after: '/after.webp' },
    { variant: 'hoverDissolve', staticUrl: '/still.webp', after: '/still.webp' }
  ] as const)(
    'loads $after and the original second image, unnamed, for a $variant card',
    ({ variant, staticUrl, after }) => {
      render(WorkshopCardMedia, {
        props: {
          model: {
            ...compare,
            thumbnail: { ...compare.thumbnail, variant, staticUrl }
          }
        }
      })
      const [first, second, ...rest] = screen.getAllByRole('img')
      expect(rest).toHaveLength(0)
      expect(first).toHaveAttribute('src', after)
      expect(second).toHaveAttribute('src', '/before.webp')
      expect(first).toHaveAttribute('alt', '')
      expect(second).toHaveAttribute('alt', '')
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

  it.for([
    {
      drag: 'sideways',
      points: [
        [20, 75],
        [90, 75],
        [160, 75]
      ],
      line: '80%'
    },
    {
      drag: 'vertical',
      points: [
        [50, 30],
        [50, 80],
        [50, 140]
      ],
      line: '25%'
    }
  ] as const)(
    'holds the page and moves the line on a $drag touch drag',
    async ({ points, line }) => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 200, 150)
      )
      render(WorkshopCardMedia, { props: { model: compare } })
      await nextTick()
      const handle = screen.getByTestId('compare-handle')
      for (const [clientX, clientY] of points) {
        const touch = new Touch({
          identifier: 1,
          target: handle,
          clientX,
          clientY
        })
        const moved = new TouchEvent('touchmove', {
          bubbles: true,
          cancelable: true,
          touches: [touch]
        })
        handle.dispatchEvent(moved)
        expect(moved.defaultPrevented).toBe(true)
      }
      await nextTick()
      expect(handle).toHaveStyle({ left: line })
    }
  )

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
