<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { StyleValue } from 'vue'

import MenuItems from '@/components/ui/menu/MenuItems.vue'
import type { MenuItem } from '@/components/ui/menu/types'

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
  <MenuItems
    :items="[item]"
    :item-class
    :content-class
    :content-style
    disable-commandless
    legacy-checked-role
    separator-class="m-1 h-px bg-border-subtle"
  >
    <template #item="{ item: renderedItem, hasSubmenu }">
      <i
        v-if="renderedItem.icon"
        class="size-5 shrink-0"
        :class="renderedItem.icon"
      />
      <div class="mr-auto truncate">{{ renderedItem.label }}</div>
      <i v-if="hasSubmenu" class="ml-auto icon-[lucide--chevron-right]" />
      <i
        v-else-if="renderedItem.checked"
        class="icon-[lucide--check] shrink-0"
      />
      <div
        v-else-if="renderedItem.new"
        class="flex shrink-0 items-center rounded-full bg-primary-background px-1 text-2xs leading-none font-bold"
      >
        {{ t('contextMenu.new') }}
      </div>
    </template>
  </MenuItems>
</template>
