<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <!-- <h2 class="text-lg font-semibold">
        {{ $t('marketplace.publishToMarketplace') }}
      </h2> -->
      <div class="ml-auto flex gap-2 text-sm text-muted">
        <span
          v-for="(step, idx) in steps"
          :key="step.id"
          :class="
            cn(
              'rounded-full px-3 py-1 select-none',
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

    <!-- Step 1: Details + Preview split view -->
    <div
      v-if="currentStep === 1"
      data-testid="step-details"
      class="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="publish-title" class="text-sm font-medium">
            {{ $t('marketplace.title') }}
          </label>
          <input
            id="publish-title"
            v-model="form.title"
            data-testid="input-title"
            type="text"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="publish-description" class="text-sm font-medium">
            {{ $t('marketplace.description') }}
          </label>
          <textarea
            id="publish-description"
            v-model="form.description"
            data-testid="input-description"
            rows="4"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="publish-short-description" class="text-sm font-medium">
            {{ $t('marketplace.shortDescription') }}
          </label>
          <input
            id="publish-short-description"
            v-model="form.shortDescription"
            data-testid="input-short-description"
            type="text"
            class="border-border rounded-md border bg-base-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <p class="text-sm text-muted">
          {{ $t('marketplace.previewDescription') }}
        </p>
        <div class="max-w-72">
          <CardContainer
            size="tall"
            variant="ghost"
            rounded="lg"
            :has-cursor="false"
            data-testid="preview-card"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <div
                    v-if="initialTemplate?.thumbnail"
                    class="relative size-full overflow-hidden rounded-lg"
                  >
                    <DefaultThumbnail
                      :src="initialTemplate.thumbnail"
                      :alt="form.title"
                      :hover-zoom="0"
                      :is-hovered="false"
                    />
                  </div>
                  <div
                    v-else
                    class="flex size-full flex-col items-center justify-center gap-2 rounded-lg bg-dialog-surface"
                    data-testid="preview-thumbnail-placeholder"
                  >
                    <i class="icon-[lucide--image] size-10 text-muted" />
                    <span class="text-xs text-muted">
                      {{ $t('marketplace.noThumbnailYet') }}
                    </span>
                  </div>
                </template>
              </CardTop>
            </template>
            <template #bottom>
              <CardBottom>
                <div class="flex flex-col gap-2 pt-3">
                  <h3 class="m-0 line-clamp-1 text-sm" :title="form.title">
                    {{ form.title }}
                  </h3>
                  <p class="m-0 line-clamp-2 text-sm text-muted">
                    {{ form.shortDescription }}
                  </p>
                  <p class="m-0 text-sm">
                    {{ form.description }}
                  </p>
                </div>
              </CardBottom>
            </template>
          </CardContainer>
        </div>
      </div>
    </div>

    <!-- Step 2: Submit -->
    <div
      v-if="currentStep === 2"
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
    <div class="flex justify-between pt-2">
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
          v-if="currentStep < 2"
          data-testid="btn-next"
          :disabled="!canAdvance"
          @click="handleNext"
        >
          {{ $t('marketplace.next') }}
        </Button>
        <Button
          v-if="currentStep === 2 && !submitted && isPendingReview"
          data-testid="btn-done"
          @click="handleDone"
        >
          {{ $t('marketplace.done') }}
        </Button>
        <Button
          v-if="currentStep === 2 && !submitted && !isPendingReview"
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CardBottom from '@/components/card/CardBottom.vue'
import CardContainer from '@/components/card/CardContainer.vue'
import CardTop from '@/components/card/CardTop.vue'
import DefaultThumbnail from '@/components/templates/thumbnails/DefaultThumbnail.vue'
import Button from '@/components/ui/button/Button.vue'
import type { MarketplaceTemplate } from '@/platform/marketplace/apiTypes'
import { useMarketplacePublishing } from '@/platform/marketplace/composables/useMarketplacePublishing'
import { cn } from '@/utils/tailwindUtil'

const { onClose, initialTemplate } = defineProps<{
  onClose?: () => void
  initialTemplate?: MarketplaceTemplate
}>()

const { t } = useI18n()

const defaultPlaceholders = {
  title: t('marketplace.titlePlaceholder'),
  description: t('marketplace.descriptionPlaceholder'),
  shortDescription: t('marketplace.shortDescriptionPlaceholder')
}

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
  loadForEdit,
  loadCategories
} = useMarketplacePublishing()

const form = reactive({
  title: defaultPlaceholders.title,
  description: defaultPlaceholders.description,
  shortDescription: defaultPlaceholders.shortDescription
})

const submitted = ref(false)

const isPendingReview = computed(
  () => initialTemplate?.status === 'pending_review'
)

const steps = computed(() => [
  { id: 'details', label: t('marketplace.steps.details') },
  { id: 'submit', label: t('marketplace.steps.submit') }
])

const canAdvance = computed(() => {
  if (currentStep.value === 1) {
    return (
      form.title.trim() !== '' &&
      form.title !== defaultPlaceholders.title &&
      form.description.trim() !== '' &&
      form.description !== defaultPlaceholders.description &&
      form.shortDescription.trim() !== '' &&
      form.shortDescription !== defaultPlaceholders.shortDescription
    )
  }
  return true
})

function initFromTemplate(template: MarketplaceTemplate) {
  loadForEdit(template)
  form.title = template.title
  form.description = template.description
  form.shortDescription = template.shortDescription
}

watch(
  () => initialTemplate,
  (template) => {
    if (template) initFromTemplate(template)
  },
  { immediate: true }
)

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

function handleDone() {
  onClose?.()
}
</script>
