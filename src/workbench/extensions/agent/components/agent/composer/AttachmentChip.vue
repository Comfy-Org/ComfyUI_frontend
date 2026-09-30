<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Tag from '@/components/chip/Tag.vue'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { agentAttachCapability } from '../../../utils/attachableFiles'
import type { AgentAttachCapability } from '../../../utils/attachableFiles'

const {
  name,
  refName,
  previewUrl,
  uploading = false,
  capability
} = defineProps<{
  name: string
  refName?: string
  previewUrl?: string
  uploading?: boolean
  capability?: AgentAttachCapability | 'unknown'
}>()
const emit = defineEmits<{ remove: [] }>()

const { t } = useI18n()

const kind = computed(() => getMediaTypeFromFilename(name))

/* The shared map's 'other' glyph is a checkmark, which reads as a status
   rather than a file on this surface. */
const kindIconClass = computed(() =>
  kind.value === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind.value)
)

/* What the agent can do with this file differs sharply by type and is otherwise
   invisible: it reads an image's pixels, a clip's duration only, and nothing at
   all inside a mesh or a text file. Without this the chip looks identical either
   way and the user assumes it was read. */
/* Keyed by a Record rather than a switch so adding a tier to the server contract
   fails TYPECHECK here until its copy exists, instead of falling through to the
   unknown string and quietly under-describing the file. */
const CAPABILITY_MESSAGE: Record<AgentAttachCapability | 'unknown', string> = {
  view: 'agent.attachmentCapabilityView',
  probe: 'agent.attachmentCapabilityProbe',
  read: 'agent.attachmentCapabilityRead',
  reference: 'agent.attachmentCapabilityReference',
  retain: 'agent.attachmentCapabilityRetain',
  unknown: 'agent.attachmentCapabilityUnknown'
}

const capabilityLabel = computed(() =>
  // Admission's recorded capability first: it judged the real local filename.
  // The stored ref beats the display label after that, since a card's label
  // need not carry a judgeable extension at all.
  t(
    CAPABILITY_MESSAGE[
      capability ??
        agentAttachCapability(refName ?? '') ??
        agentAttachCapability(name) ??
        'unknown'
    ]
  )
)
</script>

<template>
  <!-- `data-attachment-name` anchors black-box coverage of what a drop actually
       attached: the visible label truncates, so asserting on rendered text alone
       cannot tell one long filename from another. -->
  <Tag
    data-testid="agent-attachment-chip"
    :data-attachment-name="name"
    :label="name"
    :title="capabilityLabel"
    :aria-description="capabilityLabel"
    removable
    :remove-label="$t('agent.remove')"
    class="max-w-48"
    @remove="emit('remove')"
  >
    <template #icon>
      <span
        v-if="uploading"
        role="status"
        :aria-label="$t('agent.uploading')"
        class="icon-[lucide--loader-circle] size-3.5 animate-spin text-muted-foreground"
      />
      <!-- Only an image kind renders its preview: a server thumbnail for an
           audio or 3D asset would repaint the broken-image chip this fixed. -->
      <img
        v-else-if="previewUrl && kind === 'image'"
        :src="previewUrl"
        :alt="name"
        class="size-3.5 shrink-0 rounded-sm object-cover"
      />
      <span v-else :class="cn(kindIconClass, 'size-3.5 shrink-0')" />
    </template>
  </Tag>
</template>
