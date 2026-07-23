<script setup lang="ts">
import Empty from '@/components/ui/empty/Empty.vue'
import EmptyHeader from '@/components/ui/empty/EmptyHeader.vue'
import EmptyMedia from '@/components/ui/empty/EmptyMedia.vue'
import EmptyTitle from '@/components/ui/empty/EmptyTitle.vue'

import AgentPromptSuggestions from './AgentPromptSuggestions.vue'

const { name } = defineProps<{
  name?: string
}>()

const emit = defineEmits<{
  select: [suggestion: string]
}>()
</script>

<template>
  <Empty class="gap-8 pt-12">
    <EmptyHeader>
      <EmptyMedia>
        <div class="rounded-xl border border-plum-600">
          <img
            src="/assets/images/comfy-logo-single.svg"
            alt=""
            class="block size-12"
            aria-hidden="true"
          />
        </div>
      </EmptyMedia>
      <EmptyTitle
        class="text-base/snug font-semibold text-base-foreground @min-[570px]:text-2xl/snug"
      >
        <span class="block">
          {{
            name ? $t('agent.greetingNamed', { name }) : $t('agent.greeting')
          }}
        </span>
        <span class="block">{{ $t('agent.greetingQuestion') }}</span>
      </EmptyTitle>
    </EmptyHeader>
    <AgentPromptSuggestions @select="emit('select', $event)" />
  </Empty>
</template>
