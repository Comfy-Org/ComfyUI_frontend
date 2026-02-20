<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { useI18n } from 'vue-i18n'

export type Entry =
  | { separator: true; label?: never }
  | { separator?: undefined; label: string; submenu: Entry[] }
  | {
      separator?: undefined
      submenu?: undefined
      label: string
      icon?: string
      new?: boolean
      command?: () => void
    }

const { t } = useI18n()

defineOptions({
  inheritAttrs: false
})

defineProps<{ itemClass: string; contentClass: string; entry: Entry }>()
</script>
<template>
  <DropdownMenuSeparator
    v-if="entry.separator"
    class="h-[1px] bg-border-subtle m-1"
  />
  <DropdownMenuSub v-else-if="entry.submenu">
    <DropdownMenuSubTrigger :class="itemClass">
      {{ entry.label }}
      <i class="ml-auto icon-[lucide--chevron-right]" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        :class="contentClass"
        :side-offset="2"
        :align-offset="-5"
      >
        <DropdownItem
          v-for="(subentry, index) in entry.submenu"
          :key="entry.label ?? index"
          :entry="subentry"
          :item-class
          :content-class
        />
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
  <DropdownMenuItem v-else :class="itemClass" @select="entry.command">
    <i class="size-5" :class="entry.icon" />
    {{ entry.label }}
    <div
      v-if="entry.new"
      class="ml-auto bg-primary-background rounded-full text-xxs font-bold px-1 flex leading-none items-center"
      v-text="t('NEW')"
    />
  </DropdownMenuItem>
</template>
