<template>
  <div
    v-if="isOffered"
    class="flex shrink-0 items-center"
    data-testid="local-engine-menu"
  >
    <EngineMenu
      v-model:open="isOpen"
      :tooltip="
        $t('deploymentSwitcher.currentTooltip', {
          deployment: $t('openOnCloud.local')
        })
      "
      :label="$t('openOnCloud.triggerLabel')"
      trigger-testid="local-engine-menu-trigger"
      menu-class="w-66"
      @update:open="onOpenChange"
    >
      <template #icon>
        <i class="icon-[lucide--monitor] size-4 shrink-0" aria-hidden="true" />
      </template>
      <DropdownMenuLabel class="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
        {{ $t('openOnCloud.runThisWorkflowOn') }}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="LOCAL_ROW">
        <DeploymentSwitcherRow
          :value="LOCAL_ROW"
          :title="$t('openOnCloud.local')"
          data-testid="engine-row-local"
        >
          <template #icon>
            <i
              class="icon-[lucide--monitor] size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </template>
        </DeploymentSwitcherRow>
      </DropdownMenuRadioGroup>
      <TextTooltip :text="cloudTooltip" side="left">
        <MenuItem
          :disabled="!canOpen"
          :aria-label="canOpen ? $t('openOnCloud.openLabel') : undefined"
          :class="
            cn(switcherItemClass, canOpen && 'data-highlighted:bg-transparent')
          "
          data-testid="engine-row-cloud"
          @select="openOnCloud"
        >
          <svg
            v-if="canOpen"
            class="size-3.5 shrink-0 fill-none stroke-muted-foreground stroke-2"
            viewBox="0 0 24 24"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            data-testid="cloud-ready-icon"
          >
            <path
              d="M5 17.743A7 7 0 1 1 15.71 10h1.79a4.5 4.5 0 0 1 1.5 8.742"
            />
            <path class="stroke-success-background" d="m17 15-5.5 5.5L9 18" />
          </svg>
          <i
            v-else
            class="icon-[lucide--cloud] size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate text-base-foreground">
            {{ $t('deploymentSwitcher.comfyCloud') }}
          </span>
          <span
            class="ml-auto flex shrink-0 items-center gap-1.5 pl-4 text-muted-foreground"
          >
            <template v-if="!verdict">
              <i
                class="icon-[lucide--loader-circle] size-3 animate-spin"
                aria-hidden="true"
              />
              {{ $t('openOnCloud.checking') }}
            </template>
            <span
              v-else-if="canOpen"
              class="-mr-1.5 flex h-5 items-center gap-1 rounded-sm bg-secondary-background pr-1.5 pl-2 font-medium text-base-foreground group-data-highlighted:bg-secondary-background-hover"
            >
              {{ $t('openOnCloud.open') }}
              <i
                class="icon-[lucide--square-arrow-out-up-right] size-3 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <span v-else>{{ missingLabel }}</span>
          </span>
        </MenuItem>
      </TextTooltip>
      <template v-if="gaps">
        <MenuSeparator />
        <MenuItem
          :class="switcherItemClass"
          data-testid="engine-row-deploy"
          @select="deploySetup"
        >
          <i
            class="icon-[lucide--rocket] size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {{ $t('openOnCloud.deploySetup') }}
          <span :class="cn('ml-auto', switcherTrailingSlotClass)">
            <i
              class="icon-[lucide--info] size-3.5 text-muted-foreground"
              role="img"
              :aria-label="$t('openOnCloud.aboutDeploy')"
            />
          </span>
        </MenuItem>
      </template>
    </EngineMenu>
    <CloudCheckPrototypeSwitch />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { DropdownMenuLabel, DropdownMenuRadioGroup } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@/components/ui/menu/MenuItem.vue'
import MenuSeparator from '@/components/ui/menu/MenuSeparator.vue'
import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import CloudCheckPrototypeSwitch from '@/platform/openOnCloud/components/CloudCheckPrototypeSwitch.vue'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { serializeRootGraph } from '@/platform/openOnCloud/serializeRootGraph'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { openDeployToComfyApiDialog } from '@/platform/workflow/deploy/composables/lazyDeployToComfyApiDialog'
import DeploymentSwitcherRow from '@/platform/workspace/components/DeploymentSwitcherRow.vue'
import EngineMenu from '@/platform/workspace/components/EngineMenu.vue'
import {
  switcherItemClass,
  switcherTrailingSlotClass
} from '@/platform/workspace/components/deploymentSwitcherStyles'

const LOCAL_ROW = 'local'

const { t } = useI18n()
const { flags } = useFeatureFlags()
const isOffered = computed(() => !isCloud && flags.openOnCloudEnabled)
const { toastErrorHandler } = useErrorHandling()
const store = useCloudWorkflowCheckStore()
const { state } = storeToRefs(store)

const isOpen = ref(false)

const verdict = computed(() =>
  state.value.phase === 'answered' ? state.value.verdict : null
)
const canOpen = computed(() => verdict.value?.kind === 'canOpen')
const gaps = computed(() =>
  verdict.value?.kind === 'missing' ? verdict.value.gaps : null
)

const missingLabel = computed(() => {
  if (!gaps.value) return ''
  const { nodeTypes, models } = gaps.value
  return nodeTypes.length > 0
    ? t('openOnCloud.nodesMissing', nodeTypes.length)
    : t('openOnCloud.modelsMissing', models.length)
})

const cloudTooltip = computed(() => {
  if (canOpen.value) return t('openOnCloud.openTooltip')
  return gaps.value ? t('openOnCloud.missingTooltip') : ''
})

function onOpenChange(open: boolean) {
  if (!open) return
  const workflow = serializeRootGraph()
  if (workflow) void store.check(workflow)
}

function openOnCloud() {
  void openWorkflowOnCloud()
}

function deploySetup() {
  openDeployToComfyApiDialog().catch(toastErrorHandler)
}
</script>
