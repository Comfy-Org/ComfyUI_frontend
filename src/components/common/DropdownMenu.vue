<script setup lang="ts">
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import MenuItems from '@/components/ui/menu/MenuItems.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'
import { cn } from '@comfyorg/tailwind-utils'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'

defineOptions({
  inheritAttrs: false
})

const {
  itemClass: itemProp,
  contentClass: contentProp,
  modal = true
} = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  modal?: boolean
  itemClass?: string
  contentClass?: string
  buttonSize?: ButtonVariants['size']
  buttonClass?: string
}>()

const itemClass = computed(() =>
  cn(
    'm-1 flex cursor-pointer items-center-safe gap-1 rounded-lg p-2 leading-none data-disabled:pointer-events-none data-disabled:text-muted-foreground data-highlighted:bg-secondary-background-hover',
    itemProp
  )
)

const contentClass = computed(() =>
  cn(
    'z-1700 min-w-55 rounded-lg border border-border-subtle bg-base-background p-2 shadow-sm will-change-[opacity,transform] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
    contentProp
  )
)

const open = ref(false)
const contentStyle = useModalLiftedZIndex(open)
const { t } = useI18n()
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal>
    <DropdownMenuTrigger as-child>
      <slot name="button">
        <Button :size="buttonSize ?? 'icon'" :class="buttonClass">
          <i :class="icon ?? 'icon-[lucide--menu]'" />
        </Button>
      </slot>
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to>
      <DropdownMenuContent
        side="bottom"
        :side-offset="5"
        :collision-padding="10"
        v-bind="$attrs"
        :class="contentClass"
        :style="contentStyle"
      >
        <slot :item-class>
          <MenuItems
            :items="entries ?? []"
            :item-class
            :content-class
            :content-style
            disable-commandless
            legacy-checked-role
            separator-class="m-1 h-px bg-border-subtle"
          >
            <template #item="{ item, hasSubmenu }">
              <i v-if="item.icon" :class="item.icon" class="size-5 shrink-0" />
              <div class="mr-auto truncate">{{ toValue(item.label) }}</div>
              <i
                v-if="hasSubmenu"
                class="ml-auto icon-[lucide--chevron-right]"
              />
              <i
                v-else-if="toValue(item.checked)"
                class="icon-[lucide--check] shrink-0"
              />
              <div
                v-else-if="item.new"
                class="flex shrink-0 items-center rounded-full bg-primary-background px-1 text-2xs leading-none font-bold"
              >
                {{ t('contextMenu.new') }}
              </div>
            </template>
          </MenuItems>
        </slot>
        <DropdownMenuArrow class="fill-base-background stroke-border-subtle" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
