import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import ContextMenu from '@/components/ui/context-menu/ContextMenu.vue'
import ContextMenuContent from '@/components/ui/context-menu/ContextMenuContent.vue'
import ContextMenuItem from '@/components/ui/context-menu/ContextMenuItem.vue'
import ContextMenuSeparator from '@/components/ui/context-menu/ContextMenuSeparator.vue'
import ContextMenuShortcut from '@/components/ui/context-menu/ContextMenuShortcut.vue'
import ContextMenuSub from '@/components/ui/context-menu/ContextMenuSub.vue'
import ContextMenuSubContent from '@/components/ui/context-menu/ContextMenuSubContent.vue'
import ContextMenuSubTrigger from '@/components/ui/context-menu/ContextMenuSubTrigger.vue'
import ContextMenuTrigger from '@/components/ui/context-menu/ContextMenuTrigger.vue'
import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuCheckboxItem from '@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuLabel from '@/components/ui/dropdown-menu/DropdownMenuLabel.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuShortcut from '@/components/ui/dropdown-menu/DropdownMenuShortcut.vue'
import DropdownMenuSub from '@/components/ui/dropdown-menu/DropdownMenuSub.vue'
import DropdownMenuSubContent from '@/components/ui/dropdown-menu/DropdownMenuSubContent.vue'
import DropdownMenuSubTrigger from '@/components/ui/dropdown-menu/DropdownMenuSubTrigger.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'

const meta: Meta = {
  title: 'Components/Menu/Menu',
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'inline-radio' },
      options: ['default', 'lg'],
      description:
        'Menu density. "default" = 28px rows / 12px text / 14px icons. "lg" = 32px rows / 14px text / 16px icons.'
    }
  },
  args: { size: 'default' }
}

export default meta
type Story = StoryObj

export const Default: Story = {
  render: (args) => ({
    components: {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      DropdownMenuShortcut,
      Button
    },
    setup: () => ({ args }),
    template: `
      <div class="flex h-72 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent :size="args.size">
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--copy]" /></template>
              Copy
              <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--clipboard-paste]" /></template>
              Paste
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--trash-2]" /></template>
              Delete
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `
  })
}

export const Disabled: Story = {
  render: (args) => ({
    components: {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      Button
    },
    setup: () => ({ args }),
    template: `
      <div class="flex h-72 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent :size="args.size">
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--copy]" /></template>
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <template #icon><i class="icon-[lucide--clipboard-paste]" /></template>
              Paste (disabled)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <template #icon><i class="icon-[lucide--trash-2]" /></template>
              Delete (disabled)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `
  })
}

export const ContextMenuOnAssetCard: Story = {
  render: (args) => ({
    setup() {
      return { args }
    },
    components: {
      ContextMenu,
      ContextMenuTrigger,
      ContextMenuContent,
      ContextMenuItem,
      ContextMenuSeparator,
      ContextMenuShortcut,
      ContextMenuSub,
      ContextMenuSubTrigger,
      ContextMenuSubContent
    },
    template: `
      <div class="flex h-72 items-center justify-center">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <button
              type="button"
              class="flex h-40 w-56 cursor-context-menu items-center justify-center rounded-lg border border-border-subtle bg-secondary-background text-sm text-text-subtle"
            >
              Right-click here
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent :size="args.size">
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--zoom-in] size-4" /></template>
              Inspect asset
              <ContextMenuShortcut>Ctrl+S</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--info] size-4" /></template>
              Show details
              <ContextMenuShortcut>i</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--star] size-4" /></template>
              Favorite
            </ContextMenuItem>
            <ContextMenuItem>Rename</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <template #icon><i class="icon-[lucide--tag] size-4" /></template>
                Add tags
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>portrait</ContextMenuItem>
                <ContextMenuItem>landscape</ContextMenuItem>
                <ContextMenuItem>archived</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--download] size-4" /></template>
              Download
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--workflow] size-4" /></template>
              Open as workflow
            </ContextMenuItem>
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--file-output] size-4" /></template>
              Export workflow
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <template #icon><i class="icon-[lucide--trash-2] size-4" /></template>
              Delete asset
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    `
  })
}

