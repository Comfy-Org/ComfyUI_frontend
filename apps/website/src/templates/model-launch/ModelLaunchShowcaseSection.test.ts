import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import type { ModelLaunchShowcase } from './types'

import { t } from '../../i18n/translations'
import ModelLaunchShowcaseSection from './ModelLaunchShowcaseSection.vue'

const showcase: ModelLaunchShowcase = {
  headingKey: 'nanoBanana.showcase.photography.heading',
  cards: [
    {
      id: 'one',
      alt: { en: 'First still', 'zh-CN': '第一张' },
      src: 'https://media.comfy.org/one.webp'
    },
    {
      id: 'two',
      alt: { en: 'Second still', 'zh-CN': '第二张' },
      src: 'https://media.comfy.org/two.webp'
    }
  ]
}

describe('ModelLaunchShowcaseSection', () => {
  it('titles the strip with its heading', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase } })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Shot like it happened.' })
    ).toBeTruthy()
  })

  it.for([
    { descriptionKey: undefined, shown: false },
    { descriptionKey: 'chatgptImage25.hero.description', shown: true }
  ] as const)(
    'renders a description only when the page supplies one ($shown)',
    ({ descriptionKey, shown }) => {
      render(ModelLaunchShowcaseSection, {
        props: { showcase: { ...showcase, descriptionKey } }
      })

      expect(
        screen.queryByText(t('chatgptImage25.hero.description', 'en')) !== null
      ).toBe(shown)
    }
  )

  it('renders the optional CTA as a link after the description', () => {
    render(ModelLaunchShowcaseSection, {
      props: {
        showcase: {
          ...showcase,
          descriptionKey: 'nanoBanana.showcase.photography.description',
          cta: {
            labelKey: 'nanoBanana.pricing.banner.cta',
            href: 'https://cloud.comfy.org/',
            target: '_blank'
          }
        }
      }
    })

    const link = screen.getByRole('link', { name: 'TRY FREE' })
    expect(link.getAttribute('href')).toBe('https://cloud.comfy.org/')
    expect(
      screen.getByText(t('nanoBanana.showcase.photography.description', 'en'), {
        exact: false
      })
    ).toBeTruthy()
  })

  it('exposes each still once and hides the looping copy from assistive tech', () => {
    render(ModelLaunchShowcaseSection, { props: { showcase, locale: 'zh-CN' } })

    expect(
      screen.getAllByRole('img').map((img) => img.getAttribute('alt'))
    ).toEqual(['第一张', '第二张'])
    expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(4)
  })

  it('only runs the marquee while the pointer is over the strip', async () => {
    const user = userEvent.setup()
    render(ModelLaunchShowcaseSection, { props: { showcase } })
    const strip = screen.getByTestId('model-launch-showcase-strip')
    const playState = () =>
      screen.getAllByRole('list')[0]?.style.animationPlayState

    expect(playState()).toBe('paused')
    await user.hover(strip)
    await nextTick()
    expect(playState()).toBe('running')
    await user.unhover(strip)
    await nextTick()
    expect(playState()).toBe('paused')
  })

  it('pins the strip still on click until it is clicked again', async () => {
    const user = userEvent.setup()
    render(ModelLaunchShowcaseSection, { props: { showcase } })
    const strip = screen.getByTestId('model-launch-showcase-strip')
    const playState = () =>
      screen.getAllByRole('list')[0]?.style.animationPlayState

    await user.hover(strip)
    await user.click(strip)
    await nextTick()
    expect(playState()).toBe('paused')

    await user.unhover(strip)
    await user.hover(strip)
    await nextTick()
    expect(playState()).toBe('paused')

    await user.click(strip)
    await nextTick()
    expect(playState()).toBe('running')
  })
})
