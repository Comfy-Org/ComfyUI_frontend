import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Tree from './Tree.vue'
import TreeItem from './TreeItem.vue'

interface ModelItem {
  key: string
  label: string
  children?: ModelItem[]
}

interface TreeStoryArgs {
  defaultExpanded: string[]
  disabled: boolean
  items: ModelItem[]
}

const modelFolders: ModelItem[] = [
  {
    key: 'checkpoints',
    label: 'checkpoints',
    children: [
      {
        key: 'checkpoints/sdxl',
        label: 'sdxl',
        children: [
          {
            key: 'checkpoints/sdxl/sd_xl_base_1.0',
            label: 'sd_xl_base_1.0.safetensors'
          },
          {
            key: 'checkpoints/sdxl/sd_xl_refiner_1.0',
            label: 'sd_xl_refiner_1.0.safetensors'
          }
        ]
      },
      { key: 'checkpoints/dreamshaper_8', label: 'dreamshaper_8.safetensors' }
    ]
  },
  {
    key: 'loras',
    label: 'loras',
    children: [
      { key: 'loras/detail_tweaker_xl', label: 'detail_tweaker_xl.safetensors' }
    ]
  },
  { key: 'vae', label: 'vae', children: [] }
]

const meta: Meta<TreeStoryArgs> = {
  title: 'Components/Tree',
  tags: ['autodocs'],
  args: {
    items: modelFolders,
    defaultExpanded: [],
    disabled: false
  },
  argTypes: {
    disabled: { control: 'boolean' }
  },
  render: (args) => ({
    components: { Tree, TreeItem },
    setup: () => ({
      args,
      expanded: ref([...args.defaultExpanded]),
      selected: ref<ModelItem>()
    }),
    template: `
      <Tree
        v-model:expanded="expanded"
        v-model:selected="selected"
        :items="args.items"
        :get-key="(item) => item.key"
        :get-children="(item) => item.children"
        :disabled="args.disabled"
        aria-label="Models"
        class="w-72"
      >
        <template #default="{ flattenedItems }">
          <TreeItem
            v-for="item in flattenedItems"
            :key="item._id"
            :value="item.value"
            :level="item.level"
            :has-children="item.hasChildren"
          >
            <i
              :class="
                item.hasChildren
                  ? 'icon-[lucide--folder] size-4 shrink-0'
                  : 'icon-[lucide--file] size-4 shrink-0'
              "
            />
            <span class="truncate text-sm">{{ item.value.label }}</span>
          </TreeItem>
        </template>
      </Tree>
    `
  })
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Nested: Story = {
  args: { defaultExpanded: ['checkpoints', 'checkpoints/sdxl', 'loras'] }
}

export const Disabled: Story = {
  args: { disabled: true }
}
