<template>
  <div
    v-if="onScreen"
    role="region"
    :aria-labelledby="titleId"
    :aria-describedby="subtitleId"
    data-testid="first-run-nudge"
    class="fixed right-6 bottom-8 z-1000 flex w-103.25 animate-in flex-col gap-4 overflow-hidden rounded-xl border border-border-subtle bg-base-background p-5 shadow-lg duration-500 fade-in-0"
  >
    <div class="flex flex-col gap-6">
      <div class="relative flex items-start justify-between overflow-hidden">
        <div class="flex min-w-0 flex-1 flex-col gap-1 pr-10">
          <p :id="titleId" class="m-0 text-lg font-medium text-base-foreground">
            {{ t('onboardingCoachmarks.firstRun.nudge.title') }}
          </p>
          <p :id="subtitleId" class="m-0 text-sm text-muted-foreground">
            {{ t('onboardingCoachmarks.firstRun.nudge.body') }}
          </p>
        </div>
        <Button
          class="absolute top-0 right-0 opacity-50 hover:opacity-100"
          variant="secondary"
          size="icon"
          :aria-label="t('g.close')"
          @click="dismissNudge"
        >
          <i class="icon-[lucide--x] size-4" aria-hidden="true" />
        </Button>
      </div>

      <div class="flex flex-col gap-1.5">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          type="button"
          :data-testid="`first-run-nudge-${suggestion.id}`"
          :disabled="loadingSuggestionId !== null"
          :aria-busy="loadingSuggestionId === suggestion.id || undefined"
          class="group focus-visible:ring-ring flex h-13 w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-secondary-background p-2 text-left font-inter text-base-foreground transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          @click="onSuggestion(suggestion)"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary-background-hover"
          >
            <i
              v-if="loadingSuggestionId === suggestion.id"
              class="pi pi-spin pi-spinner size-4.5"
              aria-hidden="true"
            />
            <i
              v-else
              :class="suggestion.icon"
              class="size-4.5"
              aria-hidden="true"
            />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="flex items-center gap-1.5 text-sm font-medium">
              <span class="min-w-0 flex-1 truncate">
                {{ t(suggestion.titleKey) }}
              </span>
              <span
                v-if="suggestion.id === 'upscale'"
                class="shrink-0 rounded-sm border border-border-subtle px-1.25 py-0.25 text-[10px] text-muted-foreground"
              >
                {{ t('onboardingCoachmarks.firstRun.nudge.upscale.badge') }}
              </span>
              <i
                v-if="suggestion.id === 'restyle'"
                class="icon-[tabler--crown-filled] size-4 shrink-0 text-brand-yellow"
                aria-hidden="true"
              />
            </span>
            <span class="truncate text-xs text-muted-foreground">
              {{ t(suggestion.detailKey) }}
            </span>
          </span>
        </button>
      </div>
    </div>

    <Button
      variant="inverted"
      size="md"
      class="w-full font-medium"
      data-testid="first-run-nudge-explore"
      :disabled="loadingSuggestionId !== null"
      @click="onExplore"
    >
      {{ t('onboardingCoachmarks.firstRun.nudge.explore') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useDialogStore } from '@/stores/dialogStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const APPEAR_DELAY_MS = 1500

type SuggestionId = 'animate' | 'upscale' | 'restyle'

interface Suggestion {
  id: SuggestionId
  templateId: string
  titleKey: string
  detailKey: string
  icon: string
}

const suggestions: Suggestion[] = [
  {
    id: 'animate',
    templateId: 'video_minimax_h3_i2v_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.animate.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.animate.detail',
    icon: 'icon-[lucide--film]'
  },
  {
    id: 'upscale',
    templateId: 'utility_interpolation_image_upscale_4x',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.upscale.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.upscale.detail',
    icon: 'icon-[lucide--maximize-2]'
  },
  {
    id: 'restyle',
    templateId: 'api_google_nano_banana2_image_edit_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.restyle.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.restyle.detail',
    icon: 'icon-[ph--swatches]'
  }
]

const { t } = useI18n()
const toast = useToast()
const { nudgeArmed, nudgeOutput, tourWasCompleted, dismissNudge } =
  useFirstRunTourController()
const { loadTemplates, loadWorkflowTemplate } = useTemplateWorkflows()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const titleId = useId()
const subtitleId = useId()
const loadingSuggestionId = ref<SuggestionId | null>(null)
const onScreen = ref(false)
let reported = false

const { start: scheduleAppearance, stop: cancelAppearance } = useTimeoutFn(
  () => {
    onScreen.value = true
    if (reported) return
    reported = true
    telemetry?.trackOnboardingTour('nudge_shown', {
      tour: 'firstRun',
      tour_completed: tourWasCompleted.value
    })
  },
  APPEAR_DELAY_MS,
  { immediate: false }
)

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (onScreen.value && event.key === 'Escape') dismissNudge()
})

watch(
  () => nudgeArmed.value && dialogStore.dialogStack.length === 0,
  (screenIsClear) => {
    cancelAppearance()
    if (!screenIsClear) {
      onScreen.value = false
      return
    }
    scheduleAppearance()
  },
  { immediate: true }
)

async function onSuggestion(suggestion: Suggestion) {
  const input = nudgeOutput.value
  if (!input || loadingSuggestionId.value) return

  loadingSuggestionId.value = suggestion.id
  try {
    const templatesLoaded = await loadTemplates()
    const workflowLoaded =
      templatesLoaded &&
      (await loadWorkflowTemplate(suggestion.templateId, 'default', {
        input
      }))

    if (workflowLoaded) {
      dismissNudge()
      return
    }

    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: t('onboardingCoachmarks.firstRun.nudge.loadFailed'),
      life: 5000
    })
  } finally {
    loadingSuggestionId.value = null
  }
}

function onExplore() {
  useWorkflowTemplateSelectorDialog().show('first_run_nudge')
  telemetry?.trackOnboardingTour('explore_templates_clicked', {
    tour: 'firstRun',
    tour_completed: tourWasCompleted.value
  })
  dismissNudge()
}
</script>
