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
          class="pointer-events-auto flex w-100 flex-col gap-2 overflow-hidden rounded-2xl border border-white/5 bg-base-background"
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
                variant="textonly"
                size="icon"
                class="absolute bottom-2 left-2 size-7 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
                :aria-label="
                  audibleSide === 'open'
                    ? t('partnerNodesEducation.mute')
                    : t('partnerNodesEducation.unmute')
                "
                @click="toggleAudio('open')"
              >
                <i
                  :class="
                    audibleSide === 'open'
                      ? 'icon-[lucide--volume-2]'
                      : 'icon-[lucide--volume-x]'
                  "
                  class="size-4"
                />
              </Button>
              <Button
                variant="textonly"
                size="icon"
                class="absolute right-2 bottom-2 size-7 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
                :aria-label="
                  audibleSide === 'partner'
                    ? t('partnerNodesEducation.mute')
                    : t('partnerNodesEducation.unmute')
                "
                @click="toggleAudio('partner')"
              >
                <i
                  :class="
                    audibleSide === 'partner'
                      ? 'icon-[lucide--volume-2]'
                      : 'icon-[lucide--volume-x]'
                  "
                  class="size-4"
                />
              </Button>

              <Button
                variant="textonly"
                size="icon"
                class="absolute top-1.5 right-1.5 size-7 rounded-full bg-charcoal-600/50 text-white opacity-50 transition-opacity hover:bg-charcoal-600/50 hover:opacity-100"
                data-testid="partner-nodes-education-dismiss"
                :aria-label="t('g.close')"
                @click="educationStore.dismissCard"
              >
                <i class="icon-[lucide--x] size-4" />
              </Button>
            </VideoCompareSlider>

            <div class="z-1 flex h-14 items-start">
              <div
                class="flex h-14 flex-1 items-center justify-center gap-1.5 bg-secondary-background px-3 pt-7 pb-1.5 opacity-60 backdrop-blur-md"
              >
                <i class="icon-[lucide--boxes] size-4 text-white" />
                <span class="text-xs font-semibold text-white">
                  {{ t('partnerNodesEducation.openTab') }}
                </span>
              </div>
              <div
                class="flex h-14 flex-1 items-center justify-center gap-1.5 bg-secondary-background-hover px-3 pt-7 pb-1.5 backdrop-blur-md"
              >
                <i
                  class="icon-[tabler--crown-filled] size-4 text-brand-yellow"
                />
                <span class="text-xs font-semibold text-white">
                  {{ t('partnerNodesEducation.partnerTab') }}
                </span>
                <AccessibleTooltip
                  :label="t('partnerNodesEducation.tooltip')"
                  side="top"
                  :side-offset="8"
                  trigger-class="flex items-center text-white/60 hover:text-white"
                  content-class="max-w-56"
                >
                  <i class="icon-[lucide--info] size-3" />
                </AccessibleTooltip>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 px-6 pt-4 pb-6">
            <div class="flex flex-col text-sm/snug">
              <span :id="pitchId" class="font-semibold text-white">
                {{ t('partnerNodesEducation.pitch') }}
              </span>
              <span class="text-text-secondary">
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
                <span class="flex-1 text-sm/snug text-text-secondary">
                  {{ t(`partnerNodesEducation.benefits.${row.key}`) }}
                </span>
                <span class="flex w-15 justify-center">
                  <i
                    :class="
                      row.open
                        ? 'icon-[lucide--check] text-brand-yellow'
                        : 'icon-[lucide--minus] text-muted-foreground'
                    "
                    class="size-4"
                    aria-hidden="true"
                  />
                </span>
                <span class="flex w-15 justify-center">
                  <i
                    :class="
                      row.partner
                        ? 'icon-[lucide--check] text-brand-yellow'
                        : 'icon-[lucide--minus] text-muted-foreground'
                    "
                    class="size-4"
                    aria-hidden="true"
                  />
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

import VideoCompareSlider from '@/components/common/VideoCompareSlider.vue'
import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { usePartnerNodesRunGate } from '@/composables/billing/usePartnerNodesRunGate'
import { usePartnerNodesInGraph } from '@/composables/node/usePartnerNodesInGraph'
import { useDialogService } from '@/services/dialogService'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'

interface ComparisonRow {
  key: string
  open: boolean
  partner: boolean
}

const OPEN_SOURCE_MODEL_VIDEO = '/assets/videos/ltx-open.mp4'
const PARTNER_MODEL_VIDEO = '/assets/videos/ltx-partner.mp4'

const comparisonRows: ComparisonRow[] = [
  { key: 'noDownload', open: false, partner: true },
  { key: 'noVram', open: false, partner: true },
  { key: 'offline', open: true, partner: false },
  { key: 'free', open: true, partner: false }
]

const { t } = useI18n()
const pitchId = useId()

const slider = useTemplateRef<InstanceType<typeof VideoCompareSlider>>('slider')
const audibleSide = ref<'open' | 'partner' | null>(null)

function toggleAudio(side: 'open' | 'partner') {
  audibleSide.value = audibleSide.value === side ? null : side
  slider.value?.syncPlayback()
}

const educationStore = usePartnerNodesEducationStore()
const { isCardRequested } = storeToRefs(educationStore)
const { hasPartnerNodes } = usePartnerNodesInGraph()
const { gate, partnerNodes } = usePartnerNodesRunGate()
const dialogService = useDialogService()

function openSignIn() {
  void dialogService.showApiNodesSignInDialog(
    partnerNodes.value.map((node) => node.displayName)
  )
}

const isVisible = computed(() => isCardRequested.value && hasPartnerNodes.value)

/**
 * Dismiss the card only on a true → false transition of partner nodes,
 * avoiding transient false during template loads.
 */
watch(hasPartnerNodes, (present, previous) => {
  if (previous && !present) educationStore.dismissCard()
})
</script>
