<template>
  <div>
    <h3 class="m-0 text-xs font-medium text-muted-foreground">
      {{ folder }}
    </h3>
    <ul class="m-0 list-none p-0">
      <li v-for="name in names" :key="name" class="flex items-center gap-1">
        <Button
          variant="textonly"
          size="sm"
          class="min-w-0 flex-1 justify-start font-normal"
          :title="name"
          @click="emit('place', name)"
        >
          <span class="min-w-0 truncate">{{ name }}</span>
        </Button>
        <i
          role="img"
          :aria-label="$t('sideToolbar.workspaceLibrary.fromWorkspace')"
          :title="$t('sideToolbar.workspaceLibrary.fromWorkspace')"
          class="icon-[lucide--cloud] size-3.5 text-muted-foreground"
        />
      </li>
      <li v-for="name in blocked" :key="name" class="flex items-center gap-1">
        <span
          class="flex h-6 min-w-0 flex-1 items-center px-2 text-xs text-muted-foreground"
          :title="name"
        >
          <span class="min-w-0 truncate">{{ name }}</span>
        </span>
        <i
          role="img"
          :aria-label="$t('sideToolbar.workspaceLibrary.blockedByModelRules')"
          :title="$t('sideToolbar.workspaceLibrary.blockedByModelRules')"
          class="icon-[lucide--ban] size-3.5 text-muted-foreground"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

defineProps<{
  folder: string
  names: readonly string[]
  blocked: readonly string[]
}>()

const emit = defineEmits<{
  place: [name: string]
}>()
</script>
