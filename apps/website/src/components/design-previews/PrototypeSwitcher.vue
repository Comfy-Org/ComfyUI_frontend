<script setup lang="ts" generic="K extends string">
import { ChevronDown, ChevronUp, SlidersHorizontal } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

export interface PrototypeField<Key extends string> {
  readonly key: Key
  readonly label: string
  readonly options: readonly {
    readonly value: string
    readonly label: string
  }[]
}

// Prototype chrome, after the Team Billing mock switcher (itself after Nuxt
// DevTools): a frosted pill that stays out of the page's way until opened.
const { fields } = defineProps<{ fields: readonly PrototypeField<K>[] }>()
const state = defineModel<Record<K, string>>({ required: true })
const collapsed = ref(true)

const summary = computed(() =>
  fields
    .map(
      (field) =>
        field.options.find((option) => option.value === state.value[field.key])
          ?.label
    )
    .filter(Boolean)
    .join(' · ')
)

function pick(key: K, value: string) {
  state.value = { ...state.value, [key]: value }
}
</script>

<template>
  <aside
    :class="
      cn(
        'fixed right-4 bottom-4 z-50 flex flex-col border border-transparency-white-t20 bg-black/80 text-sm text-primary-warm-white shadow-[0_4px_16px_rgb(0_0_0/0.35)] backdrop-blur-md',
        collapsed ? 'max-w-[calc(100vw-2rem)] rounded-full' : 'w-70 rounded-lg'
      )
    "
    data-testid="prototype-switcher"
  >
    <button
      type="button"
      class="flex h-8 cursor-pointer items-center gap-2 rounded-[inherit] px-3 text-xs whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-warm-gray [&:hover>.muted]:text-primary-warm-white"
      :aria-expanded="!collapsed"
      @click="collapsed = !collapsed"
    >
      <SlidersHorizontal class="size-3" aria-hidden="true" />
      <span class="font-medium">Prototype</span>
      <span class="h-3.5 w-px bg-transparency-white-t20" aria-hidden="true" />
      <span class="muted min-w-0 truncate text-primary-warm-gray">{{
        summary
      }}</span>
      <component
        :is="collapsed ? ChevronUp : ChevronDown"
        class="muted ml-auto size-2.5 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
    <div
      v-if="!collapsed"
      class="flex flex-col gap-3 border-t border-transparency-white-t8 p-3"
    >
      <label
        v-for="field in fields"
        :key="field.key"
        class="flex flex-col gap-1 text-xs text-primary-warm-gray"
      >
        <span>{{ field.label }}</span>
        <select
          :value="state[field.key]"
          class="h-8 cursor-pointer rounded-md border border-transparency-white-t20 bg-primary-comfy-ink px-2 text-xs text-primary-warm-white focus-visible:outline-2 focus-visible:outline-primary-warm-gray"
          @change="pick(field.key, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="option in field.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
  </aside>
</template>
