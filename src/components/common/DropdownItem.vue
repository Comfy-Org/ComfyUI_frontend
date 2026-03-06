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

const { t } = useI18n()

defineOptions({
  inheritAttrs: false
})

defineProps<{ itemClass: string; contentClass: string; item: MenuItem }>()
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
        :side-offset="2"
        :align-offset="-5"
      >
        <DropdownItem
          v-for="(subitem, index) in item.items"
          :key="toValue(subitem.label) ?? index"
          :item="subitem"
          :item-class
          :content-class
        />
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
  <DropdownMenuItem
    v-else
    :class="itemClass"
    :disabled="toValue(item.disabled) ?? !item.command"
    @select="item.command?.({ originalEvent: $event, item })"
  >
    <i class="size-5" :class="item.icon" />
    {{ item.label }}
    <div
      v-if="item.new"
      class="ml-auto flex items-center rounded-full bg-primary-background px-1 text-xxs leading-none font-bold"
      v-text="t('contextMenu.new')"
    />
  </DropdownMenuItem>
</template>
