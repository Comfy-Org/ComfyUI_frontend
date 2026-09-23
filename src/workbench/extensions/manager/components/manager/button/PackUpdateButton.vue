<template>
  <ButtonGroup class="shrink-0">
    <Button
      v-tooltip.top="
        hasDisabledUpdatePacks
          ? $t('manager.disabledNodesWontUpdate')
          : $t('manager.updateLatestActiveTooltip')
      "
      variant="primary"
      :size
      class="flex-1 rounded-r-none"
      :disabled="isUpdating || !enabledPacks.length"
      @click="manager.updatePacks(nodePacks)"
    >
      <DotSpinner v-if="isUpdating" duration="1s" />
      <i v-else class="icon-[lucide--refresh-cw]" />
      <span>{{
        nodePacks.length > 1 ? $t('manager.updateAll') : $t('manager.update')
      }}</span>
    </Button>
    <DropdownMenu :entries="updateOptions" align="end">
      <template #button>
        <Button
          variant="primary"
          :size
          class="shrink-0 rounded-l-none border-0 border-l border-solid border-border-subtle px-3"
          :disabled="isUpdating || !enabledPacks.length"
          :aria-label="$t('manager.updateOptions')"
        >
          <TinyChevronIcon />
        </Button>
      </template>
    </DropdownMenu>
  </ButtonGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TinyChevronIcon from '@/components/actionbar/TinyChevronIcon.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import type { ButtonVariants } from '@/components/ui/button/button.variants'
import Button from '@/components/ui/button/Button.vue'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

type NodePack = components['schemas']['Node']

const {
  nodePacks,
  hasDisabledUpdatePacks,
  size = 'sm'
} = defineProps<{
  nodePacks: NodePack[]
  hasDisabledUpdatePacks?: boolean
  size?: ButtonVariants['size']
}>()

const manager = useComfyManagerStore()
const { t } = useI18n()
const enabledPacks = computed(() =>
  nodePacks.filter((pack) => manager.isPackEnabled(pack.id))
)
const isUpdating = computed(() =>
  enabledPacks.value.some((pack) => manager.isPackInstalling(pack.id))
)
const updateOptions = computed(() => [
  {
    label: t('manager.latestActive'),
    tooltip: t('manager.updateLatestActiveTooltip'),
    command: () => manager.updatePacks(nodePacks, 'active')
  },
  {
    label: t('manager.latestInstallable'),
    tooltip: t('manager.updateLatestInstallableTooltip'),
    command: () => manager.updatePacks(nodePacks, 'installable')
  }
])
</script>
