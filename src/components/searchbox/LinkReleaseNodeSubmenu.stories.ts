import type { Meta, StoryObj } from '@storybook/vue3-vite'

import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

import LinkReleaseNodeSubmenu from './LinkReleaseNodeSubmenu.vue'
import type { LinkReleaseNodeCategory } from './linkReleaseMenuModel'

const contentClass =
  'z-1700 flex max-h-[min(80vh,var(--reka-dropdown-menu-content-available-height))] min-w-[260px] max-w-sm flex-col overflow-hidden rounded-lg border border-interface-menu-stroke bg-interface-menu-surface p-1 shadow-interface'
const submenuContentClass =
  'z-1700 flex w-sm max-h-[min(80vh,var(--reka-dropdown-menu-content-available-height))] flex-col overflow-hidden rounded-lg border border-interface-menu-stroke bg-interface-menu-surface p-1 shadow-interface'
const submenuScrollClass =
  'overflow-y-auto scrollbar-custom max-h-[min(calc(var(--reka-dropdown-menu-content-available-height)-3.5rem),80vh)]'
const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-base-foreground outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-interface-menu-component-surface-hovered'

function node(name: string, display_name = name): ComfyNodeDefImpl {
  return { name, display_name } as ComfyNodeDefImpl
}

const category: LinkReleaseNodeCategory = {
  key: 'comfy',
  labelKey: 'contextMenu.Comfy Nodes',
  icon: 'icon-[lucide--box]',
  nodes: [
    node('KSampler'),
    node('VAEDecode', 'VAE Decode'),
    node('VAEEncode', 'VAE Encode'),
    node('CLIPTextEncode', 'CLIP Text Encode'),
    node('LoadImage', 'Load Image'),
    node('SaveImage', 'Save Image'),
    node('EmptyLatentImage', 'Empty Latent Image'),
    node(
      'StableCascade_StageB_Conditioning',
      'StableCascade_StageB_Conditioning'
    )
  ]
}

const meta: Meta<typeof LinkReleaseNodeSubmenu> = {
  title: 'Components/Searchbox/LinkReleaseNodeSubmenu',
  component: LinkReleaseNodeSubmenu
}

export default meta
type Story = StoryObj<typeof meta>

function renderAnchored(side: 'left' | 'right'): Story['render'] {
  return () => ({
    components: {
      DropdownMenuRoot,
      DropdownMenuTrigger,
      DropdownMenuPortal,
      DropdownMenuContent,
      DropdownMenuLabel,
      LinkReleaseNodeSubmenu
    },
    setup() {
      const anchorStyle =
        side === 'right'
          ? 'position: fixed; top: 64px; right: 16px;'
          : 'position: fixed; top: 64px; left: 16px;'
      return {
        anchorStyle,
        contentClass,
        submenuContentClass,
        submenuScrollClass,
        itemClass,
        category,
        side
      }
    },
    template: `
      <div style="height: 480px;">
        <DropdownMenuRoot default-open>
          <DropdownMenuTrigger as-child>
            <button :style="anchorStyle" class="rounded-md border border-interface-menu-stroke bg-interface-menu-surface px-3 py-1.5 text-sm text-base-foreground">
              Compatible Nodes
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              :class="contentClass"
              :side="side === 'right' ? 'bottom' : 'bottom'"
              :align="side === 'right' ? 'end' : 'start'"
              :side-offset="4"
            >
              <DropdownMenuLabel class="block truncate px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase">
                Compatible Nodes
              </DropdownMenuLabel>
              <LinkReleaseNodeSubmenu
                :category="category"
                :item-class="itemClass"
                :content-class="submenuContentClass"
                :scroll-class="submenuScrollClass"
              />
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    `
  })
}

/** Anchored near the LEFT edge: the submenu opens to the RIGHT (normal). */
export const OpensRight: Story = { render: renderAnchored('left') }

/**
 * Anchored near the RIGHT edge: with no room on the right, Floating UI flips the
 * submenu to the LEFT, landing flush against the parent menu's left edge.
 */
export const FlipsLeft: Story = { render: renderAnchored('right') }
