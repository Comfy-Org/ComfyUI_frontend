<template>
  <div>
    <Popover
      :open="isVersionSelectorOpen"
      @update:open="isVersionSelectorOpen = $event && !isDisabled"
    >
      <PopoverTrigger as-child>
        <Button
          ref="versionAnchor"
          :tooltip="isDisabled ? $t('manager.enablePackToChangeVersion') : ''"
          variant="textonly"
          size="unset"
          :class="
            cn(
              'gap-1 rounded-2xl py-1 text-xs font-normal',
              fill && 'bg-muted px-1.5',
              isDisabled && 'cursor-not-allowed opacity-60'
            )
          "
          :aria-haspopup="!isDisabled"
          :aria-disabled="isDisabled"
        >
          <i
            v-if="isUpdateAvailable"
            class="pi pi-arrow-circle-up text-xs text-blue-600"
          />
          <span>{{ installedVersion }}</span>
          <i v-if="!isDisabled" class="pi pi-chevron-right text-2xs" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        :collision-padding="8"
        class="w-auto rounded-lg border-border/50 p-0 shadow-lg data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <PackVersionSelectorPopover
          :installed-version="installedVersion"
          :node-pack="nodePack"
          @cancel="closeVersionSelector"
          @submit="closeVersionSelector"
        />
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { valid as validSemver } from 'semver'
import { unrefElement } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { PopoverTrigger } from 'reka-ui'
import Popover from '@/components/ui/popover/Popover.vue'
import PopoverContent from '@/components/ui/popover/PopoverContent.vue'
import Button from '@/components/ui/button/Button.vue'
import { usePopoverViewportDismiss } from '@/components/ui/popover/usePopoverViewportDismiss'
import type { components } from '@/types/comfyRegistryTypes'
import PackVersionSelectorPopover from '@/workbench/extensions/manager/components/manager/PackVersionSelectorPopover.vue'
import { usePackUpdateStatus } from '@/workbench/extensions/manager/composables/nodePack/usePackUpdateStatus'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

const TRUNCATED_HASH_LENGTH = 7

const {
  nodePack,
  isSelected,
  fill = true
} = defineProps<{
  nodePack: components['schemas']['Node']
  isSelected: boolean
  fill?: boolean
}>()

const { isUpdateAvailable } = usePackUpdateStatus(() => nodePack)
const isVersionSelectorOpen = ref(false)
const versionAnchor =
  useTemplateRef<InstanceType<typeof Button>>('versionAnchor')

usePopoverViewportDismiss(isVersionSelectorOpen, () =>
  unrefElement(versionAnchor)
)

const managerStore = useComfyManagerStore()

const isInstalled = computed(() => managerStore.isPackInstalled(nodePack?.id))
const isDisabled = computed(
  () => isInstalled.value && !managerStore.isPackEnabled(nodePack?.id)
)

const installedVersion = computed(() => {
  if (!nodePack.id) return 'nightly'
  const version =
    managerStore.installedPacks[nodePack.id]?.ver ??
    nodePack.latest_version?.version ??
    'nightly'

  // If Git hash, truncate to 7 characters
  return validSemver(version)
    ? version
    : version.slice(0, TRUNCATED_HASH_LENGTH)
})

const closeVersionSelector = () => {
  isVersionSelectorOpen.value = false
}

watch(
  () => isSelected,
  (isSelected, wasSelected) => {
    if (wasSelected && !isSelected) {
      closeVersionSelector()
    }
  }
)
</script>
