<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { toValue } from 'vue'
import type { StyleValue } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

defineOptions({
  inheritAttrs: false
})

defineProps<{
  itemClass: string
  contentClass: string
  contentStyle?: StyleValue
  item: MenuItem
}>()
</script>
<template>
  <DropdownMenuSeparator
    v-if="item.separator"
    class="m-1 h-px bg-border-subtle"
  />
  <DropdownMenuSub v-else-if="item.items">
    <DropdownMenuSubTrigger
      :class="itemClass"
      :disabled="toValue(item.disabled) ?? !item.items?.length"
    >
      {{ item.label }}
      <i class="ml-auto icon-[lucide--chevron-right]" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :class="contentClass"
        :style="contentStyle"
        :aria-label="toValue(item.label)"
        :side-offset="12"
        :align-offset="-5"
      >
        <DropdownItem
          v-for="(subitem, index) in item.items"
          :key="toValue(subitem.label) ?? index"
          :item="subitem"
          :item-class
          :content-class
          :content-style
        />
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
  <DropdownMenuItem
    v-else
    v-tooltip="
      item.tooltip ? { value: String(item.tooltip), showDelay: 0 } : undefined
    "
    :class="
      cn(
        itemClass,
        String(item.class ?? ''),
        Boolean(item.tooltip) && toValue(item.disabled) && 'pointer-events-auto'
      )
    "
    v-bind="
      'checked' in item
        ? { role: 'menuitemradio', 'aria-checked': Boolean(item.checked) }
        : {}
    "
    :disabled="toValue(item.disabled) ?? !item.command"
    @select="item.command?.({ originalEvent: $event, item })"
  >
    <i v-if="'icon' in item" class="size-5 shrink-0" :class="item.icon" />
    <div class="mr-auto truncate" v-text="item.label" />
    <i v-if="item.checked" class="icon-[lucide--check] shrink-0" />
    <div
      v-else-if="item.new"
      class="flex shrink-0 items-center rounded-full bg-primary-background px-1 text-2xs leading-none font-bold"
      v-text="t('contextMenu.new')"
    />
  </DropdownMenuItem>
</template>
