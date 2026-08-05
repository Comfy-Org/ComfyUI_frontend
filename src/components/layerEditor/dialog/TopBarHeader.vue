<template>
  <div class="flex w-full items-center gap-2">
    <i class="icon-[lucide--layers-2] size-4" />
    <h3 class="m-0 text-sm font-semibold">{{ t('layerEditor.title') }}</h3>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
