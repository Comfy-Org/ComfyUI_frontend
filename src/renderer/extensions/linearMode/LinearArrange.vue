<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div
    role="article"
    data-testid="linear-welcome"
    class="flex flex-col items-center justify-center h-full gap-6 p-8 max-w-lg mx-auto text-center"
  >
    <div class="flex flex-col gap-2">
      <h2 class="text-3xl font-semibold text-muted-foreground">
        {{ t('builderToolbar.arrange') }}
      </h2>
    </div>
  </div>
</template>
