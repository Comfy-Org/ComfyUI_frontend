<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface Props {
  title: string
  subtitle?: string
  actionLabel?: string
  actionIcon?: string
  showCreateButtons?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  actionIcon: 'pi pi-plus',
  showCreateButtons: true
})

const emit = defineEmits<{
  action: []
}>()

const route = useRoute()
const workspaceId = computed(() => route.params.workspaceId as string || 'default')
</script>

<template>
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {{ props.title }}
      </h1>
      <p v-if="props.subtitle" class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {{ props.subtitle }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <!-- Create Buttons -->
      <template v-if="props.showCreateButtons">
        <RouterLink
          :to="`/${workspaceId}/create`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-bolt text-xs" />
          Linear
        </RouterLink>
        <RouterLink
          :to="`/${workspaceId}/canvas`"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <i class="pi pi-share-alt text-xs" />
          Node
        </RouterLink>
      </template>
      <!-- Action Button -->
      <button
        v-if="props.actionLabel"
        class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        @click="emit('action')"
      >
        <i :class="[props.actionIcon, 'text-xs']" />
        {{ props.actionLabel }}
      </button>
    </div>
  </div>
</template>
