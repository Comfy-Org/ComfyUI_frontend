<template>
  <div class="px-4 pb-2">
    <!-- Sub-label: cloud or OSS message shown above all pack groups -->
    <p
      class="m-0 text-sm/relaxed text-muted-foreground"
      :class="showManagerHint ? 'pb-3' : 'pb-5'"
    >
      {{
        isCloud
          ? t('rightSidePanel.missingNodePacks.cloudMessage')
          : t('rightSidePanel.missingNodePacks.ossMessage')
      }}
    </p>

    <!-- Manager disabled hint: shown on OSS when manager is not active -->
    <i18n-t
      v-if="showManagerHint"
      keypath="rightSidePanel.missingNodePacks.ossManagerDisabledHint"
      tag="p"
      class="m-0 pb-5 text-sm/relaxed text-muted-foreground"
    >
      <template #pipCmd>
        <code
          class="rounded-sm bg-comfy-menu-bg px-1 py-0.5 font-mono text-xs text-comfy-input-foreground"
          >pip install -U --pre comfyui-manager</code
        >
      </template>
      <template #flag>
        <code
          class="rounded-sm bg-comfy-menu-bg px-1 py-0.5 font-mono text-xs text-comfy-input-foreground"
          >--enable-manager</code
        >
      </template>
    </i18n-t>
    <MissingPackGroupRow
      v-for="group in missingPackGroups"
      :key="group.packId ?? '__unknown__'"
      :group="group"
      :show-info-button="showInfoButton"
      :show-node-id-badge="showNodeIdBadge"
      @locate-node="emit('locateNode', $event)"
      @open-manager-info="emit('openManagerInfo', $event)"
    />
  </div>

  <!-- Apply Changes: shown when manager enabled and at least one pack install succeeded -->
  <div v-if="shouldShowManagerButtons" class="px-4">
    <Button
      v-if="hasInstalledPacksPendingRestart"
      variant="primary"
      :disabled="isRestarting"
      class="mt-2 h-9 w-full justify-center gap-2 text-sm font-semibold"
      @click="applyChanges()"
    >
      <DotSpinner v-if="isRestarting" duration="1s" :size="14" />
      <i v-else class="icon-[lucide--refresh-cw] size-4 shrink-0" />
      <span class="min-w-0 truncate">{{
        t('rightSidePanel.missingNodePacks.applyChanges')
      }}</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import { useApplyChanges } from '@/workbench/extensions/manager/composables/useApplyChanges'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { isCloud } from '@/platform/distribution/types'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import MissingPackGroupRow from '@/components/rightSidePanel/errors/MissingPackGroupRow.vue'

const props = defineProps<{
  showInfoButton: boolean
  showNodeIdBadge: boolean
  missingPackGroups: MissingPackGroup[]
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
  openManagerInfo: [packId: string]
}>()

const { t } = useI18n()

const comfyManagerStore = useComfyManagerStore()
const { isRestarting, applyChanges } = useApplyChanges()
const { shouldShowManagerButtons } = useManagerState()

/**
 * Show the --enable-manager hint when:
 * - Not on Cloud (OSS/local only)
 * - Manager is disabled (showInfoButton is false)
 */
const showManagerHint = computed(() => !isCloud && !props.showInfoButton)

/**
 * Show Apply Changes when any pack from the error group is already installed
 * on disk but ComfyUI hasn't restarted yet to load it.
 * This is server-state based → persists across browser refreshes.
 */
const hasInstalledPacksPendingRestart = computed(() =>
  props.missingPackGroups.some(
    (g) => g.packId !== null && comfyManagerStore.isPackInstalled(g.packId)
  )
)
</script>
