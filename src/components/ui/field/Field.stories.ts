import type { Meta, StoryObj } from '@storybook/vue3-vite'

import Input from '@/components/ui/input/Input.vue'
import Switch from '@/components/ui/switch/Switch.vue'

import Field from './Field.vue'
import FieldDescription from './FieldDescription.vue'
import FieldError from './FieldError.vue'
import FieldGroup from './FieldGroup.vue'
import FieldLabel from './FieldLabel.vue'

const meta = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal', 'responsive']
    }
  }
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

const components = {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Switch
}

export const Default: Story = {
  render: (args) => ({
    components,
    setup: () => ({ args }),
    template: `
      <Field v-bind="args" class="w-80">
        <FieldLabel for="field-default">Email</FieldLabel>
        <Input id="field-default" placeholder="you@example.com" />
        <FieldDescription>
          We only use this to send the reset link.
        </FieldDescription>
      </Field>`
  })
}

export const Invalid: Story = {
  render: (args) => ({
    components,
    setup: () => ({ args }),
    template: `
      <Field v-bind="args" class="w-80" data-invalid="true">
        <FieldLabel for="field-invalid">Email</FieldLabel>
        <Input id="field-invalid" model-value="not-an-email" aria-invalid="true" />
        <FieldError :errors="['Please enter a valid email address']" />
      </Field>`
  })
}

export const MultipleErrors: Story = {
  render: (args) => ({
    components,
    setup: () => ({ args }),
    template: `
      <Field v-bind="args" class="w-80" data-invalid="true">
        <FieldLabel for="field-errors">Password</FieldLabel>
        <Input id="field-errors" type="password" model-value="abc" aria-invalid="true" />
        <FieldError
          :errors="[
            'Must be between 8 and 32 characters',
            'Must contain at least one number',
            { message: 'Must contain at least one special character' }
          ]"
        />
      </Field>`
  })
}

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => ({
    components,
    setup: () => ({ args }),
    template: `
      <Field v-bind="args" class="w-80">
        <FieldLabel for="field-horizontal">Enable notifications</FieldLabel>
        <Switch id="field-horizontal" />
      </Field>`
  })
}

export const Group: Story = {
  render: () => ({
    components,
    template: `
      <FieldGroup class="w-80">
        <Field>
          <FieldLabel for="group-email">Email</FieldLabel>
          <Input id="group-email" placeholder="you@example.com" />
        </Field>
        <Field>
          <FieldLabel for="group-password">Password</FieldLabel>
          <Input id="group-password" type="password" placeholder="••••••••" />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
      </FieldGroup>`
  })
}
