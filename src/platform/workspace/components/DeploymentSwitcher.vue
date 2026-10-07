<!-- Which developer-platform deployment this browser runs on, and the list
     it may pick from (FE-2434). Each row is a deployment with the Release it
     runs now; a pick follows the deployment when its owner updates it. Sits under the workspace selector in the user
     popover. Renders nothing until a listing answers, when the account is
     outside the rollout, and when loading fails with no listing to show; a
     reload keeps the last listing on screen until it answers, and a listing
     that answered stays shown when a newer load fails or never answers.
     Shows the workspace's default deployment when an owner set one (BE-17480):
     a browser with no pick of its own follows it, and an owner sets or
     clears it from the panel's footer. A pick the listing no longer has
     shows as Comfy Cloud, which is what ingest serves it. When a listing
     shows this page now runs on other nodes than it booted with (changed
     elsewhere), a notice under the label offers a reload. The missing-nodes
     message can ask for it to open (BE-19374). -->
<template>
  <div v-if="isVisible" class="relative" data-testid="deployment-switcher">
    <button
      ref="trigger"
      type="button"
      class="flex w-full cursor-pointer appearance-none items-center justify-between rounded-lg border-0 bg-transparent px-4 py-2 text-left hover:bg-secondary-background-hover disabled:cursor-wait"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      aria-controls="deployment-switcher-panel"
      :disabled="isSwitching"
      data-testid="deployment-switcher-trigger"
      @click="isOpen = !isOpen"
      @keydown.escape.stop="isOpen = false"
    >
      <div class="flex w-0 flex-1 items-center gap-2">
        <i
          class="icon-[lucide--package] size-4 shrink-0 text-muted-foreground"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-xs text-muted-foreground">
            {{ $t('deploymentSwitcher.runningOn') }}
          </span>
          <span
            class="truncate text-sm text-base-foreground"
            data-testid="deployment-switcher-current"
          >
            {{ currentLabel }}
          </span>
          <span
            v-if="note"
            class="text-xs text-muted-foreground"
            :data-testid="note.testId"
          >
            {{ note.text }}
          </span>
        </div>
      </div>
      <i class="pi pi-chevron-down shrink-0 text-sm text-muted-foreground" />
    </button>

    <div
      v-if="changeSinceBoot"
      role="status"
      class="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground"
      data-testid="deployment-switcher-changed"
    >
      <span class="min-w-0 flex-1">{{ changeMessage }}</span>
      <Button
        variant="secondary"
        size="sm"
        data-testid="deployment-switcher-reload"
        @click="reloadPage"
      >
        {{ $t('deploymentSwitcher.reload') }}
      </Button>
    </div>

    <div
      v-if="isOpen"
      id="deployment-switcher-panel"
      ref="panel"
      role="menu"
      class="absolute top-0 right-full z-10 mr-4 flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
      data-testid="deployment-switcher-panel"
    >
      <div
        class="flex scrollbar-custom min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <DeploymentSwitcherList @choose="choose" @follow="follow" />
      </div>
      <DeploymentSwitcherOwnerFooter
        v-if="canSetDefault"
        :default-label="hasDefault ? defaultLabel : null"
        :can-set-picked="canSetPicked"
        :disabled="isSwitching"
        @set-default="changeDefault(pickedDeploymentId)"
        @clear-default="changeDefault(null)"
      />
      <div
        class="shrink-0 border-t border-border-default px-4 py-2 text-xs text-muted-foreground"
      >
        {{ $t('deploymentSwitcher.reloadNote') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import DeploymentSwitcherOwnerFooter from '@/platform/workspace/components/DeploymentSwitcherOwnerFooter.vue'
import DeploymentSwitcherList from '@/platform/workspace/components/DeploymentSwitcherList.vue'
import { useDeploymentLabels } from '@/platform/workspace/composables/useDeploymentLabels'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

const { t } = useI18n()
const store = useDeploymentPickStore()
const {
  pickedDeploymentId,
  pickedDeployment,
  goneDeployment,
  defaultDeploymentId,
  followsWorkspace,
  canSetDefault,
  isVisible,
  isSwitching,
  changeSinceBoot
} = storeToRefs(store)

const isOpen = ref(false)

watch(
  () => store.switcherOpenRequested,
  (requested) => {
    if (!requested) return
    isOpen.value = true
    store.switcherOpenRequested = false
  },
  { immediate: true }
)
const trigger = useTemplateRef('trigger')
const panel = useTemplateRef('panel')

onClickOutside(
  panel,
  () => {
    isOpen.value = false
  },
  { ignore: [trigger] }
)

onMounted(() => {
  void store.load()
})

const { currentLabel, defaultLabel } = useDeploymentLabels()

const hasDefault = computed(() => defaultDeploymentId.value !== null)
/**
 * Under the label: that what this browser would run on is gone, or that it
 * has no pick of its own and so runs on the workspace default.
 */
const note = computed(() => {
  if (goneDeployment.value === 'pick') {
    return {
      testId: 'deployment-switcher-gone',
      text: t('deploymentSwitcher.pickGone')
    }
  }
  if (goneDeployment.value === 'default') {
    return {
      testId: 'deployment-switcher-gone',
      text: t('deploymentSwitcher.defaultGone')
    }
  }
  if (followsWorkspace.value && hasDefault.value) {
    return {
      testId: 'deployment-switcher-following',
      text: t('deploymentSwitcher.workspaceDefault')
    }
  }
  return null
})
const changeMessage = computed(() =>
  changeSinceBoot.value === 'release'
    ? t('deploymentSwitcher.releaseChanged')
    : t(
        'deploymentSwitcher.deploymentChanged',
        { deployment: currentLabel.value },
        { escapeParameter: false }
      )
)

function reloadPage() {
  window.location.reload()
}

const canSetPicked = computed(
  () =>
    pickedDeployment.value !== null &&
    pickedDeploymentId.value !== defaultDeploymentId.value
)

function report(summary: string, refusal: string | null) {
  if (refusal === null) return
  isOpen.value = false
  useToastStore().add({
    severity: 'error',
    summary,
    detail: refusal,
    life: 8000
  })
}

async function choose(deploymentId: string | null) {
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
