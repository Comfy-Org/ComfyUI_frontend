<template>
  <div
    v-if="isVisible"
    :class="
      cn(
        'flex shrink-0 items-center',
        variant === 'floating'
          ? 'pointer-events-auto w-fit floating-panel'
          : 'gap-2'
      )
    "
    data-testid="deployment-switcher"
  >
    <Menu
      v-model:open="isOpen"
      :modal="false"
      :side-offset="variant === 'floating' ? 8 : 4"
      :class="cn('max-w-100 min-w-84', switcherMenuMotionClass)"
      @update:open="onOpenChange"
    >
      <template #trigger>
        <Button
          variant="textonly"
          size="unset"
          :disabled="isSwitching"
          :tooltip="hoverTooltip"
          tooltip-side="bottom"
          :aria-label="triggerLabel"
          :class="
            cn(
              'group max-w-64 gap-2 rounded-lg border border-border-subtle bg-interface-panel-surface pr-2 pl-2.5 font-normal',
              'hover:border-border-default hover:bg-secondary-background data-[state=open]:border-border-default data-[state=open]:bg-secondary-background',
              variant === 'floating' ? 'h-8' : 'h-7'
            )
          "
          data-testid="deployment-switcher-trigger"
        >
          <DeploymentStatusIcon
            :tone="currentTone"
            icon-class="size-4"
            ring-class="ring-2 ring-interface-panel-surface group-hover:ring-secondary-background group-data-[state=open]:ring-secondary-background"
          />
          <span class="truncate" data-testid="deployment-switcher-current">
            {{ currentTitle }}
          </span>
          <i
            class="icon-[lucide--chevron-down] size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Button>
      </template>
      <DeploymentSwitcherList
        :switching-to
        @choose="choose"
        @follow="follow"
        @set-default="changeDefault"
      />
    </Menu>
    <span
      v-if="variant === 'tab'"
      class="h-5 w-px shrink-0 bg-border-subtle"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import DeploymentStatusIcon from '@/platform/workspace/components/DeploymentStatusIcon.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import {
  COMFY_CLOUD_ROW,
  deploymentStatusTone,
  useDeploymentLabels
} from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

const { variant } = defineProps<{
  /** `tab` sits in the workflow tab bar; `floating` sits under the Graph menu. */
  variant: 'tab' | 'floating'
}>()

const { t } = useI18n()
const store = useDeploymentPickStore()
const { pickedDeployment, isVisible, isSwitching } = storeToRefs(store)
const { currentTitle, currentLabel } = useDeploymentLabels()

const isOpen = ref(false)
const switchingTo = ref<string | null>(null)

onMounted(() => {
  void store.load()
})

function onOpenChange(open: boolean) {
  if (open) void store.load()
}

const currentTone = computed(() =>
  pickedDeployment.value
    ? deploymentStatusTone(pickedDeployment.value.status)
    : undefined
)
const triggerLabel = computed(() =>
  t(
    'deploymentSwitcher.triggerLabel',
    { deployment: currentLabel.value },
    { escapeParameter: false }
  )
)
const hoverTooltip = computed(() =>
  t(
    currentTone.value === 'stopped'
      ? 'deploymentSwitcher.stoppedTooltip'
      : 'deploymentSwitcher.currentTooltip',
    { deployment: currentLabel.value },
    { escapeParameter: false }
  )
)

function report(summary: string, refusal: string | null) {
  if (refusal === null) return
  isOpen.value = false
  useToast().error(summary, { description: refusal, duration: 8000 })
}

async function choose(deploymentId: string | null) {
  switchingTo.value = deploymentId ?? COMFY_CLOUD_ROW
  report(t('deploymentSwitcher.failedToSwitch'), await store.pick(deploymentId))
}

async function follow() {
  report(t('deploymentSwitcher.failedToSwitch'), await store.followWorkspace())
}

async function changeDefault(deploymentId: string | null) {
  report(
    t('deploymentSwitcher.failedToSetDefault'),
    await store.setDefault(deploymentId)
  )
}
</script>
