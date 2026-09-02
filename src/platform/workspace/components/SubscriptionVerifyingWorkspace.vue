<template>
  <div class="flex h-full flex-col px-10 pt-10 pb-4">
    <div
      class="flex flex-1 flex-col items-center justify-center gap-3 text-center"
    >
      <i
        class="icon-[lucide--shield-alert] size-10 shrink-0 text-muted-foreground"
      />
      <h2 class="m-0 text-2xl font-semibold text-base-foreground">
        {{ $t('subscription.preview.verifyTitle') }}
      </h2>
      <p class="m-0 max-w-80 text-sm text-muted-foreground">
        {{
          verificationOpened
            ? $t('subscription.preview.verifyOpenedBody')
            : $t('subscription.preview.verifyBody')
        }}
      </p>
    </div>

    <div class="flex flex-col gap-2 pb-4">
      <Button
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :disabled="!actionUrl"
        :aria-label="$t('subscription.preview.completeVerification')"
        @click="openVerification"
      >
        <i
          v-if="verificationOpened || !actionUrl"
          class="icon-[lucide--loader-circle] size-4 animate-spin"
        />
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

      <p
        v-if="cancelUnavailable"
        class="m-0 py-2 text-center text-xs text-muted-foreground"
      >
        {{ $t('billingOperation.cancelUnavailable') }}
      </p>
      <template v-else>
        <p
          v-if="cancelUnreachable"
          class="m-0 pt-2 text-center text-xs text-muted-foreground"
        >
          {{ $t('billingOperation.cancelUnreachable') }}
        </p>
        <Button
          variant="muted-textonly"
          size="lg"
          class="w-full"
          :loading="isCanceling"
          @click="$emit('cancelPayment')"
        >
          {{ $t('billingOperation.cancelPayment') }}
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  actionUrl = null,
  cancelUnavailable = false,
  cancelUnreachable = false,
  isCanceling = false
} = defineProps<{
  actionUrl?: string | null
  cancelUnavailable?: boolean
  cancelUnreachable?: boolean
  isCanceling?: boolean
}>()

defineEmits<{
  cancelPayment: []
}>()

const verificationOpened = ref(false)

function openVerification() {
  if (!actionUrl) return
  const opened = window.open(actionUrl, '_blank', 'noopener,noreferrer')
  if (opened) verificationOpened.value = true
}
</script>
