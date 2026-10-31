<template>
  <DefineOption v-slot="{ choice }">
    <span class="flex w-full min-w-0 items-center gap-1.5">
      <span class="truncate">{{
        deploymentRowLabels(choice.deployment).title
      }}</span>
      <span
        v-if="deploymentRowLabels(choice.deployment).name"
        class="truncate text-muted-foreground"
      >
        {{ deploymentRowLabels(choice.deployment).name }}
      </span>
      <span
        v-if="deploymentRowLabels(choice.deployment).detail"
        class="shrink-0 text-xs text-muted-foreground"
      >
        {{ deploymentRowLabels(choice.deployment).detail }}
      </span>
      <span
        :class="
          cn(
            'ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs',
            runs(choice) ? 'text-success' : 'text-muted-foreground'
          )
        "
      >
        <i
          v-if="runs(choice)"
          class="icon-[lucide--circle-check] size-3"
          aria-hidden="true"
        />
        {{ markText(choice) }}
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
            :model-value="selected?.deployment.deployment_id"
            @update:model-value="choose"
          >
            <SelectTrigger :id="selectId">
              <ReuseOption v-if="selected" :choice="selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="choice in choices"
                :key="choice.deployment.deployment_id"
                :value="choice.deployment.deployment_id"
                :disabled="!canSwitchTo(choice)"
                class="py-1.5"
                text-class="min-w-0 flex-1"
                reserve-indicator
              >
                <ReuseOption :choice="choice" />
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
            class="icon-[lucide--square-arrow-out-up-right]"
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
import { cn } from '@comfyorg/tailwind-utils'
import { createReusableTemplate } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import type { AcceptableValue } from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Select from '@comfyorg/design-system/select/Select'
import SelectContent from '@comfyorg/design-system/select/SelectContent'
import SelectItem from '@comfyorg/design-system/select/SelectItem'
import SelectTrigger from '@comfyorg/design-system/select/SelectTrigger'
import { useToast } from '@/components/ui/toast/toastStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'
import DeploymentDocsLink from '@/platform/workspace/components/DeploymentDocsLink.vue'
import MissingItemsTable from '@/platform/workspace/components/MissingItemsTable.vue'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { customDeploymentCreateUrl } from '@/platform/workspace/customDeploymentPitch'
import type { MissingItemsRow } from '@/platform/workspace/customDeploymentPitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { useDeploymentSwitchGuard } from '@/platform/workspace/composables/useDeploymentSwitchGuard'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { canSwitchTo } from '@/platform/workspace/workflowDeploymentOffer'
import type { DeploymentChoice } from '@/platform/workspace/workflowDeploymentOffer'

const { choices, missing } = defineProps<{
  choices: readonly DeploymentChoice[]
  missing: readonly MissingItemsRow[]
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

const { t } = useI18n()
const pickStore = useDeploymentPickStore()
const { isSwitching: isPicking, changeSinceBoot } = storeToRefs(pickStore)
const { deploymentRowLabels, deploymentFullLabel } = useDeploymentLabels()
const { withoutLeavePrompt } = useDeploymentSwitchGuard()

const [DefineOption, ReuseOption] = createReusableTemplate<{
  choice: DeploymentChoice
}>()

const selectId = useId()
const createDeploymentUrl = customDeploymentCreateUrl()

function runs(choice: DeploymentChoice): boolean {
  return choice.mark?.kind === 'runs'
}

function markText({ mark }: DeploymentChoice): string {
  if (mark?.kind === 'runs') return t('deploymentSwitcher.runsThisWorkflow')
  if (mark?.kind !== 'missing') return t('deploymentSwitcher.notChecked')
  return t('deploymentSwitcher.missingNodes', mark.nodeTypes.length)
}

const chosenId = ref<string>()
const selected = computed(
  () =>
    choices.find(
      (choice) =>
        canSwitchTo(choice) &&
        choice.deployment.deployment_id === chosenId.value
    ) ?? choices.find(canSwitchTo)
)

function choose(value: AcceptableValue) {
  if (typeof value === 'string') chosenId.value = value
}

const isSettling = ref(false)
const isSwitching = computed(() => isSettling.value || isPicking.value)

function landWhenAlreadyPicked() {
  if (isPicking.value || changeSinceBoot.value === null) return
  const keepLeavePrompt = skipLeavePromptOnce()
  reloadForDeploymentSwitch(() => {
    keepLeavePrompt()
    void pickStore.load()
  })
}

async function switchDeployment() {
  const deployment = selected.value?.deployment
  if (!deployment || isSwitching.value) return
  isSettling.value = true
  try {
    const confirmed = await confirmUnsavedWorkBeforeSwitch(
      deploymentFullLabel(deployment)
    )
    if (!confirmed) return
    const refusal = await withoutLeavePrompt(() =>
      pickStore.pick(deployment.deployment_id)
    )
    if (refusal === null) {
      landWhenAlreadyPicked()
      return
    }
    useToast().error(t('deploymentSwitcher.failedToSwitch'), {
      description: refusal,
      duration: 8000
    })
  } finally {
    isSettling.value = false
  }
}
</script>
