<template>
  <Button
    :tooltip
    variant="primary"
    :size
    :disabled="isInstalling"
    @click.stop="confirmReinstall"
  >
    <DotSpinner
      v-if="isInstalling"
      duration="1s"
      :size="size === 'sm' ? 12 : 16"
    />
    <i v-else class="icon-[lucide--rotate-ccw]" />
    <span>
      {{
        isInstalling
          ? t('manager.invalidInstallation.reinstalling')
          : t('manager.invalidInstallation.reinstall')
      }}
    </span>
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DotSpinner from '@comfyorg/design-system/common/DotSpinner'
import Button from '@comfyorg/design-system/button/Button'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { useDialogService } from '@/services/dialogService'
import type { components } from '@/types/comfyRegistryTypes'
import { createInstallParams } from '@/platform/customNodes/manager/composables/nodePack/usePackInstall'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'

const {
  nodePack,
  size = 'sm',
  tooltip
} = defineProps<{
  nodePack: components['schemas']['Node']
  size?: ButtonVariants['size']
  tooltip?: string
}>()

const { t } = useI18n()
const managerStore = useComfyManagerStore()

const isInstalling = computed(() => managerStore.isPackInstalling(nodePack.id))

async function confirmReinstall() {
  const { id } = nodePack
  if (!id) return

  const name = nodePack.name ?? id
  const confirmed = await useDialogService().confirm({
    title: t('manager.invalidInstallation.confirmTitle', { name }),
    message: t('manager.invalidInstallation.confirmMessage', { name }),
    type: 'reinstall'
  })
  if (!confirmed) return

  await managerStore.reinstallPack(createInstallParams({ ...nodePack, id }))
}
</script>
