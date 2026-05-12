import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

import type { DropdownItemShape } from '@/base/remote/itemSchema'

import Content from './Content.vue'
import Empty from './Empty.vue'
import ErrorAtom from './Error.vue'
import Item from './Item.vue'
import LayoutSwitcher from './LayoutSwitcher.vue'
import List from './List.vue'
import Loading from './Loading.vue'
import Refresh from './Refresh.vue'
import Root from './Root.vue'
import Search from './Search.vue'
import Trigger from './Trigger.vue'
import type { RemoteComboContext } from './state'

const sampleItems: DropdownItemShape[] = [
  { id: 'voice-1', name: 'Aria', description: 'Soft, warm female voice' },
  { id: 'voice-2', name: 'Roger', description: 'Deep, narrator male voice' },
  { id: 'voice-3', name: 'Sarah', description: 'Bright, youthful' },
  { id: 'voice-4', name: 'Charlie', description: 'Calm, professional' },
  { id: 'voice-5', name: 'George', description: 'Casual, friendly' }
]

interface StoryArgs {
  isLoading: boolean
  hasError: boolean
  items: DropdownItemShape[]
  selected?: string
}

function makeContext(args: StoryArgs): RemoteComboContext {
  const isOpen = ref(false)
  const searchQuery = ref('')
  const selectedValue = ref(args.selected) as Ref<string | undefined>
  const items = computed(() => args.items)
  const filteredItems = computed(() =>
    searchQuery.value
      ? items.value.filter((it) =>
          it.name.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
      : items.value
  )
  return {
    isOpen,
    searchQuery,
    selectedValue,
    items,
    filteredItems,
    isLoading: computed(() => args.isLoading),
    isFetching: computed(() => args.isLoading),
    errorMessage: computed(() =>
      args.hasError ? 'Failed to load options' : null
    ),
    refresh: async () => {},
    select: (id) => {
      selectedValue.value = id
      isOpen.value = false
    },
    fieldLabel: computed(() => 'voice')
  }
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RemoteCombo',
  argTypes: {
    isLoading: { control: 'boolean' },
    hasError: { control: 'boolean' }
  },
  args: {
    isLoading: false,
    hasError: false,
    items: sampleItems,
    selected: undefined
  },
  parameters: {
    docs: {
      description: {
        component:
          'Atomized remote-populated combo widget. Compose Root → Trigger + Content (Search, List/Item, Loading, Empty, Error) and an optional Refresh sibling.'
      }
    }
  }
}

export default meta
type Story = StoryObj<StoryArgs>

const renderTemplate = (args: StoryArgs) => ({
  components: {
    Root,
    Trigger,
    Content,
    Search,
    List,
    Item,
    Empty,
    Loading,
    ErrorAtom,
    Refresh,
    LayoutSwitcher
  },
  setup() {
    const ctx = makeContext(args)
    return { ctx, args }
  },
  template: `
    <div class="flex w-72 items-center gap-1">
      <Root :context="ctx" class="min-w-0 flex-1">
        <Trigger class="min-w-0 flex-1" />
        <Content>
          <Search />
          <Loading v-if="args.isLoading" />
          <ErrorAtom v-else-if="args.hasError" />
          <List v-else>
            <Item v-for="(item, index) in ctx.filteredItems.value" :key="item.id" :item="item" :index="index" />
            <Empty v-if="ctx.filteredItems.value.length === 0" />
          </List>
        </Content>
      </Root>
      <Refresh :context="ctx" />
    </div>
  `
})

export const Default: Story = {
  render: renderTemplate
}

export const LoadingState: Story = {
  args: { isLoading: true, items: [] },
  render: renderTemplate
}

export const ErrorState: Story = {
  args: { hasError: true, items: [] },
  render: renderTemplate
}

export const EmptyState: Story = {
  args: { items: [] },
  render: renderTemplate
}

export const WithSelection: Story = {
  args: { selected: 'voice-2' },
  render: renderTemplate
}

export const KeyboardA11y: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tab to focus trigger; Enter/Space opens; Arrow keys navigate; Enter selects; Escape closes. Demonstrates the reka-ui Combobox keyboard contract.'
      }
    }
  },
  render: renderTemplate
}
