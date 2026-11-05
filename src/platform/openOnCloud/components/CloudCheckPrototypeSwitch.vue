<template>
  <Teleport to="body">
    <div
      class="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg bg-secondary p-2 text-xs text-foreground"
    >
      {{ $t('openOnCloud.prototype.label') }}
      <select
        v-model="scenario"
        :aria-label="$t('openOnCloud.prototype.label')"
        class="rounded-sm bg-background p-1"
      >
        <option value="live">{{ $t('openOnCloud.prototype.live') }}</option>
        <option value="compatible">
          {{ $t('openOnCloud.prototype.compatible') }}
        </option>
        <option value="nodePacksMissing">
          {{ $t('openOnCloud.prototype.nodePacksMissing') }}
        </option>
        <option value="modelsMissing">
          {{ $t('openOnCloud.prototype.modelsMissing') }}
        </option>
        <option value="nodePacksAndModelsMissing">
          {{ $t('openOnCloud.prototype.nodePacksAndModelsMissing') }}
        </option>
      </select>
      <label v-if="scenario !== 'live'" class="flex items-center gap-1">
        <input v-model="previewSignedIn" type="checkbox" />
        {{ $t('openOnCloud.prototype.signedIn') }}
      </label>
      <Button
        v-if="scenario !== 'live'"
        size="sm"
        variant="secondary"
        @click="upload.reset()"
      >
        {{ $t('openOnCloud.prototype.resetUpload') }}
      </Button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'

const upload = useModelUploadStore()
const { prototypeScenario: scenario } = storeToRefs(
  useCloudWorkflowCheckStore()
)
const { previewSignedIn } = storeToRefs(useLocalSignInStore())

watch(scenario, (value) => {
  if (value === 'live') previewSignedIn.value = false
  upload.reset()
})
</script>
