<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { canRevert } = defineProps<{ canRevert: boolean }>()
const emit = defineEmits<{ revert: [] }>()

const { t } = useI18n()
</script>

<template>
  <Button
    size="md"
    variant="textonly"
    class="border-agent-border focus-visible:ring-agent-accent rounded-xl border border-solid px-3 text-sm focus-visible:ring-2"
    :disabled="!canRevert"
    @click="emit('revert')"
  >
    <span class="icon-[lucide--undo-2] size-4" />
    {{ t('agent.revert') }}
  </Button>
</template>
