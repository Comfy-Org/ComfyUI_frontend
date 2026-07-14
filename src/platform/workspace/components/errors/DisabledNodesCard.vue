<template>
  <ul class="m-0 list-none space-y-1 p-0 px-3">
    <li
      v-for="offender in offenders"
      :key="offender.nodeId"
      class="flex min-w-0 items-center gap-2"
    >
      <Button
        variant="textonly"
        class="max-w-full min-w-0 flex-1 justify-start truncate text-left text-xs/relaxed font-normal text-muted-foreground hover:text-base-foreground"
        @click="emit('locateNode', offender.nodeId)"
      >
        {{ offender.displayName }}
      </Button>
      <Button
        variant="textonly"
        size="icon-sm"
        class="size-8 shrink-0 text-muted-foreground hover:text-base-foreground focus-visible:ring-inset"
        :aria-label="
          $t('rightSidePanel.locateNodeFor', { item: offender.displayName })
        "
        @click.stop="emit('locateNode', offender.nodeId)"
      >
        <i class="icon-[lucide--locate] size-4" />
      </Button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { DisabledGraphNode } from '@/platform/workspace/stores/disabledPartnerNodesStore'

const { offenders } = defineProps<{ offenders: DisabledGraphNode[] }>()

const emit = defineEmits<{
  locateNode: [nodeId: DisabledGraphNode['nodeId']]
}>()
</script>
