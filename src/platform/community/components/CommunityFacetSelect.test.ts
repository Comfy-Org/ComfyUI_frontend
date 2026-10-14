import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import messages from '@/locales/en/main.json'
import CommunityFacetSelect from './CommunityFacetSelect.vue'

it('keeps a large facet list bounded while making its last value searchable and selectable', async () => {
  const user = userEvent.setup()
  const result = render(CommunityFacetSelect, {
    props: {
      label: 'Models',
      modelValue: 'model-17',
      options: Array.from({ length: 5000 }, (_, index) => ({
        value: `model-${index}`,
        name: `Model ${index}`
      }))
    },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
  await user.click(screen.getByRole('combobox', { name: 'Models' }))
  expect(screen.getByRole('combobox', { name: 'Search Models' })).toHaveValue(
    ''
  )
  expect(screen.getAllByRole('option').length).toBeLessThan(100)
  await user.type(
    screen.getByRole('combobox', { name: 'Search Models' }),
    'model 4999'
  )
  await user.click(await screen.findByRole('option', { name: 'Model 4999' }))
  expect(result.emitted()['update:modelValue']).toEqual([['model-4999']])
})

it('keeps the selected value discoverable and searchable with an icon trigger', async () => {
  const user = userEvent.setup()
  const result = render(CommunityFacetSelect, {
    props: {
      label: 'Models',
      icon: 'icon-[lucide--box]',
      modelValue: 'first',
      options: [
        { value: 'first', name: 'First model' },
        { value: 'second', name: 'Second model' }
      ]
    },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
  const trigger = screen.getByRole('combobox', { name: 'Models' })
  expect(trigger).toHaveAttribute('title', 'Models: First model')
  await user.click(trigger)
  await user.type(
    screen.getByRole('combobox', { name: 'Search Models' }),
    'second'
  )
  await user.click(screen.getByRole('option', { name: 'Second model' }))
  expect(result.emitted()['update:modelValue']).toEqual([['second']])
  await result.rerender({ modelValue: 'second' })
  expect(trigger).toHaveAttribute('title', 'Models: Second model')
})

it('closes an icon dropdown with Escape without closing the surrounding modal', async () => {
  const user = userEvent.setup()
  render(CommunityFacetSelect, {
    props: {
      label: 'Tags',
      icon: 'icon-[lucide--tags]',
      modelValue: undefined,
      options: [{ value: 'image', name: 'Image' }]
    },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
      ]
    }
  })
  const modalEscape = vi.fn()
  document.addEventListener('keydown', modalEscape)
  try {
    await user.click(screen.getByRole('combobox', { name: 'Tags' }))
    await user.click(screen.getByRole('combobox', { name: 'Search Tags' }))
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('option', { name: 'Image' })
    ).not.toBeInTheDocument()
    expect(modalEscape).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: 'Tags' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  } finally {
    document.removeEventListener('keydown', modalEscape)
  }
})
