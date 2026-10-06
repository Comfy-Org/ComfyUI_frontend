import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test('VFX visitors can explore workflows and contact the team @mobile', async ({
  page
}) => {
  await page.goto('/vfx/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Build your VFX pipeline with Comfy.'
  )
  await page
    .getByRole('link', { name: 'Explore VFX workflows', exact: true })
    .click()
  await expect(page).toHaveURL(/#workflows$/)
  const workflows = page.locator('#workflows')
  await expect(workflows.getByRole('link')).toHaveCount(6)
  await expect(
    workflows.getByRole('link', { name: 'Sky Replacement', exact: true })
  ).toHaveAttribute('href', '/learning/vfx/sky-replacement/')
  await expect(
    page.getByRole('link', { name: 'Talk to our team', exact: true }).first()
  ).toHaveAttribute('href', '/contact/?interest=vfx')
  await page
    .getByRole('button', { name: 'Can my team run Comfy locally?' })
    .click()
  await expect(
    page.getByRole('region', { name: 'Can my team run Comfy locally?' })
  ).toContainText('ComfyUI is open source')
})

test('Chinese VFX visitors get localized workflow and contact links', async ({
  page
}) => {
  await page.goto('/zh-CN/vfx/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '用 Comfy 构建 你的视觉特效流程。'
  )
  await expect(
    page.getByRole('link', { name: '天空替换', exact: true })
  ).toHaveAttribute('href', '/zh-CN/learning/vfx/sky-replacement/')
  await expect(
    page.getByRole('link', { name: '联系我们的团队', exact: true }).first()
  ).toHaveAttribute('href', '/zh-CN/contact/?interest=vfx')
})
