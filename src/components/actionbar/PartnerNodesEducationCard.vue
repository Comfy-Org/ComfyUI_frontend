<template>
  <Teleport to="body">
    <Transition
      enter-active-class="motion-safe:transition-all duration-300 ease-out"
      enter-from-class="motion-safe:-translate-y-3 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="motion-safe:transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="motion-safe:-translate-y-3 opacity-0"
    >
      <div
        v-if="isVisible"
        class="pointer-events-none fixed inset-x-4 top-20 z-9999 flex justify-center"
      >
        <div
          role="status"
          aria-live="polite"
          data-testid="partner-nodes-education-card"
          class="pointer-events-auto relative flex w-fit max-w-md min-w-80 flex-col gap-2 overflow-hidden rounded-lg border border-l-4 border-border-default border-l-blue-500 bg-base-background p-3 shadow-interface"
        >
          <div class="flex w-full items-start gap-2 pr-8">
            <i
              class="mt-0.5 icon-[lucide--info] size-4 shrink-0 text-blue-500"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 text-sm text-base-foreground">
              {{ t('partnerNodesEducation.title') }}
            </span>
          </div>

          <div class="flex w-full items-start gap-2 pr-8">
            <span class="size-4 shrink-0" aria-hidden="true" />
            <p
              class="m-0 min-w-0 flex-1 text-sm/snug wrap-break-word text-muted-foreground"
            >
              {{ t('partnerNodesEducation.body') }}
            </p>
          </div>

          <div class="flex w-full items-center justify-end pt-2">
            <Button
              variant="secondary"
              size="unset"
              class="min-h-8 rounded-lg px-3 py-2 text-xs font-normal"
              data-testid="partner-nodes-education-got-it"
              @click="educationStore.dismissCard"
            >
              {{ t('partnerNodesEducation.gotIt') }}
            </Button>
          </div>

          <Button
            variant="muted-textonly"
            size="icon-sm"
            class="absolute top-2 right-2 size-6 rounded-sm"
            data-testid="partner-nodes-education-dismiss"
            :aria-label="t('g.close')"
            @click="educationStore.dismissCard"
          >
            <i class="icon-[lucide--x] block size-4 leading-none" />
          </Button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { usePartnerNodesInGraph } from '@/composables/node/usePartnerNodesInGraph'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'

const { t } = useI18n()
const educationStore = usePartnerNodesEducationStore()
const { isCardRequested } = storeToRefs(educationStore)
const { isErrorOverlayOpen } = storeToRefs(useExecutionErrorStore())
// Keeps the card truthful: it hides when the user switches to a graph
// without partner nodes instead of outliving the template it describes.
const { hasPartnerNodes } = usePartnerNodesInGraph()

const isVisible = computed(
  () =>
    isCardRequested.value && hasPartnerNodes.value && !isErrorOverlayOpen.value
)

// The card describes the template that was just loaded, so leaving that graph
// retires the request; a later partner-node workflow must not revive it.
watch(hasPartnerNodes, (present) => {
  if (!present) educationStore.dismissCard()
})
</script>
