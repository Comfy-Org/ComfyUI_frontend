<template>
  <div
    v-show="overlayWidth > 0"
    :class="['flex', 'justify-end', 'w-full', 'pointer-events-none']"
  >
    <div
      class="pointer-events-auto rounded-lg border border-[var(--p-panel-border-color)] bg-[var(--comfy-menu-bg)] shadow-md"
      :style="overlayStyle"
    >
      <div class="px-3 py-2 text-sm font-medium opacity-80">
        {{ t('sideToolbar.queueProgressOverlay.title') }}
      </div>
      <div class="px-3 pb-3 text-xs opacity-70">
        {{ t('sideToolbar.queueProgressOverlay.placeholder') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    minWidth?: number
  }>(),
  {
    minWidth: 240
  }
)
const { t } = useI18n()

const overlayWidth = computed(() => Math.max(0, Math.round(props.minWidth)))
const overlayStyle = computed(() => {
  const width = `${overlayWidth.value}px`
  return {
    minWidth: width,
    width
  }
})
</script>
