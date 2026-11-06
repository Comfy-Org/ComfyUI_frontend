<template>
  <BuildDialogStep
    :title="
      $t('buildCustomNodes.readOnly.title', { build: session.build.build.name })
    "
    :description="$t('buildCustomNodes.readOnly.body')"
  >
    <NodePackList
      :label="
        $t('buildCustomNodes.readOnly.listLabel', {
          build: session.build.build.name
        })
      "
      :items="session.build.build.custom_nodes.map(buildEntryItem)"
    />
    <template #actions>
      <CustomNodesDocsLink class="mr-auto" />
      <Button variant="secondary" size="lg" @click="emit('close')">
        {{ $t('g.close') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import CustomNodesDocsLink from '@/platform/workspace/buildCustomNodes/components/CustomNodesDocsLink.vue'
import NodePackList from '@/platform/workspace/buildCustomNodes/components/NodePackList.vue'
import { useNodePackListItems } from '@/platform/workspace/buildCustomNodes/useNodePackListItems'

const { session } = defineProps<{
  session: BuildSession
}>()

const emit = defineEmits<{
  close: []
}>()

const { buildEntryItem } = useNodePackListItems()
</script>
