<script setup lang="ts">
import { useTimeout } from '@vueuse/core'
import { PopoverArrow, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, ref, toValue, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import AppModeWidgetList from '@/components/builder/AppModeWidgetList.vue'
import { useErrorOverlayState } from '@/components/error/useErrorOverlayState'
import Loader from '@/components/loader/Loader.vue'
import ScrubableNumberInput from '@/components/common/ScrubableNumberInput.vue'
import { COACH_IDS } from '@/platform/onboarding/onboardingTours'
import { useOnboardingTourStore } from '@/platform/onboarding/onboardingTourStore'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import Button from '@comfyorg/design-system/button/Button'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { isCloud } from '@/platform/distribution/types'
import FreeTierQuota from '@/platform/billing/subscription/components/FreeTierQuota.vue'
import SubscribeToRunButton from '@/platform/billing/subscription/components/SubscribeToRun.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import LinearRunErrorWarning from '@/renderer/extensions/linearMode/LinearRunErrorWarning.vue'
import { LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID } from '@/renderer/extensions/linearMode/linearRunErrorWarningIds'
import PartnerNodesList from '@/renderer/extensions/linearMode/PartnerNodesList.vue'
import { useCommandStore } from '@/stores/commandStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useTemplateInputDownloadStore } from '@/platform/workflow/templates/stores/templateInputDownloadStore'

const { t } = useI18n()
const commandStore = useCommandStore()
const { batchCount } = storeToRefs(useQueueSettingsStore())
const settingStore = useSettingStore()
const { canRunWorkflows, showsSubscribeToRunPrompt } = useBillingContext()
const showsCloudSubscribePrompt = computed(
  () => isCloud && showsSubscribeToRunPrompt.value
)
const workflowStore = useWorkflowStore()
const { isBuilderMode } = useAppMode()
const appModeStore = useAppModeStore()
const { hasOutputs } = storeToRefs(appModeStore)
const { hasAnyError, hasMissingError } = storeToRefs(useExecutionErrorStore())
const missingMediaStore = useMissingMediaStore()
const templateInputDownloadStore = useTemplateInputDownloadStore()
const { overlayMessage } = useErrorOverlayState()

const { toastTo, mobile } = defineProps<{
  toastTo?: string | HTMLElement
  mobile?: boolean
}>()
defineEmits<{ navigateOutputs: [] }>()
defineExpose({ runButtonClick, handleDragDrop })

//NOTE: due to batching, will never be greater than 2
const pendingJobQueues = ref(0)
const { ready: jobToastTimeout, start: resetJobToastTimeout } = useTimeout(
  8000,
  { controls: true, immediate: false }
)
const widgetListRef = useTemplateRef('widgetListRef')
const linearRunButtonTestId = 'linear-run-button'
const linearInputDownloadStatusId = 'linear-input-download-status'
const requiredInputDownloads = computed(() => {
  const requiredFilenames = new Set(
    (missingMediaStore.missingMediaCandidates ?? []).map(({ name }) => name)
  )
  return templateInputDownloadStore.downloads.filter(({ filename }) =>
    requiredFilenames.has(filename)
  )
})
const isPreparingInputDownloads = computed(
  () => requiredInputDownloads.value.length > 0
)
const isFinalizingInputDownloads = computed(() =>
  requiredInputDownloads.value.every(({ status }) => status === 'completed')
)
const inputDownloadProgress = computed(() => {
  const progress = requiredInputDownloads.value.map(
    (download) => download.progress
  )
  if (!progress.length || progress.some((value) => value === null)) return null
  return Math.round(
    (progress.reduce<number>((sum, value) => sum + (value ?? 0), 0) /
      progress.length) *
      100
  )
})
const inputDownloadLabel = computed(() =>
  isFinalizingInputDownloads.value
    ? t('linearMode.inputDownloads.finalizing')
    : t(
        'linearMode.inputDownloads.downloading',
        { count: requiredInputDownloads.value.length },
        requiredInputDownloads.value.length
      )
)
const runButtonIconClass = computed(() =>
  isPreparingInputDownloads.value
    ? 'icon-[lucide--loader-circle] animate-spin'
    : hasMissingError.value
      ? 'icon-[lucide--triangle-alert]'
      : 'icon-[lucide--play]'
)
const showRunErrorWarning = computed(
  () =>
    hasAnyError.value &&
    toValue(canRunWorkflows) &&
    toValue(overlayMessage).trim().length > 0
)

//TODO: refactor out of this file.
//code length is small, but changes should propagate
async function runButtonClick(e: Event) {
  try {
    pendingJobQueues.value += 1
    resetJobToastTimeout()
    const isShiftPressed = 'shiftKey' in e && e.shiftKey
    const commandId = isShiftPressed
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'

    if (batchCount.value > 1) {
      useTelemetry()?.trackUiButtonClicked({
        button_id: 'queue_run_multiple_batches_submitted',
        element_group: 'app_mode'
      })
    }
    await commandStore.execute(commandId, {
      metadata: {
        subscribe_to_run: false,
        trigger_source: 'linear'
      }
    })
  } finally {
    //TODO: Error state indicator for failed queue?
    pendingJobQueues.value -= 1
  }
}
function handleDragDrop() {
  return widgetListRef.value?.handleDragDrop()
}

function replayAppModeTour() {
  useOnboardingTourStore().replayTour('appMode')
}
</script>
<template>
  <div
    v-if="!isBuilderMode && hasOutputs"
    class="flex h-full min-w-80 flex-col"
    v-bind="$attrs"
  >
    <section
      v-if="!mobile"
      data-testid="linear-workflow-info"
      class="flex h-12 items-center gap-2 border-x border-border/50 bg-background px-4 py-2 contain-size"
    >
      <span
        class="min-w-0 flex-1 truncate font-bold"
        v-text="workflowStore.activeWorkflow?.filename"
      />
      <Button
        :tooltip="t('onboardingCoachmarks.appMode.replay')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        :aria-label="t('onboardingCoachmarks.appMode.replay')"
        class="border border-solid hover:border-border hover:text-foreground"
        @click="replayAppModeTour"
      >
        <i class="icon-[lucide--circle-question-mark]" />
      </Button>
    </section>
    <div
      class="flex h-full flex-col gap-2 border-x bg-background px-2 md:border-y"
    >
      <section
        v-coachmark="COACH_IDS.inputsList"
        data-testid="linear-widgets"
        class="grow scroll-shadows-background overflow-y-auto contain-size"
      >
        <AppModeWidgetList ref="widgetListRef" :mobile />
      </section>
      <Teleport
        v-if="!jobToastTimeout || pendingJobQueues > 0"
        defer
        :disabled="mobile"
        :to="toastTo"
      >
        <div
          class="flex h-10 items-center gap-2 rounded-lg bg-foreground p-1 pr-2 text-background md:h-8 md:bg-secondary md:text-foreground"
        >
          <template v-if="pendingJobQueues === 0">
            <i class="icon-[lucide--check] size-5 not-md:bg-success" />
            <span class="mr-auto" v-text="t('queue.jobAddedToQueue')" />
            <Button
              v-if="mobile"
              variant="inverted"
              @click="$emit('navigateOutputs')"
            >
              {{ t('linearMode.viewJob') }}
            </Button>
          </template>
          <template v-else>
            <Loader size="sm" />
            <span v-text="t('queue.jobQueueing')" />
          </template>
        </div>
      </Teleport>
      <section
        v-if="isPreparingInputDownloads"
        :id="linearInputDownloadStatusId"
        role="status"
        data-testid="linear-input-download-status"
        class="mx-2 flex flex-col gap-2 rounded-lg border bg-background p-3 text-sm"
      >
        <div class="flex items-center gap-2">
          <Loader size="sm" />
          <span class="min-w-0 flex-1" v-text="inputDownloadLabel" />
          <span
            v-if="inputDownloadProgress !== null"
            class="text-muted-foreground tabular-nums"
            v-text="`${inputDownloadProgress}%`"
          />
        </div>
        <span
          role="progressbar"
          :aria-label="inputDownloadLabel"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="inputDownloadProgress ?? undefined"
          class="block h-1 overflow-hidden rounded-full bg-secondary"
        >
          <span
            :class="
              cn(
                'block h-full rounded-full bg-primary transition-[width]',
                inputDownloadProgress === null && 'w-1/3 animate-pulse'
              )
            "
            :style="
              inputDownloadProgress === null
                ? undefined
                : { width: `${inputDownloadProgress}%` }
            "
          />
        </span>
      </section>
      <PartnerNodesList v-if="!mobile" />
      <section
        v-if="mobile"
        :data-testid="linearRunButtonTestId"
        class="border-t p-4 pb-6"
      >
        <LinearRunErrorWarning v-if="showRunErrorWarning" />
        <div v-coachmark="COACH_IDS.appRunButton">
          <SubscribeToRunButton
            v-if="showsCloudSubscribePrompt"
            class="mt-4 w-full"
          />
          <div v-else class="mt-4 flex">
            <PartnerNodesList mobile />
            <PopoverRoot>
              <PopoverTrigger as-child>
                <Button size="lg" class="-mr-3 pr-7">
                  <i
                    v-if="batchCount == 1"
                    class="icon-[lucide--chevron-down]"
                  />
                  <div v-else class="tabular-nums" v-text="`${batchCount}x`" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                :side-offset="5"
                dismiss-on-viewport-change
                class="w-auto rounded-lg border-border/50 p-2 shadow-sm"
                @open-auto-focus.prevent
              >
                <div
                  class="m-1 mb-2 text-muted-foreground"
                  v-text="t('linearMode.runCount')"
                />
                <ScrubableNumberInput
                  v-model="batchCount"
                  :aria-label="t('linearMode.runCount')"
                  :min="1"
                  :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
                  class="h-10 min-w-40"
                />
                <PopoverArrow class="fill-background stroke-border/50" />
              </PopoverContent>
            </PopoverRoot>
            <Button
              variant="inverted"
              class="grow"
              size="lg"
              :aria-describedby="
                isPreparingInputDownloads
                  ? linearInputDownloadStatusId
                  : showRunErrorWarning
                    ? LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID
                    : undefined
              "
              :disabled="isPreparingInputDownloads"
              @click="runButtonClick"
            >
              <i
                aria-hidden="true"
                :class="runButtonIconClass"
                data-testid="linear-run-button-icon"
              />
              {{ t('menu.run') }}
            </Button>
          </div>
        </div>
      </section>
      <section
        v-else
        :data-testid="linearRunButtonTestId"
        class="border-t p-4 pb-6"
      >
        <LinearRunErrorWarning v-if="showRunErrorWarning" />
        <div v-coachmark="COACH_IDS.appRunButton">
          <div
            class="m-1 mb-2 text-muted-foreground"
            v-text="t('linearMode.runCount')"
          />
          <ScrubableNumberInput
            v-model="batchCount"
            :aria-label="t('linearMode.runCount')"
            :min="1"
            :max="settingStore.get('Comfy.QueueButton.BatchCountLimit')"
            class="h-7 min-w-40"
          />
          <SubscribeToRunButton
            v-if="showsCloudSubscribePrompt"
            class="mt-4 w-full"
          />
          <Button
            v-else
            variant="inverted"
            class="mt-4 w-full"
            size="lg"
            :aria-describedby="
              isPreparingInputDownloads
                ? linearInputDownloadStatusId
                : showRunErrorWarning
                  ? LINEAR_RUN_ERROR_WARNING_DESCRIPTION_ID
                  : undefined
            "
            :disabled="isPreparingInputDownloads"
            @click="runButtonClick"
          >
            <i
              aria-hidden="true"
              :class="runButtonIconClass"
              data-testid="linear-run-button-icon"
            />
            {{ t('menu.run') }}
          </Button>
        </div>
        <FreeTierQuota />
      </section>
    </div>
  </div>
  <div
    v-else-if="mobile"
    class="flex size-full items-center bg-background p-4 text-center"
    v-text="t('linearMode.mobileNoWorkflow')"
  />
</template>
