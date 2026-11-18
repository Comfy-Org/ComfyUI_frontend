import { afterEach, describe, expect, it } from 'vitest'

import { i18n, loadLocale } from '@/i18n'

describe('credits.creditUnit in Russian', () => {
  const previousLocale = i18n.global.locale.value

  afterEach(() => {
    i18n.global.locale.value = previousLocale
  })

  it.for([
    [1, 'Кредит'],
    [2, 'Кредита'],
    [5, 'Кредитов'],
    [7, 'Кредитов'],
    [21, 'Кредит'],
    [1.5, 'Кредита']
  ] as const)(
    'reads %s as %s under the app plural rule',
    async ([count, unit]) => {
      await loadLocale('ru')
      i18n.global.locale.value = 'ru'
      expect(i18n.global.t('credits.creditUnit', count)).toBe(unit)
    }
  )
})
