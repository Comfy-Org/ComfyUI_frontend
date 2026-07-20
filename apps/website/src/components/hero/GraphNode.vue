<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { ChevronDown } from '@lucide/vue'

import type { PortRow } from './graphChrome'
import { PORT_COLORS } from './graphChrome'

const {
  title,
  ports = [],
  tinted = false,
  badge,
  grip = false
} = defineProps<{
  title: string
  ports?: PortRow[]
  tinted?: boolean
  badge?: string
  grip?: boolean
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })
</script>

<template>
  <article
    :class="
      cn(
        'rounded-[0.625em] border border-white/10 font-inter',
        tinted ? 'bg-illustration-forest' : 'bg-primary-comfy-ink-light'
      )
    "
  >
    <header
      :class="
        cn(
          'flex h-[2.25em] items-center gap-[0.5em] rounded-t-[0.625em] bg-black/20 px-[0.75em]',
          collapsed && 'rounded-b-[0.625em]'
        )
      "
    >
      <button
        type="button"
        class="cursor-pointer text-white/50 hover:text-white/90"
        :aria-label="collapsed ? `Expand ${title}` : `Collapse ${title}`"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        <ChevronDown
          :class="cn('size-[0.875em]', collapsed && '-rotate-90')"
          aria-hidden="true"
        />
      </button>
      <span class="truncate text-[0.8125em] font-medium text-white/90">
        {{ title }}
      </span>
    </header>

    <template v-if="!collapsed">
      <div v-if="ports.length">
        <div
          v-for="(row, i) in ports"
          :key="i"
          class="relative flex h-[1.5em] items-center justify-between px-[0.75em]"
        >
          <span
            v-if="row.input"
            :class="
              cn(
                'flex items-center text-[0.75em] text-white/70',
                row.input.muted && 'pl-[0.5em] text-[0.6875em] text-white/50'
              )
            "
          >
            <span
              :class="
                cn(
                  'absolute left-0 -translate-x-1/2 rounded-full',
                  row.input.muted ? 'size-[0.7em]' : 'size-[0.6em] border-2'
                )
              "
              :style="{
                borderColor: PORT_COLORS[row.input.type],
                backgroundColor:
                  row.input.connected || row.input.muted
                    ? PORT_COLORS[row.input.type]
                    : 'transparent'
              }"
            />
            {{ row.input.label }}
          </span>
          <span v-else />
          <span
            v-if="row.output"
            class="flex items-center text-[0.75em] text-white/70"
          >
            {{ row.output.label }}
            <span
              class="absolute right-0 size-[0.6em] translate-x-1/2 rounded-full"
              :style="{ backgroundColor: PORT_COLORS[row.output.type] }"
            />
          </span>
        </div>
      </div>

      <div
        class="flex flex-col gap-[0.375em] px-[0.625em] pt-[0.375em] pb-[0.625em]"
      >
        <slot />
      </div>

      <div
        v-if="$slots.footer"
        class="rounded-b-[0.625em] border-t border-white/10"
      >
        <slot name="footer" />
      </div>

      <svg
        v-if="grip"
        class="absolute right-[0.3em] bottom-[0.3em] size-[0.7em] text-white/20"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path d="M9 1 1 9M9 5 5 9" stroke-linecap="round" />
      </svg>
    </template>

    <span
      v-if="badge"
      class="absolute top-full left-[0.75em] mt-[0.375em] rounded-[0.3em] bg-white/10 px-[0.5em] py-[0.1em] text-[0.65em] text-white/45"
    >
      {{ badge }}
    </span>
  </article>
</template>
