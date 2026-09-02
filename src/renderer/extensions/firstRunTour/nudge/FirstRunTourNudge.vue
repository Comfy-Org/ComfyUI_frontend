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
            {{ t(`${copyKey}.title`) }}
          </p>
          <p :id="subtitleId" class="m-0 text-sm text-muted-foreground">
            {{ t(`${copyKey}.body`) }}
          </p>
        </div>
        <Button
          class="absolute top-0 right-0 opacity-50 hover:opacity-100"
          variant="secondary"
          size="icon"
          :aria-label="t('g.close')"
          :disabled="loadingSuggestionId !== null"
          @click="dismissNudge"
        >
          <i class="icon-[lucide--x] size-4" aria-hidden="true" />
        </Button>
      </div>

      <div class="flex flex-col gap-1.5">
        <button
          v-for="suggestion in availableSuggestions"
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
              class="icon-[lucide--loader-circle] size-4.5 animate-spin"
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
                v-if="suggestion.badgeKey"
                class="shrink-0 rounded-sm border border-border-subtle px-1.25 py-0.25 text-2xs/5 text-muted-foreground"
              >
                {{ t(suggestion.badgeKey) }}
              </span>
              <i
                v-if="suggestion.paid"
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
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { acceptsTemplateImageInput } from '@/platform/workflow/templates/utils/templateWorkflowTransforms'
import { useDialogStore } from '@/stores/dialogStore'

import { useFirstRunTourController } from '../tour/useFirstRunTourController'

const APPEAR_DELAY_MS = 1500

/**
 * How long the card waits on the catalog before showing what it already knows.
 * Capped, because a stalled fetch must not take the card away from the user it
 * is for (#14144).
 */
const CATALOG_WAIT_MS = 3000

type SuggestionId = 'animate' | 'upscale' | 'restyle'

interface Suggestion {
  id: SuggestionId
  templateId: string
  titleKey: string
  detailKey: string
  icon: string
  /** A qualifier on the action itself, such as the upscale's multiplier. */
  badgeKey?: string
  /** Marks the action a paid plan is required to run, so the card says so. */
  paid?: boolean
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'animate',
    templateId: 'video_minimax_h3_i2v_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.animate.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.animate.detail',
    icon: 'icon-[lucide--film]'
  },
  {
    id: 'upscale',
    templateId: 'utility_seedvr2_7b_int8_upscale_image',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.upscale.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.upscale.detail',
    icon: 'icon-[lucide--maximize-2]',
    badgeKey: 'onboardingCoachmarks.firstRun.nudge.upscale.badge'
  },
  {
    id: 'restyle',
    templateId: 'api_google_nano_banana2_image_edit_continuation',
    titleKey: 'onboardingCoachmarks.firstRun.nudge.restyle.title',
    detailKey: 'onboardingCoachmarks.firstRun.nudge.restyle.detail',
    icon: 'icon-[ph--swatches]',
    paid: true
  }
]

const { t } = useI18n()
const toast = useToast()
const { nudgeArmed, nudgeOutput, dismissNudge } = useFirstRunTourController()
const { loadTemplates, loadWorkflowTemplate } = useTemplateWorkflows()
const templatesStore = useWorkflowTemplatesStore()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const titleId = useId()
const subtitleId = useId()
const loadingSuggestionId = ref<SuggestionId | null>(null)
const delayElapsed = ref(false)
const decidedSuggestions = ref<Suggestion[] | null>(null)
let reported = false

/**
 * The template package is pinned by the install, not by this build, so an id
 * this card knows can be absent from the served catalog — or present without
 * the `io` metadata the continuation needs. Either way the button would be a
 * dead end found by clicking it, seconds after the user's first success.
 */
const catalogSuggestions = computed(() =>
  nudgeOutput.value === null
    ? []
    : SUGGESTIONS.filter(({ templateId }) => {
        const template = templatesStore.getTemplateByName(templateId)
        return (
          template?.sourceModule === 'default' &&
          acceptsTemplateImageInput(template)
        )
      })
)
const availableSuggestions = computed(() => decidedSuggestions.value ?? [])

function decideSuggestions() {
  if (decidedSuggestions.value !== null) return
  decidedSuggestions.value = catalogSuggestions.value
}

// A run that produced no image, and an install serving none of the
// continuations, both leave the card with nothing to continue from. Neither is
// a reason to take away the way forward, so the card falls back to the browser.
const copyKey = computed(
  () =>
    `onboardingCoachmarks.firstRun.nudge${availableSuggestions.value.length > 0 ? '' : '.fallback'}`
)

const screenIsClear = computed(
  () => nudgeArmed.value && dialogStore.dialogStack.length === 0
)
/**
 * The catalog decides what the card can offer, so the card cannot render before
 * it. Without this the card paints the fallback, then rewrites itself into the
 * continuations under the user — and reports a count it never showed.
 */
const onScreen = computed(
  () =>
    screenIsClear.value &&
    delayElapsed.value &&
    decidedSuggestions.value !== null
)

const { start: scheduleAppearance, stop: cancelAppearance } = useTimeoutFn(
  () => {
    delayElapsed.value = true
  },
  APPEAR_DELAY_MS,
  { immediate: false }
)

const { start: startCatalogWait, stop: stopCatalogWait } = useTimeoutFn(
  decideSuggestions,
  CATALOG_WAIT_MS,
  { immediate: false }
)

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (onScreen.value && !loadingSuggestionId.value && event.key === 'Escape')
    dismissNudge()
})

// Each nudge is a fresh one: a second tour asks the catalog again and reports
// its own impression, rather than inheriting the first tour's answers.
watch(
  nudgeArmed,
  (armed, _previous, onCleanup) => {
    stopCatalogWait()
    decidedSuggestions.value = null
    reported = false
    if (!armed) return

    let active = true
    onCleanup(() => {
      active = false
    })
    startCatalogWait()
    void loadTemplates().finally(() => {
      if (!active) return
      stopCatalogWait()
      decideSuggestions()
    })
  },
  { immediate: true }
)

watch(
  screenIsClear,
  (clear) => {
    cancelAppearance()
    delayElapsed.value = false
    if (clear) scheduleAppearance()
  },
  { immediate: true }
)

watch(onScreen, (visible) => {
  if (!visible || reported) return
  reported = true
  telemetry?.trackOnboardingTour('nudge_shown', {
    tour: 'firstRun',
    suggestion_count: availableSuggestions.value.length
  })
})

async function onSuggestion(suggestion: Suggestion) {
  const input = nudgeOutput.value
  if (!input || loadingSuggestionId.value) return

  loadingSuggestionId.value = suggestion.id
  try {
    const loaded = await loadWorkflowTemplate(
      suggestion.templateId,
      'default',
      {
        input
      }
    )
    telemetry?.trackOnboardingTour('nudge_suggestion_clicked', {
      tour: 'firstRun',
      suggestion_count: availableSuggestions.value.length,
      suggestion: suggestion.id,
      loaded
    })

    if (loaded) {
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
    suggestion_count: availableSuggestions.value.length
  })
  dismissNudge()
}
</script>
