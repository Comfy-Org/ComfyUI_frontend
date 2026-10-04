<script setup lang="ts">
import { DropdownMenuArrow } from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuItems from '@/components/ui/menu/MenuItems.vue'
import type { MenuItem } from '@/components/ui/menu/types'

defineOptions({
  inheritAttrs: false
})

const { modal = true } = defineProps<{
  entries?: MenuItem[]
  icon?: string
  to?: string | HTMLElement
  modal?: boolean
}>()

const open = ref(false)
const { t } = useI18n()
</script>

<template>
  <Menu
    v-model:open="open"
    :modal
    :to
    side="bottom"
    align="center"
    :side-offset="5"
    :collision-padding="10"
    v-bind="$attrs"
  >
    <template #trigger>
      <slot name="button">
        <Button
          size="icon"
          :icon="icon ?? 'icon-[lucide--menu]'"
          :aria-label="t('g.more')"
        />
      </slot>
    </template>

    <template #default="{ contentStyle }">
      <MenuItems
        :items="entries ?? []"
        :content-style
        disable-commandless
        legacy-checked-role
        @select="open = false"
      />
      <DropdownMenuArrow class="fill-base-background stroke-border-default" />
    </template>
  </Menu>
</template>
