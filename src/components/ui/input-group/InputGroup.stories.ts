import type { Meta, StoryObj } from '@storybook/vue3-vite'

import InputGroup from './InputGroup.vue'
import InputGroupAddon from './InputGroupAddon.vue'
import InputGroupButton from './InputGroupButton.vue'
import InputGroupInput from './InputGroupInput.vue'

const meta = {
  title: 'Components/InputGroup',
  component: InputGroup,
  tags: ['autodocs']
} satisfies Meta<typeof InputGroup>

export default meta
type Story = StoryObj<typeof meta>

const components = {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
}

export const LeadingIcon: Story = {
  render: () => ({
    components,
    template: `
      <InputGroup class="w-80">
        <InputGroupAddon>
          <i class="icon-[lucide--search] size-4" />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search nodes" />
      </InputGroup>`
  })
}

export const TrailingButton: Story = {
  render: () => ({
    components,
    template: `
      <InputGroup class="w-80">
        <InputGroupInput type="password" model-value="hunter2" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-sm" aria-label="Show password">
            <i class="icon-[lucide--eye] size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>`
  })
}

export const TextAddon: Story = {
  render: () => ({
    components,
    template: `
      <InputGroup class="w-80">
        <InputGroupAddon>https://</InputGroupAddon>
        <InputGroupInput placeholder="example.com" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Validate</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>`
  })
}

export const Invalid: Story = {
  render: () => ({
    components,
    template: `
      <InputGroup class="w-80">
        <InputGroupInput model-value="not a url" aria-invalid="true" />
        <InputGroupAddon align="inline-end">
          <i class="icon-[lucide--x] size-4 text-destructive-background" />
        </InputGroupAddon>
      </InputGroup>`
  })
}

export const Disabled: Story = {
  render: () => ({
    components,
    template: `
      <InputGroup class="w-80">
        <InputGroupInput disabled model-value="read only" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-sm" disabled aria-label="Copy">
            <i class="icon-[lucide--copy] size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>`
  })
}
