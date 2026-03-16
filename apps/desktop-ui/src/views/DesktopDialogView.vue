<template>
  <div class="flex size-full flex-col justify-between rounded-lg p-6">
    <h1 class="m-0 font-inter text-xl font-semibold italic">
      {{ $t(`desktopDialogs.${id}.title`, title) }}
    </h1>
    <p class="whitespace-pre-wrap">
      {{ $t(`desktopDialogs.${id}.message`, message) }}
    </p>
    <div class="flex w-full gap-2">
      <Button
        v-for="button in buttons"
        :key="button.label"
        class="rounded-lg first:mr-auto"
        :label="
          $t(
            `desktopDialogs.${id}.buttons.${normalizeI18nKey(button.label)}`,
            button.label
          )
        "
        :severity="button.severity ?? 'secondary'"
        @click="handleButtonClick(button)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { normalizeI18nKey } from '@comfyorg/shared-frontend-utils/formatUtil'
import Button from 'primevue/button'
import { useRoute } from 'vue-router'

import { getDialog } from '@/constants/desktopDialogs'
import type { DialogAction } from '@/constants/desktopDialogs'
import { electronAPI } from '@/utils/envUtil'

const route = useRoute()
const { id, title, message, buttons } = getDialog(route.params.dialogId)

const handleButtonClick = async (button: DialogAction) => {
  await electronAPI().Dialog.clickButton(button.returnValue)
}
</script>
