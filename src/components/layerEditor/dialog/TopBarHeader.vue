<template>
  <div class="flex w-full items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <i class="icon-[lucide--layers-2] size-4" />
      <h3 class="m-0 text-sm font-semibold">{{ t('layerEditor.title') }}</h3>
    </div>
    <div
      id="layer-editor-header-actions"
      class="flex items-center gap-2"
      role="group"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
