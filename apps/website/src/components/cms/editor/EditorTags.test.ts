import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'

import EditorTags from './EditorTags.vue'

it('adds chips with Enter and comma while retaining existing literal tags', async () => {
  const Harness = defineComponent({
    components: { EditorTags },
    setup: () => ({ tags: ref(['original, tag']) }),
    template:
      '<EditorTags v-model="tags" label="Tags" /><output aria-label="Saved tags">{{ JSON.stringify(tags) }}</output>'
  })
  render(Harness)
  const user = userEvent.setup()
  await user.type(
    screen.getByRole('textbox', { name: 'Tags' }),
    'video,portrait{Enter}'
  )
  expect(screen.getByLabelText('Saved tags')).toHaveTextContent(
    '["original, tag","video","portrait"]'
  )
  await user.click(screen.getByRole('button', { name: 'Remove tag video' }))
  expect(screen.getByLabelText('Saved tags')).toHaveTextContent(
    '["original, tag","portrait"]'
  )
  screen.getByRole('button', { name: 'Remove tag portrait' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Saved tags')).toHaveTextContent(
    '["original, tag"]'
  )
})

it('does not edit tags while the form is blocked and localizes removal', async () => {
  const { emitted } = render(EditorTags, {
    props: {
      modelValue: ['video'],
      label: '标签',
      disabled: true,
      locale: 'zh-CN'
    }
  })
  const user = userEvent.setup()
  expect(screen.getByRole('textbox', { name: '标签' })).toBeDisabled()
  const remove = screen.getByRole('button', { name: '移除标签 video' })
  expect(remove).toBeDisabled()
  await user.click(remove)
  expect(emitted('update:modelValue')).toBeUndefined()
})
