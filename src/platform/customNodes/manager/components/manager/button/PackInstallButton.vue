<template>
  <Button
    variant="primary"
    :size
    :disabled="isLoading || isInstalling"
    @click.stop="installAllPacks"
  >
    <i
      v-if="hasConflict && !isInstalling && !isLoading"
      class="icon-[lucide--triangle-alert] text-warning"
    />
    <DotSpinner
      v-else-if="isLoading || isInstalling"
      duration="1s"
      :size="size === 'sm' ? 12 : 16"
    />
    <i v-else class="icon-[lucide--download]" />
    <span>{{ computedLabel }}</span>
  </Button>
</template>

<script setup lang="ts">
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import Button from '@comfyorg/design-system/button/Button'
import DotSpinner from '@comfyorg/design-system/common/DotSpinner'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePackInstall } from '@/platform/customNodes/manager/composables/nodePack/usePackInstall'
import type { ConflictDetail } from '@/platform/customNodes/manager/types/conflictDetectionTypes'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

const {
  nodePacks,
  isLoading = false,
  label,
  size = 'sm',
  hasConflict,
  conflictInfo
} = defineProps<{
  nodePacks: NodePack[]
  isLoading?: boolean
  label?: string
  size?: ButtonVariants['size']
  hasConflict?: boolean
  conflictInfo?: ConflictDetail[]
}>()

const { t } = useI18n()

const { isInstalling, installAllPacks } = usePackInstall(
  () => nodePacks,
  () => hasConflict,
  () => conflictInfo
)

const computedLabel = computed(() =>
  isInstalling.value
    ? t('g.installing')
    : (label ??
      (nodePacks.length > 1 ? t('manager.installSelected') : t('g.install')))
)
</script>
