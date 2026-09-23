import { expect, it, vi } from 'vitest'

vi.mock('../locales/en/main.json', () => ({
  default: { hero: { title: 'English title' } }
}))
vi.mock('../locales/zh-CN/main.json', () => ({
  default: { hero: { title: '' } }
}))
vi.mock('../locales/ja/main.json', () => ({ default: {} }))

it('preserves an explicitly empty translation while missing copy falls back', async () => {
  const { t } = await import('./translations')

  expect(t('hero.title', 'zh-CN')).toBe('')
  expect(t('hero.title', 'ja')).toBe('English title')
})
