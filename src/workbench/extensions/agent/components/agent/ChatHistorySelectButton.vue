<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Message from '@comfyorg/design-system/message/Message'

const {
  title,
  loading = false,
  failed = false
} = defineProps<{
  title: string
  loading?: boolean
  failed?: boolean
}>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
const displayTitle = computed(() => title.trim() || t('agent.untitledChat'))
const errorId = useId()
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <Button
      type="button"
      variant="muted-textonly"
      size="sm"
      :aria-busy="loading"
      :aria-label="displayTitle"
      :aria-describedby="failed ? errorId : undefined"
      :disabled="loading"
      class="min-w-0 justify-start text-left"
      @click="emit('select')"
    >
      <i
        v-if="loading"
        aria-hidden="true"
        class="icon-[lucide--loader-circle] animate-spin"
      />
      <i v-else aria-hidden="true" class="icon-[lucide--circle-check]" />
      <span class="truncate">{{ displayTitle }}</span>
    </Button>
    <span v-if="loading" role="status" class="sr-only">{{
      t('g.loading')
    }}</span>
    <Message
      v-if="failed"
      :id="errorId"
      severity="error"
      class="mt-1 whitespace-normal"
    >
      {{ t('agent.historyOpenFailed') }}
    </Message>
  </div>
</template>
