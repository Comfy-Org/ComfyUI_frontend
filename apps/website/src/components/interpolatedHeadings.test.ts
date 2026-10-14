import type { Component } from 'vue'

import type { Locale } from '@/i18n/translations'

import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import OurValuesSection from './about/OurValuesSection.vue'
import StorySection from './about/StorySection.vue'
import WireNodeLayout from './common/WireNodeLayout.vue'
import AudienceSection from './product/cloud/AudienceSection.vue'

type HighlightedHeadingCase = {
  name: string
  component: Component
  locale: Locale
  heading: string
  highlight: string
}

const highlightedHeadings: HighlightedHeadingCase[] = [
  {
    name: 'OurValuesSection',
    component: OurValuesSection,
    locale: 'en',
    heading:
      'We believe everyone deserves to design exactly what they dream, own their process, and never compromise because of their software.',
    highlight: 'everyone deserves to design exactly what they dream'
  },
  {
    name: 'OurValuesSection',
    component: OurValuesSection,
    locale: 'zh-CN',
    heading:
      '我们相信每个人都值得设计出自己梦想中的作品，掌握自己的流程，永远不因软件而妥协。',
    highlight: '每个人都值得设计出自己梦想中的作品'
  },
  {
    name: 'StorySection',
    component: StorySection,
    locale: 'en',
    heading:
      'An open-source project that became the professional standard for visual AI.',
    highlight: 'professional standard'
  },
  {
    name: 'StorySection',
    component: StorySection,
    locale: 'zh-CN',
    heading: '一个开源项目成为了视觉 AI 的行业标准。',
    highlight: '行业标准'
  },
  {
    name: 'AudienceSection',
    component: AudienceSection,
    locale: 'en',
    heading: 'Built for creators who need quality, control, and simplicity.',
    highlight: 'creators'
  },
  {
    name: 'AudienceSection',
    component: AudienceSection,
    locale: 'zh-CN',
    heading: '为追求质量、控制与简约的创作者而生。',
    highlight: '创作者'
  }
]

describe('interpolated headings', () => {
  it.for(highlightedHeadings)(
    '$name keeps the highlight inside the $locale heading',
    ({ component, locale, heading, highlight }) => {
      render(component, { props: { locale } })

      const title = screen.getByRole('heading', { level: 2 })
      expect(title.textContent).toBe(heading)
      expect(within(title).getByText(highlight)).toBeInTheDocument()
    }
  )

  it.for([
    { locale: 'en', title: 'Why join?' },
    { locale: 'zh-CN', title: '为什么加入？' }
  ] as const)(
    'WireNodeLayout renders the $locale title card as one message',
    ({ locale, title }) => {
      render(WireNodeLayout, { props: { locale, reasons: [] } })

      const cards = screen.getAllByText(title)
      expect(cards.map((card) => card.textContent)).toEqual([title, title])
    }
  )
})
