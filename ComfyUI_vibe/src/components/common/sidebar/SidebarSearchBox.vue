<script setup lang="ts">
interface Props {
  placeholder?: string
  actionIcon?: string
  actionTooltip?: string
  showAction?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search...',
  actionIcon: 'pi pi-plus',
  actionTooltip: 'Add',
  showAction: false,
})

const model = defineModel<string>({ default: '' })

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex flex-1 items-center rounded bg-zinc-800 px-2 py-1.5">
      <i class="pi pi-search text-xs text-zinc-500" />
      <input
        v-model="model"
        type="text"
        :placeholder="props.placeholder"
        class="ml-2 w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-500"
      />
    </div>
    <button
      v-if="props.showAction"
      v-tooltip.top="{ value: props.actionTooltip, showDelay: 50 }"
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
      @click="emit('action')"
    >
      <i :class="[props.actionIcon, 'text-xs']" />
    </button>
  </div>
</template>
