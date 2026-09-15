<template>
  <Transition name="agent-orb">
    <AgentTooltip
      v-if="showOrb"
      :label="$t('agent.entryButton')"
      side="left"
      :side-offset="10"
    >
      <button
        v-bind="$attrs"
        type="button"
        :aria-label="$t('agent.entryButton')"
        class="group no-drag size-12 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 transition-transform duration-200 ease-out hover:-translate-2"
        @click="onAgentEntryClick"
      >
        <span class="relative block size-full">
          <span
            class="agent-orb-halo pointer-events-none scale-50 opacity-0 transition duration-500 ease-out group-hover:scale-100 group-hover:opacity-100"
          />
          <svg
            class="size-full"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 0.5C36.9787 0.5 47.5 11.0213 47.5 24C47.5 36.9787 36.9787 47.5 24 47.5C11.0213 47.5 0.5 36.9787 0.5 24C0.5 11.0213 11.0213 0.5 24 0.5Z"
              class="stroke-interface-stroke"
              fill="url(#agent-orb-surface)"
            />
            <path
              d="M31.0989 30.5714C31.1445 30.417 31.1693 30.2544 31.1693 30.0833C31.1693 29.1365 30.4072 28.369 29.467 28.369H21.8376C21.4276 28.3732 21.0921 28.0395 21.0921 27.6266C21.0921 27.5515 21.1045 27.4806 21.1211 27.4139L23.1755 20.2063C23.2625 19.8893 23.5524 19.6557 23.892 19.6557L31.5504 19.6474C33.1657 19.6474 34.5284 18.5504 34.9384 17.053L36.0899 13.0363C36.1271 12.8945 36.1479 12.7402 36.1479 12.5858C36.1479 11.6432 35.3899 10.8799 34.4538 10.8799H25.1884C23.5814 10.8799 22.2228 11.9685 21.8045 13.4492L21.0258 16.1896C20.9347 16.5024 20.6489 16.7318 20.3093 16.7318H18.0851C16.4905 16.7318 15.1444 17.7996 14.7136 19.2637L11.9137 29.1115C11.8723 29.2575 11.8516 29.416 11.8516 29.5745C11.8516 30.5213 12.6137 31.2888 13.5539 31.2888H15.7408C16.1508 31.2888 16.4863 31.6225 16.4863 32.0396C16.4863 32.1105 16.478 32.1814 16.4573 32.2481L15.6828 34.9635C15.6455 35.1094 15.6207 35.2596 15.6207 35.4139C15.6207 36.3566 16.3786 37.1199 17.3147 37.1199L26.5842 37.1115C28.1954 37.1115 29.554 36.0187 29.9682 34.5297L31.0948 30.5755L31.0989 30.5714Z"
              class="fill-base-foreground"
            />
            <defs>
              <radialGradient
                id="agent-orb-surface"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(24 13.5) rotate(90) scale(23.5)"
              >
                <stop style="stop-color: var(--agent-orb-highlight)" />
                <stop offset="1" style="stop-color: var(--agent-orb-base)" />
              </radialGradient>
            </defs>
          </svg>
          <span class="agent-orb-sheen pointer-events-none absolute inset-0" />
        </span>
      </button>
    </AgentTooltip>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAgentEntry } from '@/workbench/extensions/agent/composables/agent/useAgentEntry'

import AgentTooltip from './AgentTooltip.vue'

defineOptions({ inheritAttrs: false })

const { showAgentEntry, isPanelVisible, onAgentEntryClick } = useAgentEntry()

const showOrb = computed(() => showAgentEntry.value && !isPanelVisible.value)
</script>
