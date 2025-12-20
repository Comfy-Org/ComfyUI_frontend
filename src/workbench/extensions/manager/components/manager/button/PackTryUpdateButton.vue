<template>
  <IconTextButton
    v-tooltip.top="$t('manager.tryUpdateTooltip')"
    v-bind="$attrs"
    type="transparent"
    :label="computedLabel"
    :border="true"
    :size="size"
    :disabled="isUpdating"
    @click="tryUpdate"
  >
    <template v-if="isUpdating" #icon>
      <DotSpinner duration="1s" :size="size === 'sm' ? 12 : 16" />
    </template>
  </IconTextButton>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import IconTextButton from '@/components/button/IconTextButton.vue'
import DotSpinner from '@/components/common/DotSpinner.vue'
import type { ButtonSize } from '@/types/buttonTypes'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'

type NodePack = components['schemas']['Node']

const { nodePack, size = 'sm' } = defineProps<{
  nodePack: NodePack
  size?: ButtonSize
}>()

const { t } = useI18n()
const managerStore = useComfyManagerStore()

const isUpdating = ref(false)

async function tryUpdate() {
  if (!nodePack.id) {
    console.warn('Pack missing required id:', nodePack)
    return
  }

  isUpdating.value = true
  try {
    await managerStore.updatePack.call({
      id: nodePack.id,
      version: 'nightly'
    })
    managerStore.updatePack.clear()
  } catch (error) {
    console.error('Nightly update failed:', error)
  } finally {
    isUpdating.value = false
  }
}

const computedLabel = computed(() =>
  isUpdating.value ? t('g.updating') : t('manager.tryUpdate')
)
</script>
