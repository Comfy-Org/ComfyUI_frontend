<template>
  <div class="flex min-w-0 flex-1 flex-col items-start">
    <div class="my-4 text-lg font-medium">
      {{ t('toastMessages.migrateToLitegraphReroute') }}
    </div>
    <Button class="self-end" size="sm" @click="migrateToLitegraphReroute">
      {{ t('g.migrate') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import type { ToastId } from '@/types/toastId'

const { onMigrate, toastId } = defineProps<{
  onMigrate: () => Promise<void>
  toastId: ToastId
}>()
const { t } = useI18n()
const toast = useToast()

const migrateToLitegraphReroute = async () => {
  await onMigrate()
  toast.dismiss(toastId)
}
</script>
