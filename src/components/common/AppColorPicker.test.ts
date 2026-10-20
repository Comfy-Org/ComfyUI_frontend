import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'

import AppColorPicker from './AppColorPicker.vue'

it.for([
  { props: {}, name: 'Color #000000' },
  { props: { accessibleLabel: 'Background' }, name: 'Background' }
])('names the color trigger $name', ({ props, name }) => {
  render(AppColorPicker, {
    props,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })

  expect(screen.getByRole('button', { name })).toBeVisible()
})

it('translates the real picker and synchronizes its color model', async () => {
  const user = userEvent.setup()
  const color = ref('#ff0000')
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en,
      fr: { g: { color: 'Couleur' }, color: { ...en.color, hue: 'Teinte' } }
    }
  })
  render(
    {
      components: { AppColorPicker },
      setup: () => ({ color }),
      template: '<AppColorPicker v-model="color" />'
    },
    { global: { plugins: [i18n] } }
  )

  await user.click(screen.getByRole('button', { name: 'Color #ff0000' }))
  expect(screen.getByRole('slider', { name: 'Hue' })).toBeVisible()
  const input = screen.getByRole('textbox', { name: 'Hex' })
  await user.clear(input)
  await user.type(input, '336699')
  await user.tab()
  expect(color.value).toBe('#336699')
  expect(screen.getByRole('button', { name: 'Color #336699' })).toBeVisible()

  color.value = '#aabbcc'
  await nextTick()
  expect(input).toHaveValue('#aabbcc')
  expect(screen.getByRole('button', { name: 'Color #aabbcc' })).toBeVisible()
  i18n.global.locale.value = 'fr'
  await nextTick()
  expect(screen.getByRole('button', { name: 'Couleur #aabbcc' })).toBeVisible()
  expect(screen.getByRole('slider', { name: 'Teinte' })).toBeVisible()
})
