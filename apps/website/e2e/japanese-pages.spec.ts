import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

const pages = [
  { path: '/', title: 'Comfy - ビジュアルAIを自在にコントロール' },
  { path: '/about/', title: 'Comfyについて' },
  {
    path: '/download/',
    title: 'Comfy Desktopをダウンロード - 自分のハードウェアでAIを実行'
  },
  { path: '/cloud/', title: 'Comfy Cloud - クラウドのAI' },
  { path: '/platform/', title: '開発者向けプラットフォーム' },
  { path: '/pricing/', title: '料金 - Comfy Cloud' }
]

for (const { path, title } of pages) {
  test(`Japanese ${path} publishes localized metadata and language links`, async ({
    page
  }) => {
    const localizedPath = path === '/' ? '/ja/' : `/ja${path}`
    await page.goto(localizedPath)

    await expect(page).toHaveTitle(title)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://comfy.org${localizedPath}`
    )
    const languages = page.getByRole('navigation', {
      name: '言語',
      exact: true
    })
    await expect(
      languages.getByRole('link', { name: '日本語' })
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      languages.getByRole('link', { name: 'English' })
    ).toHaveAttribute('href', path)
    await expect(
      languages.getByRole('link', { name: '简体中文' })
    ).toHaveAttribute('href', `/zh-CN${path}`)
  })
}

test('Japanese pricing uses consistent branded plan names', async ({
  page
}) => {
  await page.goto('/ja/pricing/')
  await expect(
    page.getByRole('link', { name: /^(Standard|Creator|Pro)に登録$/ })
  ).toHaveText(['Standardに登録', 'Creatorに登録', 'Proに登録'])
})

test('Japanese pricing links the Cloud API documentation', async ({ page }) => {
  await page.goto('/ja/pricing/')
  await page
    .getByText('Cloud APIを使い始めるにはどうすればよいですか？', {
      exact: true
    })
    .click()
  await expect(
    page.getByRole('link', { name: 'Cloud APIのドキュメント' })
  ).toHaveAttribute('href', 'https://docs.comfy.org/development/deploy/cloud')
})

test('Japanese license comparison uses Japanese criteria', async ({ page }) => {
  await page.goto('/ja/pricing/')
  await expect(
    page.getByRole('columnheader', { name: 'Professional' })
  ).toBeVisible()
  await expect(
    page.getByRole('rowheader', { name: 'ライセンス対象ユーザー数' })
  ).toBeVisible()
})

test('Japanese credit FAQ shows one-year purchased-credit validity', async ({
  page
}) => {
  await page.goto('/ja/pricing/')
  await page
    .getByText('未使用のクレジットは繰り越されますか？', { exact: true })
    .click()
  await expect(
    page.getByText('追加購入クレジットの有効期間は購入から1年間です。', {
      exact: true
    })
  ).toBeVisible()
})

test('Japanese homepage localizes the enabled Hub discovery section', async ({
  context,
  page
}) => {
  await stubWorkshopFlags(context, {
    'workshop-enabled': true,
    'workshop-workflows-enabled': true
  })
  await page.goto('/ja/')

  const showcaseLabel = page.getByText('の仕組み', { exact: true })
  const showcaseLogo = page
    .locator('section')
    .filter({ has: showcaseLabel })
    .getByRole('img', { name: 'Comfy', exact: true })
  await expect(showcaseLabel).toBeVisible()
  await expect(page.getByText('仕組み', { exact: true })).toHaveCount(0)
  const labelX = await showcaseLabel.evaluate(
    (element) => element.getBoundingClientRect().x
  )
  const logoX = await showcaseLogo.evaluate(
    (element) => element.getBoundingClientRect().x
  )
  expect(logoX).toBeLessThan(labelX)

  await expect(
    page.getByText(
      'Comfy Agentで、ComfyUI内にワークフローを作成できるようになりました。',
      { exact: true }
    )
  ).toBeVisible()

  const discovery = page.getByTestId('model-discovery')
  await expect(
    discovery.getByRole('heading', { name: /^最新モデルを、\s*すぐに実行$/ })
  ).toBeVisible()
  await expect(
    discovery.getByRole('link', { name: 'すべてのモデルを見る' })
  ).toHaveAttribute('href', '/hub/models/')

  const tabs = discovery.getByRole('group', { name: '表示内容' })
  await expect(
    tabs.getByRole('button', { name: 'モデル', exact: true })
  ).toBeVisible()
  await tabs.getByRole('button', { name: 'ワークフロー', exact: true }).click()

  await expect(
    discovery.getByRole('region', { name: 'ワークフロー', exact: true })
  ).toBeVisible()
  await expect(
    discovery.getByRole('link', { name: 'すべてのワークフローを見る' })
  ).toHaveAttribute('href', '/hub/workflows/')
})

for (const path of ['/ja/', '/ja/about/', '/ja/pricing/']) {
  test(`Japanese ${path} fits a narrow screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await page.evaluate(() => document.fonts.ready)
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      )
      .toBe(true)
  })
}

for (const path of ['/about/', '/zh-CN/about/']) {
  test(`Japanese rollout preserves existing ${path} badges`, async ({
    page
  }) => {
    await page.goto(path)
    await expect(page.getByText('OUR', { exact: true })).toBeVisible()
    await expect(page.getByText('INVESTORS', { exact: true })).toHaveCSS(
      'height',
      '48px'
    )
    await expect(
      page.getByText('OPEN-SOURCE', { exact: true }).filter({ visible: true })
    ).toBeVisible()
  })
}