export const DropdownMenuFromMoreButton: Story = {
  render: (args) => ({
    components: {
      Button,
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuLabel,
      DropdownMenuSeparator,
      DropdownMenuShortcut
    },
    setup() {
      return { args }
    },
    template: `
      <div class="flex h-72 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <i class="icon-[lucide--more-horizontal] size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" :size="args.size">
            <DropdownMenuLabel>Asset actions</DropdownMenuLabel>
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--copy] size-4" /></template>
              Duplicate
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--download] size-4" /></template>
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <template #icon><i class="icon-[lucide--trash-2] size-4" /></template>
              Delete
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `
  })
}

export const DropdownMenuWithCheckboxes: Story = {
  render: (args) => ({
    components: {
      Button,
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuCheckboxItem,
      DropdownMenuLabel,
      DropdownMenuSeparator
    },
    setup() {
      const showFavorites = ref(true)
      const showArchived = ref(false)
      const showShared = ref(false)
      return { args, showFavorites, showArchived, showShared }
    },
    template: `
      <div class="flex h-72 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="sm">Filter</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :size="args.size">
            <DropdownMenuLabel>Show</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem v-model:checked="showFavorites">
              Favorites
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem v-model:checked="showArchived">
              Archived
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem v-model:checked="showShared">
              Shared with me
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `
  })
}

export const DropdownMenuNoIcons: Story = {
  render: (args) => ({
    components: {
      Button,
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      DropdownMenuShortcut
    },
    setup() {
      return { args }
    },
    template: `
      <div class="flex h-72 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="secondary" size="sm">Sort by</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :size="args.size">
            <DropdownMenuItem>Name</DropdownMenuItem>
            <DropdownMenuItem>Date created</DropdownMenuItem>
            <DropdownMenuItem>Date modified</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Reverse order
              <DropdownMenuShortcut>R</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    `
  })
}

export const SizeComparison: Story = {
  parameters: { controls: { exclude: ['size'] } },
  render: () => ({
    components: {
      DropdownMenu,
      DropdownMenuTrigger,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuSeparator,
      DropdownMenuShortcut,
      DropdownMenuSub,
      DropdownMenuSubTrigger,
      DropdownMenuSubContent,
      Button
    },
    template: `
      <div class="grid grid-cols-2 gap-12 p-8">
        <div class="flex flex-col items-center gap-3">
          <div class="text-sm font-medium text-text-subtle">default — 28px / 12px / 14px</div>
          <DropdownMenu :default-open="true" :modal="false">
            <DropdownMenuTrigger as-child>
              <Button variant="secondary" size="sm">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" size="default" :force-mount="true">
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--zoom-in]" /></template>
                Inspect asset
                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--star]" /></template>
                Favorite
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <template #icon><i class="icon-[lucide--tag]" /></template>
                  Add tags
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>portrait</DropdownMenuItem>
                  <DropdownMenuItem>landscape</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--download]" /></template>
                Download
              </DropdownMenuItem>
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--trash-2]" /></template>
                Delete
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div class="flex flex-col items-center gap-3">
          <div class="text-sm font-medium text-text-subtle">lg — 32px / 14px / 16px</div>
          <DropdownMenu :default-open="true" :modal="false">
            <DropdownMenuTrigger as-child>
              <Button variant="secondary" size="sm">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" size="lg" :force-mount="true">
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--zoom-in]" /></template>
                Inspect asset
                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--star]" /></template>
                Favorite
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <template #icon><i class="icon-[lucide--tag]" /></template>
                  Add tags
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>portrait</DropdownMenuItem>
                  <DropdownMenuItem>landscape</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--download]" /></template>
                Download
              </DropdownMenuItem>
              <DropdownMenuItem>
                <template #icon><i class="icon-[lucide--trash-2]" /></template>
                Delete
                <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    `
  })
}
