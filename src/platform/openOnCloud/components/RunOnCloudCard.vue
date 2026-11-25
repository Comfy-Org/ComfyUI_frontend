<template>
  <DeploySetupCard
    data-testid="run-on-cloud-card"
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    :body
    :points
    :note="needsConsent ? t('openOnCloud.runDialog.sends') : undefined"
    @dismiss="emit('dismiss')"
  >
    <template #actions>
      <Button
        variant="inverted"
        size="lg"
        class="w-full @xl:w-auto"
        data-testid="run-on-cloud-primary"
        :disabled="checking"
        @click="needsConsent ? emit('check') : openOnCloud()"
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
import { useTelemetry } from '@comfyorg/telemetry'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { UncheckedModelInput } from '@/platform/openOnCloud/cloudWorkflowCheck'
import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'

const {
  asksToSignIn,
  workspaceId,
  uncheckedInputs = [],
  needsConsent = false,
  checking = false
} = defineProps<{
  asksToSignIn: boolean
  workspaceId?: string
  uncheckedInputs?: UncheckedModelInput[]
  needsConsent?: boolean
  checking?: boolean
}>()

const { t } = useI18n()

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

const primaryLabel = computed(() => {
  if (checking) return t('openOnCloud.cloudButton.checking')
  return needsConsent
    ? t('openOnCloud.runDialog.checkCompatibility')
    : t('openOnCloud.runDialog.openOnCloud')
})

const emit = defineEmits<{
  check: []
  done: []
  dismiss: []
}>()

function openOnCloud() {
  useTelemetry()?.trackUiButtonClicked({
    button_id: 'run_on_cloud_open_on_cloud_clicked',
    element_group: 'run_on_cloud'
  })
  void openWorkflowOnCloud(undefined, asksToSignIn ? undefined : workspaceId)
  emit('done')
}
</script>
