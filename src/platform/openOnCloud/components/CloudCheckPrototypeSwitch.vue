<template>
  <Teleport to="body">
    <div
      role="group"
      :aria-label="$t('openOnCloud.prototype.label')"
      class="pointer-events-auto fixed right-4 bottom-4 z-3000 flex w-96 flex-col gap-1.5 rounded-lg border border-border bg-background p-2 text-xs shadow-lg"
      data-dismissable-layer
      data-testid="cloud-check-prototype-switch"
    >
      <span class="px-1 text-muted-foreground">
        {{ $t('openOnCloud.prototype.label') }}
      </span>
      <ToggleGroup
        v-model="prototypeScenario"
        type="single"
        :allow-empty="false"
        class="grid grid-cols-2"
      >
        <ToggleGroupItem
          v-for="scenario in scenarios"
          :key="scenario.value"
          :value="scenario.value"
          size="sm"
          class="h-auto min-h-6 justify-start px-2.5 py-1 text-left"
        >
          {{ scenario.label }}
        </ToggleGroupItem>
      </ToggleGroup>
      <div class="flex items-center gap-1.5">
        <span class="w-20 shrink-0 px-1 text-muted-foreground">
          {{ $t('openOnCloud.prototype.account') }}
        </span>
        <ToggleGroup v-model="account" type="single" :allow-empty="false">
          <ToggleGroupItem value="signedIn" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.signedIn') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="signedOut" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.signedOut') }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-20 shrink-0 px-1 text-muted-foreground">
          {{ $t('openOnCloud.prototype.library') }}
        </span>
        <ToggleGroup
          v-model="prototypeLibrary"
          type="single"
          :allow-empty="false"
        >
          <ToggleGroupItem value="lacksModels" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.libraryLacksModels') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="hasModels" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.libraryHasModels') }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-20 shrink-0 px-1 text-muted-foreground">
          {{ $t('openOnCloud.prototype.localAgent') }}
        </span>
        <ToggleGroup
          v-model="prototypeAgent"
          type="single"
          :allow-empty="false"
        >
          <ToggleGroupItem value="found" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.agentFound') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="notFound" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.agentNotFound') }}
          </ToggleGroupItem>
          <ToggleGroupItem value="hidden" size="sm" class="px-2.5">
            {{ $t('openOnCloud.prototype.agentHidden') }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          class="h-7"
          data-testid="prototype-reset-upload"
          @click="uploadStore.reset()"
        >
          <i class="icon-[lucide--rotate-ccw] size-3.5" aria-hidden="true" />
          {{ $t('openOnCloud.prototype.resetUpload') }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          class="h-7"
          data-testid="prototype-simulate-out-of-memory"
          @click="simulateOutOfMemory"
        >
          <i class="icon-[lucide--memory-stick] size-3.5" aria-hidden="true" />
          {{ $t('openOnCloud.prototype.simulateOutOfMemory') }}
        </Button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import ToggleGroup from '@comfyorg/design-system/toggle-group/ToggleGroup'
import ToggleGroupItem from '@comfyorg/design-system/toggle-group/ToggleGroupItem'
import type { PrototypeScenario } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { prototypeOutOfMemoryError } from '@/platform/openOnCloud/prototypeOutOfMemory'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import { useModelUploadStore } from '@/platform/openOnCloud/stores/modelUploadStore'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

const { t } = useI18n()
const scenarios = computed<{ value: PrototypeScenario; label: string }[]>(
  () => [
    { value: 'compatible', label: t('openOnCloud.prototype.compatible') },
    {
      value: 'nodePacksMissing',
      label: t('openOnCloud.prototype.nodePacksMissing')
    },
    { value: 'modelsMissing', label: t('openOnCloud.prototype.modelsMissing') },
    {
      value: 'nodePacksAndModelsMissing',
      label: t('openOnCloud.prototype.nodePacksAndModelsMissing')
    },
    { value: 'checking', label: t('openOnCloud.prototype.checking') }
  ]
)

const { prototypeScenario, prototypeLibrary } = storeToRefs(
  useCloudWorkflowCheckStore()
)
const { signedIn } = storeToRefs(useLocalSignInStore())
const account = computed({
  get: () => (signedIn.value ? 'signedIn' : 'signedOut'),
  set: (value) => {
    signedIn.value = value === 'signedIn'
  }
})
const { prototypeAgent } = storeToRefs(useLocalAgentStore())
const uploadStore = useModelUploadStore()
const executionErrorStore = useExecutionErrorStore()

watch([prototypeScenario, prototypeLibrary, signedIn], () =>
  uploadStore.cancel()
)

function simulateOutOfMemory() {
  const error = prototypeOutOfMemoryError(app.rootGraph.nodes, Date.now())
  if (!error) return
  executionErrorStore.recordExecutionError(error)
  executionErrorStore.showExecutionError(error)
}
</script>
