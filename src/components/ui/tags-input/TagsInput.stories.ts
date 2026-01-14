import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import TagsInput from './TagsInput.vue'
import TagsInputInput from './TagsInputInput.vue'
import TagsInputItem from './TagsInputItem.vue'
import TagsInputItemDelete from './TagsInputItemDelete.vue'
import TagsInputItemText from './TagsInputItemText.vue'

const meta: Meta<typeof TagsInput> = {
  title: 'Components/TagsInput',
  component: TagsInput,
  tags: ['autodocs'],
  argTypes: {
    modelValue: {
      control: 'object',
      description: 'Array of tag values'
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled'
    },
    'onUpdate:modelValue': { action: 'update:modelValue' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: {
      TagsInput,
      TagsInputInput,
      TagsInputItem,
      TagsInputItemDelete,
      TagsInputItemText
    },
    setup() {
      const tags = ref(args.modelValue || ['tag1', 'tag2'])
      return { tags }
    },
    template: `
      <TagsInput v-model="tags" class="w-80">
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Add tag..." />
      </TagsInput>
      <div class="mt-4 text-sm text-muted-foreground">
        Tags: {{ tags.join(', ') }}
      </div>
    `
  }),
  args: {
    modelValue: ['Vue', 'TypeScript']
  }
}

export const Empty: Story = {
  render: () => ({
    components: {
      TagsInput,
      TagsInputInput,
      TagsInputItem,
      TagsInputItemDelete,
      TagsInputItemText
    },
    setup() {
      const tags = ref<string[]>([])
      return { tags }
    },
    template: `
      <TagsInput v-model="tags" class="w-80">
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Start typing to add tags..." />
      </TagsInput>
    `
  })
}

export const ManyTags: Story = {
  render: () => ({
    components: {
      TagsInput,
      TagsInputInput,
      TagsInputItem,
      TagsInputItemDelete,
      TagsInputItemText
    },
    setup() {
      const tags = ref([
        'JavaScript',
        'TypeScript',
        'Vue',
        'React',
        'Svelte',
        'Node.js',
        'Python',
        'Rust'
      ])
      return { tags }
    },
    template: `
      <TagsInput v-model="tags" class="w-96">
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Add technology..." />
      </TagsInput>
    `
  })
}

export const Disabled: Story = {
  render: () => ({
    components: {
      TagsInput,
      TagsInputInput,
      TagsInputItem,
      TagsInputItemDelete,
      TagsInputItemText
    },
    setup() {
      const tags = ref(['Read', 'Only', 'Tags'])
      return { tags }
    },
    template: `
      <TagsInput v-model="tags" :disabled="true" class="w-80 opacity-60">
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Cannot add tags..." />
      </TagsInput>
    `
  })
}

export const CustomWidth: Story = {
  render: () => ({
    components: {
      TagsInput,
      TagsInputInput,
      TagsInputItem,
      TagsInputItemDelete,
      TagsInputItemText
    },
    setup() {
      const tags = ref(['Full', 'Width'])
      return { tags }
    },
    template: `
      <TagsInput v-model="tags" class="w-full">
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput placeholder="Add tag..." />
      </TagsInput>
    `
  })
}
