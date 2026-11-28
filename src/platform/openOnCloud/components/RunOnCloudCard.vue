<template>
  <DeploySetupCard
    data-testid="run-on-cloud-card"
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    :body
    :points
    :note
    @dismiss="emit('dismiss')"
  >
    <template #actions>
      <label
        v-if="needsConsent && !checking"
        class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground @xl:mr-4"
      >
        <Checkbox
          v-model="dontAskAgain"
          data-testid="run-on-cloud-dont-ask-again"
        />
        {{ t('openOnCloud.runDialog.dontAskAgain') }}
      </label>
      <Button
        variant="inverted"
        size="lg"
        class="w-full @xl:w-auto"
        data-testid="run-on-cloud-primary"
        :disabled="checking"
        @click="needsConsent ? emit('check', dontAskAgain) : openOnCloud()"
      >
        {{ primaryLabel }}
        <i
          v-if="!needsConsent"
          class="icon-[lucide--external-link]"
          aria-hidden="true"
        />
      </Button>
    </template>
  </DeploySetupCard>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Checkbox from '@comfyorg/design-system/checkbox/Checkbox'
import { useTelemetry } from '@comfyorg/telemetry'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UncheckedModelInput } from '@/platform/openOnCloud/cloudWorkflowCheck'
import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const {
  asksToSignIn = false,
  uncheckedInputs = [],
  needsConsent = false,
  checking = false
} = defineProps<{
  asksToSignIn?: boolean
  uncheckedInputs?: UncheckedModelInput[]
  needsConsent?: boolean
  checking?: boolean
}>()

const { t } = useI18n()
const dontAskAgain = ref(false)

const points = [
  t('openOnCloud.deploySetupDialog.pointNodes'),
  t('openOnCloud.deploySetupDialog.pointGpu'),
  t('openOnCloud.runDialog.pointApi')
]

const body = computed(() => {
  if (needsConsent) return t('openOnCloud.runDialog.body')
  return uncheckedInputs.length
    ? t('openOnCloud.runDialog.readyWithUncheckedInputs', {
        inputs: uncheckedInputs
          .map(({ nodeType, input }) =>
            t('openOnCloud.runDialog.uncheckedInput', { nodeType, input })
          )
          .join(', ')
      })
    : t('openOnCloud.runDialog.ready')
})

const note = computed(() => {
  if (needsConsent) return t('openOnCloud.runDialog.sends')
  if (asksToSignIn) return t('openOnCloud.runDialog.asksToSignIn')
})

const primaryLabel = computed(() => {
  if (checking) return t('openOnCloud.cloudButton.checking')
  return needsConsent
    ? t('openOnCloud.runDialog.checkCompatibility')
    : t('openOnCloud.runDialog.openOnCloud')
})

const emit = defineEmits<{
  check: [dontAskAgain: boolean]
  done: []
  dismiss: []
}>()

function openOnCloud() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_on_cloud_open_on_cloud_clicked',
    element_group: 'run_on_cloud'
  })
  void openWorkflowOnCloud()
  emit('done')
}
</script>
