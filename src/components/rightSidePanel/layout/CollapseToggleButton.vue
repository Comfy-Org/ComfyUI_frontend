<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-in-out"
    enter-from-class="max-w-0 opacity-0 ml-0"
    enter-to-class="max-w-10 opacity-100 ml-2"
    leave-active-class="transition-all duration-300 ease-in-out"
    leave-from-class="max-w-10 opacity-100 ml-2"
    leave-to-class="max-w-0 opacity-0 ml-0"
  >
    <div v-if="show" class="ml-2 flex items-center overflow-hidden">
      <Button
        :tooltip="isAllCollapsed ? t('g.expandAll') : t('g.collapseAll')"
        tooltip-side="bottom"
        :aria-label="isAllCollapsed ? t('g.expandAll') : t('g.collapseAll')"
        variant="muted-textonly"
        size="icon-sm"
        class="size-8 shrink-0 hover:text-foreground"
        @click="toggle"
      >
        <i
          :class="
            isAllCollapsed
              ? 'icon-[lucide--list-tree]'
              : 'icon-[lucide--list-collapse]'
          "
        />
      </Button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@comfyorg/design-system/button/Button'

const { t } = useI18n()

const isAllCollapsed = defineModel<boolean>({ required: true })

defineProps<{
  show: boolean
}>()

function toggle() {
  isAllCollapsed.value = !isAllCollapsed.value
}
</script>
