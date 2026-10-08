<template>
  <Button
    variant="secondary"
    :disabled="
      busy ||
      blocked ||
      (!revision.pinned &&
        (revision.node_api_version !== 2 ||
          (!revision.upstream_commit && !revision.account_owned)))
    "
    :loading="savingRevision === revision.revision_id"
    :aria-label="
      $t(
        revision.pinned
          ? 'customNodePacks.registry.unpinNamed'
          : 'customNodePacks.registry.pinNamed',
        { name: revision.name }
      )
    "
    @click.stop="$emit('pin', revision.revision_id, !revision.pinned)"
  >
    {{
      $t(
        revision.pinned
          ? 'customNodePacks.registry.unpin'
          : 'customNodePacks.registry.pin'
      )
    }}
  </Button>
</template>

<script setup lang="ts">
import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'

import Button from '@/components/ui/button/Button.vue'

defineProps<{
  revision: CloudNodeRegistryRevision
  busy: boolean
  blocked: boolean
  savingRevision?: string
}>()
defineEmits<{ pin: [revisionId: string, pinned: boolean] }>()
</script>
