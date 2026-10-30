<template>
  <DeploySetupCard
    v-if="verdict?.kind === 'missing'"
    :title-id
    :video-sources="DEPLOY_VIDEO_SOURCES"
    :poster-src="DEPLOY_VIDEO_POSTER_SRC"
    @done="emit('done')"
    @dismiss="emit('dismiss')"
  />
  <DeploymentDialogFrame
    v-else-if="verdict"
    data-testid="run-on-cloud-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{ $t('openOnCloud.cloudButton.dialogTitle') }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{
          verdict.kind === 'signedOut'
            ? $t('openOnCloud.cloudButton.signedOut')
            : $t('openOnCloud.cloudButton.ready')
        }}
      </p>
      <footer class="flex items-center justify-end gap-2.5 pt-3">
        <Button variant="secondary" size="lg" @click="emit('dismiss')">
          {{ $t('g.cancel') }}
        </Button>
        <Button
          v-if="verdict.kind === 'signedOut'"
          variant="inverted"
          size="lg"
          @click="signIn"
        >
          {{ $t('openOnCloud.cloudButton.signIn') }}
        </Button>
        <Button v-else variant="inverted" size="lg" @click="openOnCloud">
          {{ $t('openOnCloud.cloudButton.openOnCloud') }}
          <i class="icon-[lucide--external-link]" aria-hidden="true" />
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useErrorHandling } from '@/composables/useErrorHandling'
import DeploySetupCard from '@/platform/openOnCloud/components/DeploySetupCard.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import {
  DEPLOY_VIDEO_POSTER_SRC,
  DEPLOY_VIDEO_SOURCES
} from '@/platform/workflow/deploy/constants'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { titleId } = defineProps<{
  titleId?: string
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { state } = storeToRefs(useCloudWorkflowCheckStore())
const { showSignInDialog } = useAuthDialogs()
const { toastErrorHandler } = useErrorHandling()

const verdict = computed(() =>
  state.value.phase === 'answered' ? state.value.verdict : null
)

function openOnCloud() {
  openWorkflowOnCloud().catch(toastErrorHandler)
  emit('done')
}

function signIn() {
  showSignInDialog().catch(toastErrorHandler)
  emit('done')
}
</script>
