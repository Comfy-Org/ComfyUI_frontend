import { expect, it, vi } from 'vitest'

vi.mock(import('../locales/zh-CN/main.json'), async (importOriginal) => {
  const { default: catalog } = await importOriginal()
  return { default: { ...catalog, hero: { ...catalog.hero, title: '' } } }
})

it('preserves an explicitly empty translation', async () => {
  const { t } = await import('./translations')

  expect(t('hero.title', 'zh-CN')).toBe('')
  expect(t('hero.title', 'en')).toBe('Professional Control\nof Visual AI')
})
