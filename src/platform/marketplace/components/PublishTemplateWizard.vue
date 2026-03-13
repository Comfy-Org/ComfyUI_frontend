<template>
  <div class="flex flex-col gap-6 p-6">
    <div class="border-border flex items-center gap-2 border-b pb-4">
      <h2 class="text-lg font-semibold">
        {{ $t('marketplace.publishToMarketplace') }}
      </h2>
      <div class="ml-auto flex gap-2 text-sm text-muted">
        <span
          v-for="(step, idx) in steps"
          :key="step.id"
          :class="
            cn(
              'rounded-full px-3 py-1',
              currentStep === idx + 1
                ? 'text-highlight-foreground bg-highlight'
                : 'bg-base-background'
            )
          "
        >
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- Step 1: Details -->
    <div
      v-if="currentStep === 1"
      data-testid="step-details"
      class="flex flex-col gap-4"
    >
      <div class="flex flex-col gap-1.5">
        <label for="publish-title" class="text-sm font-medium">
          {{ $t('marketplace.title') }}
        </label>
        <input
          id="publish-title"
          v-model="form.title"
          data-testid="input-title"
          type="text"
          :placeholder="$t('marketplace.titlePlaceholder')"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="publish-description" class="text-sm font-medium">
          {{ $t('marketplace.description') }}
        </label>
        <textarea
          id="publish-description"
          v-model="form.description"
          data-testid="input-description"
          rows="4"
          :placeholder="$t('marketplace.descriptionPlaceholder')"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="publish-short-description" class="text-sm font-medium">
          {{ $t('marketplace.shortDescription') }}
        </label>
        <input
          id="publish-short-description"
          v-model="form.shortDescription"
          data-testid="input-short-description"
          type="text"
          :placeholder="$t('marketplace.shortDescriptionPlaceholder')"
          class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
        />
      </div>
    </div>

    <!-- Step 2: Preview -->
    <div
      v-if="currentStep === 2"
      data-testid="step-preview"
      class="flex flex-col gap-4"
    >
      <p class="text-sm text-muted">
        {{ $t('marketplace.previewDescription') }}
      </p>
      <div class="border-border rounded-lg border p-4">
        <h3 class="text-base font-semibold">{{ form.title }}</h3>
        <p class="mt-1 text-sm text-muted">{{ form.shortDescription }}</p>
        <p class="mt-2 text-sm">{{ form.description }}</p>
      </div>
    </div>

    <!-- Step 3: Submit -->
    <div
      v-if="currentStep === 3"
      data-testid="step-submit"
      class="flex flex-col gap-4"
    >
      <div
        v-if="submitted"
        class="border-success bg-success/10 rounded-lg border p-4 text-sm"
      >
        {{ $t('marketplace.submitted') }}
      </div>
      <div v-else class="flex flex-col gap-2 text-sm">
        <p>{{ $t('marketplace.previewDescription') }}</p>
        <div class="border-border rounded-lg border p-4">
          <div>
            <strong>{{ $t('marketplace.title') }}:</strong> {{ form.title }}
          </div>
          <div>
            <strong>{{ $t('marketplace.shortDescription') }}:</strong>
            {{ form.shortDescription }}
          </div>
        </div>
      </div>
    </div>

    <!-- Error display -->
    <div
      v-if="error"
      class="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm"
    >
      {{ error }}
    </div>

    <!-- Navigation buttons -->
    <div class="border-border flex justify-between border-t pt-4">
      <Button
        v-if="currentStep > 1"
        data-testid="btn-back"
        variant="secondary"
        @click="handleBack"
      >
        {{ $t('marketplace.back') }}
      </Button>
      <div v-else />

      <div class="flex gap-2">
        <Button
          v-if="currentStep < 3"
          data-testid="btn-next"
          :disabled="!canAdvance"
          @click="handleNext"
        >
          {{ $t('marketplace.next') }}
        </Button>
        <Button
          v-if="currentStep === 3 && !submitted"
          data-testid="btn-submit"
          :disabled="isPublishing"
          @click="handleSubmit"
        >
          {{
            isPublishing
              ? $t('marketplace.submitting')
              : $t('marketplace.submitForReview')
          }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useMarketplacePublishing } from '@/platform/marketplace/composables/useMarketplacePublishing'
import { cn } from '@/utils/tailwindUtil'

const { onClose } = defineProps<{
  onClose?: () => void
}>()

const { t } = useI18n()

const {
  currentStep,
  draftId,
  isPublishing,
  error,
  createDraft,
  saveDraft,
  submit,
  nextStep,
  prevStep,
  loadCategories
} = useMarketplacePublishing()

const form = reactive({
  title: '',
  description: '',
  shortDescription: ''
})

const submitted = ref(false)

const steps = computed(() => [
  { id: 'details', label: t('marketplace.steps.details') },
  { id: 'preview', label: t('marketplace.steps.preview') },
  { id: 'submit', label: t('marketplace.steps.submit') }
])

const canAdvance = computed(() => {
  if (currentStep.value === 1) {
    return (
      form.title.trim() !== '' &&
      form.description.trim() !== '' &&
      form.shortDescription.trim() !== ''
    )
  }
  return true
})

onMounted(() => {
  void loadCategories()
})

async function handleNext() {
  if (currentStep.value === 1) {
    if (!draftId.value) {
      await createDraft({
        title: form.title,
        description: form.description,
        shortDescription: form.shortDescription
      })
    } else {
      await saveDraft({
        title: form.title,
        description: form.description,
        shortDescription: form.shortDescription
      })
      nextStep()
    }
  } else {
    nextStep()
  }
}

function handleBack() {
  prevStep()
}

async function handleSubmit() {
  const result = await submit()
  if (result?.status === 'pending_review') {
    submitted.value = true
    onClose?.()
  }
}
</script>
