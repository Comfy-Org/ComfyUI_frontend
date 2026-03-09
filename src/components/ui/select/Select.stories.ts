import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Select from './Select.vue'
import SelectContent from './SelectContent.vue'
import SelectGroup from './SelectGroup.vue'
import SelectItem from './SelectItem.vue'
import SelectLabel from './SelectLabel.vue'
import SelectSeparator from './SelectSeparator.vue'
import SelectTrigger from './SelectTrigger.vue'
import SelectValue from './SelectValue.vue'

const meta = {
  title: 'Components/Select/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const value = ref('')
      return { value, args }
    },
    template: `
      <Select v-model="value" :disabled="args.disabled">
        <SelectTrigger class="w-56">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
          <SelectItem value="grape">Grape</SelectItem>
          <SelectItem value="orange">Orange</SelectItem>
        </SelectContent>
      </Select>
    `
  }),
  args: { disabled: false }
}

export const MediumSize: Story = {
  render: () => ({
    components: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const value = ref('')
      return { value }
    },
    template: `
      <Select v-model="value">
        <SelectTrigger class="w-56" size="md">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const Disabled: Story = {
  render: () => ({
    components: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const value = ref('apple')
      return { value }
    },
    template: `
      <Select v-model="value" disabled>
        <SelectTrigger class="w-56">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const Invalid: Story = {
  render: () => ({
    components: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const value = ref('')
      return { value }
    },
    template: `
      <Select v-model="value">
        <SelectTrigger class="w-56" invalid>
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectContent>
      </Select>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const WithGroups: Story = {
  render: () => ({
    components: {
      Select,
      SelectContent,
      SelectGroup,
      SelectItem,
      SelectLabel,
      SelectSeparator,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const value = ref('')
      return { value }
    },
    template: `
      <Select v-model="value">
        <SelectTrigger class="w-56">
          <SelectValue placeholder="Select a model type" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Checkpoints</SelectLabel>
            <SelectItem value="sd15">SD 1.5</SelectItem>
            <SelectItem value="sdxl">SDXL</SelectItem>
            <SelectItem value="flux">Flux</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>LoRAs</SelectLabel>
            <SelectItem value="lora-style">Style LoRA</SelectItem>
            <SelectItem value="lora-character">Character LoRA</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const AllStates: Story = {
  render: () => ({
    components: {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue
    },
    setup() {
      const a = ref('')
      const b = ref('apple')
      const c = ref('')
      const d = ref('apple')
      return { a, b, c, d }
    },
    template: `
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Large (Interface)</p>
          <div class="flex flex-col gap-3">
            <Select v-model="a">
              <SelectTrigger class="w-56"><SelectValue placeholder="Default" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
            <Select v-model="b" disabled>
              <SelectTrigger class="w-56"><SelectValue placeholder="Disabled" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
            <Select v-model="c">
              <SelectTrigger class="w-56" invalid><SelectValue placeholder="Invalid" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <p class="mb-2 text-xs text-muted-foreground">Medium (Node)</p>
          <div class="flex flex-col gap-3">
            <Select v-model="a">
              <SelectTrigger class="w-56" size="md"><SelectValue placeholder="Default" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
            <Select v-model="d" disabled>
              <SelectTrigger class="w-56" size="md"><SelectValue placeholder="Disabled" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
            <Select v-model="c">
              <SelectTrigger class="w-56" size="md" invalid><SelectValue placeholder="Invalid" /></SelectTrigger>
              <SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true }
  }
}
