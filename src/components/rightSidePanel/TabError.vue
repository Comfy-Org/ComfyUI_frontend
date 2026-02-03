<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import type { NodeError } from '@/schemas/apiSchema'
defineProps<{
  errors: NodeError[]
}>()
const { copyToClipboard } = useCopyToClipboard()
</script>
<template>
  <div class="m-4">
    <Button class="w-full" @click="copyToClipboard(JSON.stringify(errors))">
      {{ t('g.copy') }}
      <i class="icon-[lucide--copy] size-4" />
    </Button>
  </div>
  <div
    v-for="(error, index) in errors.flatMap((ne) => ne.errors)"
    :key="index"
    class="px-2"
  >
    <h3 class="text-error" v-text="error.message" />
    <div class="text-muted-foreground" v-text="error.details" />
  </div>
</template>
