<template>
  <div class="flex flex-col gap-6 p-6">
    <h2 class="text-lg font-semibold">
      {{ t('templatePublishing.steps.submissionForReview.title') }}
    </h2>
    <p class="text-muted-foreground">
      {{ t('templatePublishing.steps.submissionForReview.description') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
