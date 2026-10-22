import { afterEach, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import { signInSchema } from '@/schemas/signInSchema'

afterEach(() => {
  i18n.global.locale.value = 'en'
})

it('reports validation messages in the locale active when the form validates', async () => {
  i18n.global.mergeLocaleMessage('fr', {
    validation: { invalidEmail: 'Adresse e-mail invalide', required: 'Requis' }
  })

  const english = await signInSchema.parse({ email: 'nope', password: '' })
  i18n.global.locale.value = 'fr'
  const french = await signInSchema.parse({ email: 'nope', password: '' })

  expect(english.errors).toEqual([
    { path: 'email', errors: ['Invalid email address'] },
    { path: 'password', errors: ['Required'] }
  ])
  expect(french.errors).toEqual([
    { path: 'email', errors: ['Adresse e-mail invalide'] },
    { path: 'password', errors: ['Requis'] }
  ])
})
