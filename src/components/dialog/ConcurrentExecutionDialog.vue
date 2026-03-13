<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('concurrentExecution.onboarding.title')"
    modal
    :closable="true"
    :draggable="false"
    class="max-w-md"
  >
    <p class="text-sm text-muted-color">
      {{ $t('concurrentExecution.onboarding.description') }}
    </p>
    <template #footer>
      <Button autofocus @click="dismiss">
        {{ $t('concurrentExecution.onboarding.gotIt') }}
      </Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useConcurrentExecution } from '@/composables/useConcurrentExecution'

const { isConcurrentExecutionEnabled, hasSeenOnboarding, markOnboardingSeen } =
  useConcurrentExecution()

const dismissed = ref(false)

const visible = computed({
  get: () =>
    isConcurrentExecutionEnabled.value &&
    !hasSeenOnboarding.value &&
    !dismissed.value,
  set: () => {
    dismissed.value = true
  }
})

async function dismiss() {
  await markOnboardingSeen()
  dismissed.value = true
}
</script>
