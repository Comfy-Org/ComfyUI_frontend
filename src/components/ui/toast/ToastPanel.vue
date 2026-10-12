<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

const { visible, announcement = '' } = defineProps<{
  visible: boolean
  announcement?: string
}>()

const isExpanded = defineModel<boolean>('expanded', { default: false })

function toggle() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div role="status" aria-atomic="true" class="sr-only">
    <template v-if="visible">{{ announcement }}</template>
  </div>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-full opacity-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="visible"
      data-testid="toast-panel"
      :class="
        cn(
          'w-full max-w-3xl overflow-hidden rounded-lg border border-border-default bg-base-background shadow-lg transition-all duration-300',
          isExpanded ? 'sm:w-[max(400px,40vw)]' : 'sm:w-fit'
        )
      "
    >
      <div
        :class="
          cn(
            'max-w-full min-w-0 overflow-hidden transition-all duration-300',
            isExpanded ? 'max-h-100 w-full' : 'max-h-0 w-0'
          )
        "
      >
        <slot />
      </div>

      <slot name="footer" :toggle />
    </div>
  </Transition>
</template>
