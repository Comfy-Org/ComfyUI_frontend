import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { expect, it } from 'vitest'
import { ref } from 'vue'

import InputGroup from '@/components/ui/input-group/InputGroup.vue'
import InputGroupAddon from '@/components/ui/input-group/InputGroupAddon.vue'
import InputGroupButton from '@/components/ui/input-group/InputGroupButton.vue'
import InputGroupInput from '@/components/ui/input-group/InputGroupInput.vue'

import Field from './Field.vue'
import FieldDescription from './FieldDescription.vue'
import FieldError from './FieldError.vue'
import FieldGroup from './FieldGroup.vue'
import FieldLabel from './FieldLabel.vue'

it('composes a labeled input with addon focus, value binding, and an independent clear action', async () => {
  const value = ref('draft')
  render({
    components: {
      FieldGroup,
      Field,
      FieldLabel,
      FieldDescription,
      InputGroup,
      InputGroupAddon,
      InputGroupInput,
      InputGroupButton
    },
    setup: () => ({ value }),
    template: `
      <FieldGroup>
        <Field>
          <FieldLabel for="name">Name</FieldLabel>
          <InputGroup>
            <InputGroupAddon>Prefix</InputGroupAddon>
            <InputGroupInput id="name" v-model="value" aria-describedby="name-help" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton @click="value = ''">Clear</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription id="name-help">Choose a unique name</FieldDescription>
        </Field>
      </FieldGroup>
    `
  })
  const input = screen.getByRole('textbox', { name: 'Name' })

  expect(input).toHaveAccessibleDescription('Choose a unique name')
  await userEvent.click(screen.getByText('Prefix'))
  expect(input).toHaveFocus()
  await userEvent.type(input, ' revised')
  expect(value.value).toBe('draft revised')

  await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(input).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus()
})

it('deduplicates validation messages and removes the alert when errors clear', async () => {
  const { rerender } = render(FieldError, {
    props: {
      errors: ['Required', { message: 'Required' }, undefined, '', 'Too short']
    }
  })

  expect(screen.getByRole('alert')).toHaveTextContent('RequiredToo short')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)

  await rerender({ errors: [{ message: 'Invalid name' }] })
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid name')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()

  await rerender({ errors: [] })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('lets a caller replace generated validation messages with actionable content', () => {
  render(FieldError, {
    props: { errors: ['Generated message'] },
    slots: { default: '<a href="#name">Correct the name</a>' }
  })

  expect(screen.getByRole('alert')).toHaveTextContent('Correct the name')
  expect(
    screen.getByRole('link', { name: 'Correct the name' })
  ).toHaveAttribute('href', '#name')
  expect(screen.queryByText('Generated message')).not.toBeInTheDocument()
})
