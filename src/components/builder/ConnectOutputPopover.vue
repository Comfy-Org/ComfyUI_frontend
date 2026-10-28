<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent
      align="end"
      :side-offset="18"
      data-testid="builder-connect-output-popover"
      class="w-80 rounded-xl p-0"
    >
      <div class="flex h-12 items-center justify-between px-4">
        <h3 class="text-sm font-medium">
          {{ t('builderToolbar.connectOutput') }}
        </h3>
        <PopoverClose
          :aria-label="t('g.close')"
          class="flex cursor-pointer appearance-none items-center justify-center border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
        >
          <i class="icon-[lucide--x]" />
        </PopoverClose>
      </div>
      <div class="border-t" />
      <p class="mt-3 px-4 text-xs/relaxed text-muted-foreground">
        {{ t('builderToolbar.connectOutputBody1') }}
      </p>
      <p
        v-if="!isSelectActive"
        class="mt-2 px-4 text-xs/relaxed text-muted-foreground"
      >
        {{ t('builderToolbar.connectOutputBody2') }}
      </p>
      <div class="mt-4 flex items-center justify-end gap-2 px-4 pb-4">
        <template v-if="isSelectActive">
          <PopoverClose as-child>
            <Button variant="secondary" size="md">
              {{ t('g.ok') }}
            </Button>
          </PopoverClose>
        </template>
        <template v-else>
          <PopoverClose as-child>
            <Button variant="muted-textonly" size="md">
              {{ t('g.cancel') }}
            </Button>
          </PopoverClose>
          <PopoverClose as-child>
            <Button
              variant="secondary"
              size="md"
              data-testid="builder-connect-output-switch"
              @click="emit('switch')"
            >
              {{ t('builderToolbar.switchToOutputs') }}
            </Button>
          </PopoverClose>
        </template>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverClose, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'

const { isSelectActive = false } = defineProps<{
  isSelectActive?: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  switch: []
}>()
</script>
