<template>
  <DeploymentDialogFrame
    :wide="state.phase === 'picking'"
    data-testid="build-custom-nodes-dialog"
    @dismiss="dismiss"
  >
    <BuildLoadingStep v-if="state.phase === 'loading'" />
    <BuildDialogStep
      v-else-if="state.phase === 'loadFailed'"
      :title="$t('buildCustomNodes.loadFailed.title')"
      :description="state.message"
    >
      <template #actions>
        <Button variant="secondary" size="lg" @click="dismiss">
          {{ $t('g.close') }}
        </Button>
        <Button variant="inverted" size="lg" @click="store.reload()">
          {{ $t('g.retry') }}
        </Button>
      </template>
    </BuildDialogStep>
    <BuildCustomNodesReadOnly
      v-else-if="state.phase === 'viewing'"
      :session="state.session"
      @close="dismiss"
    />
    <NodePackPicker
      v-else-if="state.phase === 'picking'"
      :session="state.session"
      @toggle="store.togglePack"
      @choose="store.chooseVersion"
      @review="store.review()"
      @cancel="dismiss"
    />
    <NodePackReview
      v-else-if="state.phase === 'reviewing' || state.phase === 'submitting'"
      :session="state.session"
      :refusal="state.phase === 'reviewing' ? state.refusal : null"
      :submitting="state.phase === 'submitting'"
      @back="store.backToPicking()"
      @submit="store.submit()"
    />
    <ReleaseBuildProgress
      v-else-if="state.phase === 'building'"
      :session="state.session"
      :version="state.release?.version ?? null"
      :progress="state.progress"
      :started-at="state.startedAt"
      @close="emit('dismiss')"
    />
    <ReleaseBuildFailed
      v-else-if="state.phase === 'buildFailed'"
      :session="state.session"
      :release="state.release"
      @change="store.backToPicking()"
      @retry="store.retryBuild()"
    />
    <ReleaseMoveProgress
      v-else-if="state.phase === 'redeploying'"
      :session="state.session"
      :release="state.release"
      @close="emit('dismiss')"
    />
    <ReleaseMoveFailed
      v-else-if="state.phase === 'moveFailed'"
      :session="state.session"
      :release="state.release"
      :message="state.message"
      @close="dismiss"
      @retry="store.retryMove()"
    />
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { useBuildCustomNodesStore } from '@/platform/workspace/buildCustomNodes/buildCustomNodesStore'
import BuildCustomNodesReadOnly from '@/platform/workspace/buildCustomNodes/components/BuildCustomNodesReadOnly.vue'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import BuildLoadingStep from '@/platform/workspace/buildCustomNodes/components/BuildLoadingStep.vue'
import NodePackPicker from '@/platform/workspace/buildCustomNodes/components/NodePackPicker.vue'
import NodePackReview from '@/platform/workspace/buildCustomNodes/components/NodePackReview.vue'
import ReleaseBuildFailed from '@/platform/workspace/buildCustomNodes/components/ReleaseBuildFailed.vue'
import ReleaseBuildProgress from '@/platform/workspace/buildCustomNodes/components/ReleaseBuildProgress.vue'
import ReleaseMoveFailed from '@/platform/workspace/buildCustomNodes/components/ReleaseMoveFailed.vue'
import ReleaseMoveProgress from '@/platform/workspace/buildCustomNodes/components/ReleaseMoveProgress.vue'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const store = useBuildCustomNodesStore()
const { state } = storeToRefs(store)

function dismiss() {
  store.dismiss()
  emit('dismiss')
}

watch(
  () => state.value.phase,
  (phase) => {
    if (phase === 'idle') emit('done')
  }
)
</script>
