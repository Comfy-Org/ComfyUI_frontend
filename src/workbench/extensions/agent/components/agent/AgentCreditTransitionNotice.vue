<script setup lang="ts">
import { onMounted } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Message from '@comfyorg/design-system/message/Message'

const emit = defineEmits<{ dismiss: []; shown: [] }>()

onMounted(() => emit('shown'))
</script>

<template>
  <Message severity="warning" role="status" aria-live="polite">
    <template #icon>
      <i
        aria-hidden="true"
        class="icon-[heroicons--information-circle-20-solid] block size-5 text-warning"
      />
    </template>
    <div class="flex items-start gap-2">
      <p class="my-0 min-w-0 flex-1">
        {{ $t('agent.creditTransitionNotice') }}
      </p>
      <Button
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="$t('agent.dismiss')"
        class="shrink-0"
        @click="emit('dismiss')"
      >
        <i aria-hidden="true" class="icon-[lucide--x] size-5" />
      </Button>
    </div>
  </Message>
</template>
