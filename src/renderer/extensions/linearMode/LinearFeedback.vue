<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TypeformPopoverButton from '@/components/ui/TypeformPopoverButton.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { cn } from '@/utils/tailwindUtil'

const { side, widgetId } = defineProps<{
  side: 'left' | 'right'
  widgetId: string
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const sidebarOnLeft = computed(
  () => settingStore.get('Comfy.Sidebar.Location') === 'left'
)
const visible = computed(() => sidebarOnLeft.value === (side === 'left'))
</script>
<template>
  <div
    :class="
      cn(
        'flex items-center gap-2 self-end px-4 pb-4 text-nowrap text-base-foreground',
        side === 'right' && 'flex-row-reverse',
        !visible && 'invisible'
      )
    "
    :aria-hidden="!visible || undefined"
  >
    <TypeformPopoverButton
      :active="visible"
      :data-tf-widget="widgetId"
      :align="side === 'left' ? 'start' : 'end'"
    />
    <div class="flex flex-col text-sm text-muted-foreground">
      <span>{{ t('linearMode.beta') }}</span>
      <span>{{ t('linearMode.giveFeedback') }}</span>
    </div>
  </div>
</template>
