<template>
  <Button
    v-tooltip.bottom="isAllCollapsed ? t('g.expandAll') : t('g.collapseAll')"
    :aria-label="isAllCollapsed ? t('g.expandAll') : t('g.collapseAll')"
    variant="textonly"
    size="icon-sm"
    class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground"
    @click="toggle"
  >
    <i
      :class="
        cn(
          'size-4',
          isAllCollapsed
            ? 'icon-[lucide--list-tree]'
            : 'icon-[lucide--list-collapse]'
        )
      "
    />
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const isAllCollapsed = defineModel<boolean>({ required: true })

function toggle() {
  isAllCollapsed.value = !isAllCollapsed.value
}
</script>
