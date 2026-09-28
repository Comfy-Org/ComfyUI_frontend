import { expect, it, vi } from 'vitest'

const zhCN = await vi.hoisted(
  async () => (await import('../locales/zh-CN/main.json')).default
)

vi.mock(import('../locales/zh-CN/main.json'), () => ({
  default: { ...zhCN, hero: { ...zhCN.hero, title: '' } }
}))

it('preserves an explicitly empty translation', async () => {
  const { t } = await import('./translations')

  expect(t('hero.title', 'zh-CN')).toBe('')
  expect(t('hero.title', 'en')).toBe('Professional Control\nof Visual AI')
})
