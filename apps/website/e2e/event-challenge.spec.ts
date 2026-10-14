import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const locales = [
  {
    prefix: '',
    details: 'The details',
    general: 'General',
    glance: 'What to know before you enter.',
    timeline: 'Timeline',
    deadline: 'October 30 · 9am PT',
    submit: 'Submit your entry',
    register: 'Register',
    question: 'Do I have to attend a Build Night?',
    answer: 'The online competition and the Build Nights are separate.'
  },
  {
    prefix: '/zh-CN',
    details: '活动详情',
    general: '概览',
    glance: '参赛前需要了解什么。',
    timeline: '时间线',
    deadline: '10 月 30 日 · 太平洋时间上午 9 点',
    submit: '提交作品',
    register: '报名',
    question: '必须参加构建之夜线下活动吗？',
    answer: '线上比赛与构建之夜各自独立。'
  }
] as const

for (const locale of locales) {
  test(`challenge navigation and separate entry destinations ${locale.prefix || 'en'}`, async ({
    page
  }) => {
    const base = `${locale.prefix}/open-source-higgsfield/`
    await page.goto(base)
    await expect(
      page.getByRole('link', { name: locale.submit }).first()
    ).toHaveAttribute('href', 'https://form.typeform.com/to/V1dSQrkS')
    await expect(
      page.getByRole('link', { name: locale.register }).first()
    ).toHaveAttribute('href', 'https://luma.com/5mydmvu6')
    const question = page.getByRole('button', {
      name: locale.question,
      exact: true
    })
    await waitForIsland(page, question)
    await question.click()
    await expect(
      page
        .getByRole('region', { name: locale.question })
        .getByText(locale.answer, { exact: false })
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.timeline, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}#timeline`)
    await expect(
      page.locator('#timeline').getByText(locale.deadline, { exact: false })
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.general, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}#challenge-content`)
    await expect(
      page.getByRole('heading', { name: locale.glance, exact: true })
    ).toBeInViewport()
  })
}
