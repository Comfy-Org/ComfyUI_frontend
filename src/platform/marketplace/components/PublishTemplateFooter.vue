<template>
  <div class="flex justify-between border-t border-border-default px-6 py-4">
    <Button
      v-if="currentStep === 1"
      variant="secondary"
      size="lg"
      @click="emit('cancel')"
    >
      {{ t('templateWorkflows.publish.cancel') }}
    </Button>

    <Button v-else variant="secondary" size="lg" @click="emit('back')">
      <i class="icon-[lucide--arrow-left] size-4" />
      {{ t('templateWorkflows.publish.back') }}
    </Button>

    <div class="flex gap-2">
      <Button
        v-if="isDraft"
        variant="secondary"
        size="lg"
        :loading="isSaving"
        @click="emit('save')"
      >
        {{
          isExisting
            ? t('templateWorkflows.publish.updateDraft')
            : t('templateWorkflows.publish.saveDraft')
        }}
      </Button>

      <Button
        v-if="currentStep < 3"
        variant="primary"
        size="lg"
        @click="emit('next')"
      >
        {{ t('templateWorkflows.publish.next') }}
        <i class="icon-[lucide--arrow-right] size-4" />
      </Button>
      <Button
        v-else-if="isDraft"
        variant="primary"
        size="lg"
        :loading="isSubmitting"
        @click="emit('submit')"
      >
        {{ t('templateWorkflows.publish.submit') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { t } = useI18n()

const { isExisting = false, isDraft = true } = defineProps<{
  currentStep: number
  isSubmitting: boolean
  isSaving: boolean
  isExisting?: boolean
  isDraft?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  back: []
  next: []
  submit: []
  save: []
}>()
</script>
