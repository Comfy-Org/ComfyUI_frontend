<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '../../ui/Button.vue'

const { canRevert } = defineProps<{ canRevert: boolean }>()
const emit = defineEmits<{ revert: [] }>()

const { t } = useI18n()
</script>

<template>
  <Button
    size="sm"
    variant="outline"
    :disabled="!canRevert"
    @click="emit('revert')"
  >
    <span class="icon-[lucide--undo-2] size-4" />
    {{ t('agent.revert') }}
  </Button>
</template>
