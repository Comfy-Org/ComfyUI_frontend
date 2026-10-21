<template>
  <DefineOption v-slot="{ deployment }">
    <span class="flex min-w-0 items-center gap-1.5">
      <span class="truncate">{{ deploymentTitle(deployment) }}</span>
      <span
        v-if="deploymentRowSubtitle(deployment)"
        class="truncate text-muted-foreground"
      >
        {{ deploymentRowSubtitle(deployment) }}
      </span>
      <span
        class="ml-2 flex shrink-0 items-center gap-1 text-xs text-success-background"
      >
        <i class="icon-[lucide--circle-check] size-3" aria-hidden="true" />
        {{ $t('deploymentSwitcher.runsThisWorkflow') }}
      </span>
    </span>
  </DefineOption>

  <DeploymentDialogFrame
    data-testid="switch-deployment-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-7 px-6 pt-9 pb-6 @xl:px-9 @xl:pb-8">
      <div class="flex flex-col gap-3">
        <DialogTitle class="my-0 pr-8 text-xl @xl:text-2xl">
          {{ $t('deploymentSwitcher.workflowNeedsDeployment.title') }}
        </DialogTitle>
        <MissingItemsTable v-if="missing.length > 0" :rows="missing" />
        <div class="mt-1 mb-2 flex flex-col gap-2">
          <label :for="selectId" class="text-sm/5 text-muted-foreground">
            {{ $t('deploymentSwitcher.runOn') }}
          </label>
          <Select
            :model-value="selected?.deployment_id"
            @update:model-value="choose"
          >
            <SelectTrigger :id="selectId">
              <ReuseOption v-if="selected" :deployment="selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="deployment in deployments"
                :key="deployment.deployment_id"
                :value="deployment.deployment_id"
              >
                <ReuseOption :deployment="deployment" />
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="my-0 text-sm/5 text-muted-foreground">
          {{ $t('deploymentSwitcher.workflowNeedsDeployment.switchBody') }}
        </p>
        <DeploymentDocsLink class="@xl:hidden" />
      </div>

      <footer
        class="flex flex-col-reverse gap-2.5 @xl:flex-row @xl:items-center @xl:justify-end"
      >
        <DeploymentDocsLink class="hidden @xl:mr-auto @xl:inline-flex" />
        <Button
          variant="secondary"
          size="lg"
          class="w-full no-underline @xl:w-auto"
          as="a"
          :href="createDeploymentUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click="emit('done')"
        >
          {{ $t('deploymentSwitcher.customDeployment.createOnPlatform') }}
          <i
            class="icon-[lucide--square-arrow-out-up-right] size-4"
            aria-hidden="true"
          />
        </Button>
        <Button
          variant="inverted"
          size="lg"
          class="w-full @xl:w-auto"
          :loading="isSwitching"
          @click="switchDeployment"
        >
          {{ $t('deploymentSwitcher.workflowNeedsDeployment.switch') }}
        </Button>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { AcceptableValue } from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import DeploymentDocsLink from '@/platform/workspace/components/DeploymentDocsLink.vue'
import MissingItemsTable from '@/platform/workspace/components/MissingItemsTable.vue'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import type { MissingItemsRow } from '@/platform/workspace/customDeploymentPitch'
import { settleUnsavedWorkBeforeSwitch } from '@/platform/workspace/settleUnsavedWorkBeforeSwitch'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { deployments, missing } = defineProps<{
  /** The deployments the compatibility check says run the workflow, in switcher order. */
  deployments: readonly WorkspaceDeployment[]
  missing: readonly MissingItemsRow[]
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { t } = useI18n()
const pickStore = useDeploymentPickStore()
const { isSwitching: isPicking } = storeToRefs(pickStore)
const { deploymentTitle, deploymentRowSubtitle, deploymentFullLabel } =
  useDeploymentLabels()

const [DefineOption, ReuseOption] = createReusableTemplate<{
  deployment: WorkspaceDeployment
}>()

const selectId = useId()
const createDeploymentUrl = customDeploymentCreateUrl()

const chosenId = ref<string>()
const selected = computed(
  () =>
    deployments.find(
      (deployment) => deployment.deployment_id === chosenId.value
    ) ?? deployments[0]
)

function choose(value: AcceptableValue) {
  if (typeof value === 'string') chosenId.value = value
}

const isSettling = ref(false)
const isSwitching = computed(() => isSettling.value || isPicking.value)

async function switchDeployment() {
  const deployment = selected.value
  if (!deployment || isSwitching.value) return
  isSettling.value = true
  try {
    const discarded = await settleUnsavedWorkBeforeSwitch(
      deploymentFullLabel(deployment)
    )
    if (discarded === null) return
    const refusal = await pickStore.pick(deployment.deployment_id, discarded)
    if (refusal === null) return
    useToast().error(t('deploymentSwitcher.failedToSwitch'), {
      description: refusal,
      duration: 8000
    })
  } finally {
    isSettling.value = false
  }
}
</script>
