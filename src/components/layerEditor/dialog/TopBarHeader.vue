<template>
  <div class="flex w-full items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <i class="icon-[lucide--layers-2] size-4" />
      <h3 class="m-0 text-sm font-semibold">{{ t('layerEditor.title') }}</h3>
    </div>
    <div class="flex items-center gap-2">
      <div
        id="layer-editor-header-actions"
        class="flex items-center gap-2"
        role="group"
      />
      <DialogClose>
        <Button variant="muted-textonly" size="md">
          {{ t('g.close') }}
          <i class="icon-[lucide--x] size-4" />
        </Button>
      </DialogClose>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'

const { t } = useI18n()
</script>
