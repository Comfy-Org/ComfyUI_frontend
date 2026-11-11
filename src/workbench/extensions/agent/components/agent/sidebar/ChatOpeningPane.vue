<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

const { status, title } = defineProps<{
  status: 'loading' | 'failed'
  title: string
}>()

const emit = defineEmits<{
  retry: []
  back: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    data-testid="agent-chat-opening"
    class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
  >
    <template v-if="status === 'loading'">
      <i
        aria-hidden="true"
        class="icon-[lucide--loader-circle] size-5 text-muted-foreground motion-safe:animate-spin"
      />
      <p role="status" class="my-0 text-sm text-muted-foreground">
        {{ t('agent.sidebar.opening', { title }) }}
      </p>
    </template>
    <template v-else>
      <p role="alert" class="my-0 text-sm text-foreground">
        {{ t('agent.sidebar.openFailed') }}
      </p>
      <div class="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          @click="emit('retry')"
        >
          {{ t('agent.sidebar.tryAgain') }}
        </Button>
        <Button
          type="button"
          variant="muted-textonly"
          size="md"
          @click="emit('back')"
        >
          {{ t('agent.backToPreviousChat') }}
        </Button>
      </div>
    </template>
  </div>
</template>
