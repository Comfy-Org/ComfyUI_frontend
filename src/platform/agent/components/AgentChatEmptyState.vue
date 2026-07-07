<script setup lang="ts">
import { computed } from 'vue'
import { motion } from 'motion-v'

import Empty from '@/components/ui/empty/Empty.vue'
import EmptyHeader from '@/components/ui/empty/EmptyHeader.vue'
import EmptyMedia from '@/components/ui/empty/EmptyMedia.vue'
import EmptyTitle from '@/components/ui/empty/EmptyTitle.vue'
import { useAgentPersonality } from '@/platform/agent/composables/agentPersonalityState'
import { useAgentHoverMotion } from '@/platform/agent/composables/useAgentHoverMotion'
import { useSettingStore } from '@/platform/settings/settingStore'

const { name } = defineProps<{
  name?: string
}>()

const agentPersonality = useAgentPersonality()
const reducedMotion = computed(
  () => !!useSettingStore().get('Comfy.Appearance.DisableAnimations')
)
const { transition, whileHover, animate } = useAgentHoverMotion(
  agentPersonality.hover,
  agentPersonality.idle,
  reducedMotion
)
</script>

<template>
  <Empty class="pt-12">
    <EmptyHeader>
      <EmptyMedia>
        <motion.div
          class="relative flex size-12 items-center justify-center overflow-hidden rounded-xl border border-plum-600 bg-ink-700"
          :while-hover="whileHover"
          :animate="animate"
          :transition="transition"
        >
          <i
            class="relative z-10 icon-[comfy--comfy-c] size-6 text-brand-yellow"
            aria-hidden="true"
          />
        </motion.div>
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
  </Empty>
</template>
