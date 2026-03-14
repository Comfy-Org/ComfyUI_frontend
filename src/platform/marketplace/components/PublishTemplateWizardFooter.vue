<template>
  <footer
    class="sticky inset-x-0 bottom-0 z-10 flex flex-col gap-3 bg-base-background px-6 pt-4"
    style="margin-left: calc(-1.5rem); margin-right: calc(-1.5rem)"
  >
    <div
      v-if="error"
      class="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm"
    >
      {{ error }}
    </div>
    <div class="flex w-full justify-end">
      <template v-if="readOnly">
        <div class="flex items-center gap-2">
          <Button
            v-if="currentStep === 2"
            data-testid="btn-back"
            variant="secondary"
            @click="$emit('back')"
          >
            {{ $t('marketplace.back') }}
          </Button>
          <Button
            v-if="currentStep === 1"
            data-testid="btn-preview"
            variant="secondary"
            @click="$emit('preview')"
          >
            {{ $t('marketplace.preview') }}
          </Button>
          <Button data-testid="btn-done" @click="$emit('close')">
            {{ $t('marketplace.done') }}
          </Button>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center gap-2">
          <Button
            v-if="currentStep > 1"
            data-testid="btn-back"
            variant="secondary"
            @click="$emit('back')"
          >
            {{ $t('marketplace.back') }}
          </Button>
          <Button
            v-if="currentStep < 2"
            data-testid="btn-next"
            :disabled="!canAdvance"
            @click="$emit('next')"
          >
            {{ $t('marketplace.next') }}
          </Button>
          <Button
            v-if="currentStep === 2 && !submitted && isPendingReview"
            data-testid="btn-done"
            @click="$emit('close')"
          >
            {{ $t('marketplace.done') }}
          </Button>
          <Button
            v-if="currentStep === 2 && !submitted && !isPendingReview"
            data-testid="btn-submit"
            :disabled="!canSubmit"
            @click="$emit('submit')"
          >
            {{
              isPublishing
                ? $t('marketplace.submitting')
                : $t('marketplace.submitForReview')
            }}
          </Button>
        </div>
      </template>
    </div>
  </footer>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  error: string | null
  readOnly: boolean
  currentStep: number
  submitted: boolean
  isPendingReview: boolean
  canAdvance: boolean
  canSubmit: boolean
  isPublishing: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'back'): void
  (e: 'next'): void
  (e: 'preview'): void
  (e: 'submit'): void
}>()
</script>
