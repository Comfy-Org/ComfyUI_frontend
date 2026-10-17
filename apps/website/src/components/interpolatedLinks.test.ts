import type { Component } from 'vue'

import type { Locale } from '@/i18n/translations'

import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { wholeText } from '@/test/wholeText'
import CliSetupSection from '@/templates/cli/SetupSection.vue'
import CliSkillsSection from '@/templates/cli/SkillsSection.vue'
import McpSetupSection from '@/templates/mcp/SetupSection.vue'
import GetStartedSection from './home/GetStartedSection.vue'

vi.mock(import('@/scripts/posthog'))

type LinkSentenceCase = {
  name: string
  component: Component
  locale: Locale
  sentence: string
  link: string
}

const linkSentences: LinkSentenceCase[] = [
  {
    name: 'GetStartedSection',
    component: GetStartedSection,
    locale: 'en',
    sentence: 'Start from a community template or build your own.',
    link: 'a community template'
  },
  {
    name: 'GetStartedSection',
    component: GetStartedSection,
    locale: 'zh-CN',
    sentence: '从社区模板开始，或自行构建。',
    link: '社区模板'
  },
  {
    name: 'CliSkillsSection',
    component: CliSkillsSection,
    locale: 'en',
    sentence: 'More agent skills live in the Comfy Skills repository.',
    link: 'Comfy Skills repository'
  },
  {
    name: 'CliSkillsSection',
    component: CliSkillsSection,
    locale: 'ja',
    sentence:
      'さらに多くのエージェントスキルは、Comfy Skillsリポジトリにあります。',
    link: 'Comfy Skillsリポジトリ'
  },
  {
    name: 'CliSetupSection',
    component: CliSetupSection,
    locale: 'en',
    sentence:
      'Cloud runs spend Comfy credits. Add credits, or use an existing Comfy Cloud subscription. Browsing templates, models, and nodes is free with a Comfy account.',
    link: 'Comfy Cloud subscription'
  },
  {
    name: 'CliSetupSection',
    component: CliSetupSection,
    locale: 'ja',
    sentence:
      'すべてのコマンドとフラグは、コマンドリファレンスに掲載されています。',
    link: 'コマンドリファレンス'
  },
  {
    name: 'McpSetupSection',
    component: McpSetupSection,
    locale: 'zh-CN',
    sentence:
      '如需通过 MCP 使用 Comfy Cloud，你需要任意套餐的订阅。仅充值积分不足以运行生成任务。',
    link: '任意套餐的订阅'
  }
]

describe('interpolated link sentences', () => {
  it.for(linkSentences)(
    '$name keeps the link inside the $locale sentence',
    ({ component, locale, sentence, link }) => {
      render(component, {
        props: { locale },
        global: { stubs: { VideoPlayer: true } }
      })

      const paragraph = screen.getByText(wholeText(sentence), {
        selector: 'p'
      })
      expect(
        within(paragraph).getByRole('link', { name: link })
      ).toBeInTheDocument()
    }
  )
})
