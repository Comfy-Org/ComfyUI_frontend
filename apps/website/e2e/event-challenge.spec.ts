import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const locales = [
  {
    prefix: '',
    details: 'The details',
    general: 'General',
    timeline: 'Timeline',
    terms: 'Terms',
    deadline: 'October 19 · 9am PT',
    rules: 'Terms & judging',
    submit: 'Submit your entry',
    event: 'Register for SF Build Night',
    question: 'Do I have to attend the SF event?',
    answer: 'The online challenge and October 13 Build Night are separate.'
  },
  {
    prefix: '/zh-CN',
    details: '活动详情',
    general: '概览',
    timeline: '时间线',
    terms: '规则',
    deadline: '10 月 19 日 · 太平洋时间上午 9 点',
    rules: '规则与评审',
    submit: '提交作品',
    event: '报名旧金山构建之夜',
    question: '必须参加旧金山线下活动吗？',
    answer: '线上挑战赛与 10 月 13 日构建之夜独立进行。'
  }
] as const

for (const locale of locales) {
  test(`challenge navigation and separate entry destinations ${locale.prefix || 'en'}`, async ({
    page
  }) => {
    const base = `${locale.prefix}/events/dev-platform-challenge/`
    await page.goto(base)
    await expect(
      page.getByRole('link', { name: locale.submit }).first()
    ).toHaveAttribute('href', 'https://form.typeform.com/to/V1dSQrkS')
    await expect(
      page.getByRole('link', { name: locale.event })
    ).toHaveAttribute('href', 'https://luma.com/5mydmvu6')
    await page
      .getByRole('button', { name: locale.question, exact: true })
      .click()
    await expect(
      page
        .getByRole('region', { name: locale.question })
        .getByText(locale.answer, { exact: false })
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.timeline, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}timeline/#challenge-content`)
    await expect(
      page.getByText(locale.deadline, { exact: false })
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.terms, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}terms/#challenge-content`)
    await expect(
      page.getByRole('heading', { name: locale.rules, exact: true })
    ).toBeVisible()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.general, exact: true })
      .click()
    await expect(page.getByRole('link', { name: locale.event })).toBeVisible()
  })
}
