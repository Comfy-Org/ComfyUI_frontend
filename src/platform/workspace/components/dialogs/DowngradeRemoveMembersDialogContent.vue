<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('subscription.downgrade.title', { plan: planName }) }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        :disabled="isLoading"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-4 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('subscription.downgrade.body') }}
      </p>
      <label class="flex flex-col gap-2 text-sm text-muted-foreground">
        {{ $t('subscription.downgrade.confirmationPrompt', { phrase }) }}
        <Input
          v-model="typedValue"
          type="text"
          :placeholder="phrase"
          :disabled="isLoading"
          autofocus
          @keyup.enter="onConfirmDowngrade"
        />
      </label>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" :disabled="isLoading" @click="onClose">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="destructive"
        size="lg"
        :disabled="!isConfirmed"
        :loading="isLoading"
        @click="onConfirmDowngrade"
      >
        {{ $t('subscription.downgrade.confirm') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { useDialogStore } from '@/stores/dialogStore'

const { planName, planSlug, onConfirm } = defineProps<{
  planName: string
  planSlug: string
  onConfirm: (planSlug: string) => Promise<void>
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()

const phrase = t('subscription.downgrade.confirmationPhrase')

const typedValue = ref('')
const isLoading = ref(false)

const isConfirmed = computed(() => typedValue.value === phrase)

function onClose() {
  if (isLoading.value) return
  dialogStore.closeDialog({ key: 'downgrade-remove-members' })
}

async function onConfirmDowngrade() {
  if (!isConfirmed.value || isLoading.value) return
  isLoading.value = true
  try {
    await onConfirm(planSlug)
    dialogStore.closeDialog({ key: 'downgrade-remove-members' })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('subscription.downgrade.failed'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
  } finally {
    isLoading.value = false
  }
}
</script>
