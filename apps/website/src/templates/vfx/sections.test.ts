import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Locale } from '@/i18n/translations'

import { t } from '@/i18n/translations'
import ClosingCtaSection from './ClosingCtaSection.vue'
import FAQSection from './FAQSection.vue'
import HeroSection from './HeroSection.vue'
import TasksSection from './TasksSection.vue'
import WhySection from './WhySection.vue'
import WorkflowsSection from './WorkflowsSection.vue'

const locales: Locale[] = ['en', 'zh-CN']

describe('vfx sections', () => {
  it.for(locales)(
    'renders the hero with one contact CTA and a video for %s',
    (locale) => {
      render(HeroSection, { props: { locale } })

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        t('vfx.hero.title', {}, { locale })
      )
      const cta = screen.getByRole('link', {
        name: t('vfx.hero.cta', {}, { locale })
      })
      expect(cta.getAttribute('href')).toBe(
        locale === 'en' ? '/contact/' : '/zh-CN/contact/'
      )
      expect(
        screen.getByLabelText(t('vfx.hero.videoLabel', {}, { locale }))
      ).toBeTruthy()
    }
  )

  it('does not put Download or Try Cloud calls to action in the hero or closing section', () => {
    render(HeroSection)
    render(ClosingCtaSection)

    expect(
      screen.queryByRole('link', { name: /download|try .*cloud/i })
    ).toBeNull()
  })

  it.for(locales)('renders a card per task for %s', (locale) => {
    render(TasksSection, { props: { locale } })

    for (const id of [
      'cleanplate',
      'sky',
      'deaging',
      'compositing',
      'upscaling'
    ]) {
      expect(
        screen.getByRole('heading', {
          name: t(`vfx.tasks.${id}.title`, {}, { locale })
        })
      ).toBeTruthy()
    }
  })

  it('renders the four reasons studios build on Comfy', () => {
    render(WhySection)

    for (const id of ['control', 'open', 'infrastructure', 'api']) {
      expect(
        screen.getByRole('heading', {
          name: t(`vfx.why.${id}.title`, {}, { locale: 'en' })
        })
      ).toBeTruthy()
    }
  })

  it('renders the workflow cards as links that open in a new tab', () => {
    render(WorkflowsSection)

    const cards = screen.getAllByRole('link', {
      name: /cleanplate|sky replacement|face swap|vfx utilities/i
    })
    expect(cards.length).toBeGreaterThanOrEqual(4)
    expect(cards.some((card) => card.getAttribute('target') === '_blank')).toBe(
      true
    )
  })

  it('renders every FAQ question', () => {
    render(FAQSection)

    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(
      screen.getByRole('button', {
        name: 'Can ComfyUI run on our own infrastructure?'
      })
    ).toBeTruthy()
  })

  it('renders the closing CTA to the contact form', () => {
    render(ClosingCtaSection)

    expect(
      screen.getByRole('link', { name: 'REQUEST DEMO' }).getAttribute('href')
    ).toBe('/contact/')
  })
})
