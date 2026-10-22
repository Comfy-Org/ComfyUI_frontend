import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const shareImage =
  'https://media.comfy.org/website/open-source-higgsfield/og-open-source-higgsfield.png'

const locales = [
  {
    prefix: '',
    details: 'The details',
    howToEnter: 'How to enter',
    partners: 'Partners',
    timeline: 'Timeline',
    submitNav: 'Submit your entry',
    signup: 'Sign up now',
    deadline: 'October 30 · 9am PT',
    submit: 'Submit your entry',
    buildNight: 'Comfy Build Night: San Francisco',
    question: 'Do I have to attend a Build Night?',
    answer: 'The online competition and the Build Nights are separate.',
    shareAlt: 'Open Source Higgsfield: $25,000 in prizes'
  },
  {
    prefix: '/zh-CN',
    details: '活动详情',
    howToEnter: '如何参赛',
    partners: '合作伙伴',
    timeline: '时间线',
    submitNav: '提交作品',
    signup: '立即报名',
    deadline: '10 月 30 日 · 太平洋时间上午 9 点',
    submit: '提交作品',
    buildNight: 'Comfy 构建之夜：旧金山',
    question: '必须参加构建之夜线下活动吗？',
    answer: '线上比赛与构建之夜各自独立。',
    shareAlt: 'Open Source Higgsfield：25,000 美元奖品'
  }
] as const

for (const locale of locales) {
  test(`challenge navigation and separate entry destinations ${locale.prefix || 'en'}`, async ({
    page
  }) => {
    const base = `${locale.prefix}/open-source-higgsfield/`
    await page.goto(base)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      shareImage
    )
    for (const key of ['og:image:alt', 'twitter:image:alt']) {
      await expect(
        page.locator(`meta[property="${key}"], meta[name="${key}"]`)
      ).toHaveAttribute('content', locale.shareAlt)
    }
    const partners = page.getByRole('region', { name: locale.partners })
    await expect(partners.getByRole('img', { name: 'Runpod' })).toBeVisible()
    await expect(partners.getByRole('img', { name: 'LTX' })).toBeVisible()
    await expect(partners.getByRole('img', { name: 'NVIDIA' })).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: locale.signup }).first()
    ).toHaveAttribute('href', 'https://form.typeform.com/to/Ayn9Cwfj')
    await expect(
      page.locator('#submit').getByRole('link', { name: locale.submit })
    ).toHaveAttribute('href', 'https://form.typeform.com/to/V1dSQrkS')
    await expect(
      page.getByRole('link', { name: locale.buildNight }).first()
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
      .getByRole('link', { name: locale.howToEnter, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}#challenge-content`)
    await expect(
      page.getByRole('heading', { name: locale.howToEnter, exact: true })
    ).toBeInViewport()

    await page
      .getByRole('navigation', { name: locale.details })
      .getByRole('link', { name: locale.submitNav, exact: true })
      .click()
    await expect(page).toHaveURL(`${base}#submit`)
    await expect(
      page.locator('#submit').getByRole('link', { name: locale.submit })
    ).toBeInViewport()
  })
}
