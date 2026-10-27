<template>
  <Teleport to="body">
    <Transition
      enter-active-class="motion-safe:transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="motion-safe:transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        class="pointer-events-none fixed right-0 bottom-0 z-1500"
      >
        <div
          role="dialog"
          aria-modal="false"
          :aria-labelledby="pitchId"
          data-testid="partner-nodes-education-card"
          class="pointer-events-auto flex w-100 flex-col gap-2 overflow-hidden rounded-2xl border border-white/5 bg-background"
        >
          <div class="isolate flex h-60 flex-col">
            <VideoCompareSlider
              ref="slider"
              :base-src="PARTNER_MODEL_VIDEO"
              :overlay-src="OPEN_SOURCE_MODEL_VIDEO"
              :base-muted="audibleSide !== 'partner'"
              :overlay-muted="audibleSide !== 'open'"
              :label="t('partnerNodesEducation.sliderLabel')"
              class="relative z-2 -mb-5 flex-1 rounded-t-xl"
            >
              <Button
                v-for="control in audioControls"
                :key="control.side"
                variant="textonly"
                size="icon"
                :class="
                  cn(
                    'absolute bottom-2 size-7 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white',
                    control.position
                  )
                "
                :aria-label="control.label"
                @click="toggleAudio(control.side)"
              >
                <i :class="control.icon" />
              </Button>

              <Button
                variant="textonly"
                size="icon"
                class="absolute top-1.5 right-1.5 size-7 rounded-full bg-charcoal-600/50 text-white opacity-50 transition-opacity hover:bg-charcoal-600/50 hover:opacity-100"
                data-testid="partner-nodes-education-dismiss"
                :aria-label="t('g.close')"
                @click="educationStore.dismissCard"
              >
                <i class="icon-[lucide--x]" />
              </Button>
            </VideoCompareSlider>

            <div class="z-1 flex h-14 items-start">
              <div
                class="flex h-14 flex-1 items-center justify-center gap-1.5 bg-secondary px-3 pt-7 pb-1.5 text-white opacity-60 backdrop-blur-md"
              >
                <i class="icon-[lucide--boxes]" />
                <span class="text-xs font-semibold">
                  {{ t('partnerNodesEducation.openTab') }}
                </span>
              </div>
              <div
                class="flex h-14 flex-1 items-center justify-center gap-1.5 bg-accent px-3 pt-7 pb-1.5 backdrop-blur-md"
              >
                <i class="icon-[tabler--crown-filled] text-brand-yellow" />
                <span class="text-xs font-semibold text-white">
                  {{ t('partnerNodesEducation.partnerTab') }}
                </span>
                <Tooltip open-on-click>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      :aria-label="t('partnerNodesEducation.tooltip')"
                      class="flex items-center text-white/60 hover:text-white"
                    >
                      <i class="icon-[lucide--info] size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent :side-offset="8" class="max-w-56">{{
                    t('partnerNodesEducation.tooltip')
                  }}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 px-6 pt-4 pb-6">
            <div class="flex flex-col text-sm/snug">
              <span :id="pitchId" class="font-semibold text-white">
                {{ t('partnerNodesEducation.pitch') }}
              </span>
              <span class="text-muted-foreground">
                {{ t('partnerNodesEducation.reassurance') }}
              </span>
            </div>

            <div class="flex pr-4.5 text-xs font-medium text-muted-foreground">
              <span class="flex-1" />
              <span class="w-15 text-center">
                {{ t('partnerNodesEducation.openHeader') }}
              </span>
              <span class="w-15 text-center">
                {{ t('partnerNodesEducation.partnerHeader') }}
              </span>
            </div>

            <div class="flex flex-col gap-2">
              <div
                v-for="row in comparisonRows"
                :key="row.key"
                class="flex items-center pr-4.5"
              >
                <span class="flex-1 text-sm/snug text-muted-foreground">
                  {{ t(`partnerNodesEducation.benefits.${row.key}`) }}
                </span>
                <span
                  v-for="column in [
                    {
                      label: t('partnerNodesEducation.openHeader'),
                      status: row.open
                    },
                    {
                      label: t('partnerNodesEducation.partnerHeader'),
                      status: row.partner
                    }
                  ]"
                  :key="column.label"
                  class="flex w-15 justify-center"
                >
                  <i
                    :class="comparisonStatusClasses[column.status]"
                    aria-hidden="true"
                  />
                  <span class="sr-only">
                    {{ column.label }}:
                    {{
                      column.status === 'included'
                        ? t('partnerNodesEducation.included')
                        : t('partnerNodesEducation.notIncluded')
                    }}
                  </span>
                </span>
              </div>
            </div>

            <Button
              v-if="gate === 'sign-in'"
              variant="secondary"
              size="lg"
              class="mt-1 h-9 w-full bg-credit/15 text-credit hover:bg-credit/25 focus-visible:ring-credit"
              data-testid="partner-nodes-education-sign-in"
              @click="openSignIn"
            >
              {{ t('actionbar.partnerRunGate.signInToRun') }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import VideoCompareSlider from '@comfyorg/design-system/common/VideoCompareSlider'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { usePartnerNodesRunGate } from '@/platform/billing/composables/usePartnerNodesRunGate'
import { usePartnerNodesInGraph } from '@/composables/node/usePartnerNodesInGraph'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { cn } from '@comfyorg/tailwind-utils'

interface ComparisonRow {
  key: string
  open: 'included' | 'notIncluded'
  partner: 'included' | 'notIncluded'
}

const OPEN_SOURCE_MODEL_VIDEO =
  'https://media.comfy.org/website/partner-nodes/ltx-open-1280.webm'
const PARTNER_MODEL_VIDEO =
  'https://media.comfy.org/website/partner-nodes/ltx-partner-1280.webm'

const comparisonRows: ComparisonRow[] = [
  { key: 'noDownload', open: 'notIncluded', partner: 'included' },
  { key: 'noVram', open: 'notIncluded', partner: 'included' },
  { key: 'offline', open: 'included', partner: 'notIncluded' },
  { key: 'free', open: 'included', partner: 'notIncluded' }
]

const comparisonStatusClasses = {
  included: 'icon-[lucide--check] text-brand-yellow',
  notIncluded: 'icon-[lucide--minus] text-muted-foreground'
}

const { t } = useI18n()
const pitchId = useId()

const slider = useTemplateRef<InstanceType<typeof VideoCompareSlider>>('slider')
const audibleSide = ref<'open' | 'partner' | null>(null)

const audioControls = computed(() =>
  [
    {
      side: 'open' as const,
      position: 'left-2',
      muteLabel: t('partnerNodesEducation.muteOpen'),
      unmuteLabel: t('partnerNodesEducation.unmuteOpen')
    },
    {
      side: 'partner' as const,
      position: 'right-2',
      muteLabel: t('partnerNodesEducation.mutePartner'),
      unmuteLabel: t('partnerNodesEducation.unmutePartner')
    }
  ].map((control) => ({
    ...control,
    label:
      audibleSide.value === control.side
        ? control.muteLabel
        : control.unmuteLabel,
    icon:
      audibleSide.value === control.side
        ? 'icon-[lucide--volume-2]'
        : 'icon-[lucide--volume-x]'
  }))
)

function toggleAudio(side: 'open' | 'partner') {
  audibleSide.value = audibleSide.value === side ? null : side
  slider.value?.syncPlayback()
}

const educationStore = usePartnerNodesEducationStore()
const { isCardRequested, requestedForWorkflowKey } = storeToRefs(educationStore)
const { hasPartnerNodes } = usePartnerNodesInGraph()
const { gate, partnerNodes } = usePartnerNodesRunGate()
const { activeWorkflow } = storeToRefs(useWorkflowStore())
const { showApiNodesSignInDialog } = useAuthDialogs()

function openSignIn() {
  void showApiNodesSignInDialog(
    partnerNodes.value.map((node) => node.displayName)
  )
}

const isForRequestedWorkflow = computed(
  () => activeWorkflow.value?.key === requestedForWorkflowKey.value
)

const isVisible = computed(
  () =>
    isCardRequested.value &&
    hasPartnerNodes.value &&
    isForRequestedWorkflow.value
)

// Retire the one-off request as soon as its workflow is no longer active, so it
// neither shows on the wrong workflow nor resurfaces on returning to its own.
watch(
  () => isCardRequested.value && !isForRequestedWorkflow.value,
  (stale) => {
    if (stale) educationStore.retireCard()
  }
)
</script>
