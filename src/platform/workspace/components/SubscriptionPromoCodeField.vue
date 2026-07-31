<template>
  <div class="flex flex-col gap-2">
    <Button
      v-if="!isOpen"
      variant="secondary"
      size="lg"
      class="self-start"
      @click="open"
    >
      {{ $t('subscription.preview.addPromoCode') }}
    </Button>
    <div v-else class="flex gap-2">
      <Input
        ref="inputRef"
        v-model="code"
        class="min-w-0 flex-1"
        :placeholder="$t('subscription.preview.promotionCodePlaceholder')"
        autocomplete="off"
        :disabled="isLoading"
        @keydown.enter="apply"
      />
      <Button
        variant="secondary"
        :loading="isLoading"
        :disabled="!code.trim()"
        @click="apply"
      >
        {{ $t('subscription.preview.applyPromoCode') }}
      </Button>
    </div>
    <span v-if="error" class="text-sm text-destructive-background">
      {{ error }}
    </span>
    <span v-else-if="appliedCode" class="text-success-foreground text-sm">
      {{ $t('subscription.success.promoApplied', { code: appliedCode }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const {
  appliedCode = '',
  error = null,
  isLoading = false
} = defineProps<{
  appliedCode?: string
  error?: string | null
  isLoading?: boolean
}>()

const emit = defineEmits<{
  apply: [code: string]
}>()

const isOpen = ref(Boolean(appliedCode))
const code = ref(appliedCode)
const inputRef = ref<InstanceType<typeof Input>>()

watch(
  () => appliedCode,
  (value) => {
    code.value = value
    if (value) isOpen.value = true
  }
)

function open() {
  isOpen.value = true
  void nextTick(() => {
    const el = inputRef.value?.$el
    if (el instanceof HTMLInputElement) el.focus()
  })
}

function apply() {
  const normalized = code.value.trim()
  if (normalized) emit('apply', normalized)
}
</script>
