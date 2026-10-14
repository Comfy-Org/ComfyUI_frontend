<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { UserRound } from '@lucide/vue'
import type { ProfileChoice } from '@/lib/cms/profile-client'
import { searchProfiles, validProfileQuery } from '@/lib/cms/profile-client'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { disabled = false, locale = 'en' } = defineProps<{
  disabled?: boolean
  locale?: Locale
}>()
const value = defineModel<string>({ required: true })
const { t } = translationsFor(locale)
const id = useId()
const query = ref('')
const open = ref(false)
const choices = ref<ProfileChoice[]>([])
const selected = ref<ProfileChoice>()
const active = ref(0)
const loading = ref(false)
const failed = ref(false)
const fieldClass =
  'w-full rounded-lg border border-admin-field bg-admin-page px-3 py-2 text-sm text-admin-fg outline-none focus:border-primary-comfy-yellow disabled:opacity-50'

watch(
  () => value.value,
  async (uid, _, cleanup) => {
    if (selected.value?.id === uid) return
    selected.value = undefined
    if (!validProfileQuery(uid)) return
    const controller = new AbortController()
    cleanup(() => controller.abort())
    const result = await searchProfiles(uid, controller.signal)
    if (!controller.signal.aborted && value.value === uid && result.ok)
      selected.value = result.items.find((item) => item.id === uid)
  },
  { immediate: true }
)

watch([query, () => disabled], ([text, locked], _, cleanup) => {
  choices.value = []
  failed.value = false
  loading.value = false
  if (locked || !validProfileQuery(text.trim())) return
  const controller = new AbortController()
  loading.value = true
  const timer = setTimeout(async () => {
    const result = await searchProfiles(text.trim(), controller.signal)
    if (controller.signal.aborted) return
    loading.value = false
    if (result.ok) choices.value = result.items
    else failed.value = true
    active.value = 0
  }, 250)
  cleanup(() => {
    clearTimeout(timer)
    controller.abort()
  })
})

function choose(item: ProfileChoice) {
  if (disabled) return
  selected.value = item
  value.value = item.id
  query.value = ''
  open.value = false
}
function keyboard(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = choices.value[active.value]
    if (open.value && option) choose(option)
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    open.value = false
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const wasOpen = open.value
    open.value = true
    active.value = Math.max(
      0,
      Math.min(
        choices.value.length - 1,
        wasOpen ? active.value + (event.key === 'ArrowDown' ? 1 : -1) : 0
      )
    )
  }
}
function manual(event: Event) {
  if (!disabled && event.target instanceof HTMLInputElement)
    value.value = event.target.value
}
function blur(event: FocusEvent) {
  if (
    event.currentTarget instanceof HTMLElement &&
    !(
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )
  )
    open.value = false
}
</script>

<template>
  <div class="grid min-w-0 gap-2 text-sm text-admin-muted" @focusout="blur">
    <label :for="id">{{ t('cccReferences.authorSearch') }}</label>
    <div class="relative">
      <input
        :id="id"
        v-model="query"
        type="search"
        role="combobox"
        autocomplete="off"
        :disabled
        :placeholder="t('cccReferences.searchPlaceholder')"
        :aria-expanded="open && choices.length > 0"
        :aria-controls="`${id}-choices`"
        :aria-activedescendant="
          open && choices.length ? `${id}-choice-${active}` : undefined
        "
        aria-autocomplete="list"
        :class="fieldClass"
        @focus="open = true"
        @input="open = true"
        @keydown="keyboard"
      />
      <div
        v-show="open && choices.length"
        class="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-admin-field bg-admin-card p-1 shadow-xl"
      >
        <div
          :id="`${id}-choices`"
          role="listbox"
          :aria-label="t('cccReferences.results')"
        >
          <button
            v-for="(item, index) in choices"
            :id="`${id}-choice-${index}`"
            :key="item.id"
            type="button"
            role="option"
            tabindex="-1"
            :aria-selected="index === active"
            :disabled
            class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-admin-line aria-selected:bg-admin-line"
            @mousedown.prevent
            @click="choose(item)"
          >
            <img
              v-if="item.avatar_url"
              :src="item.avatar_url"
              alt=""
              referrerpolicy="no-referrer"
              class="size-8 shrink-0 rounded-full object-cover"
            />
            <UserRound v-else class="size-8 shrink-0" aria-hidden="true" />
            <span class="min-w-0"
              ><span class="block truncate text-admin-fg">{{ item.label }}</span
              ><span class="block truncate text-xs">{{
                item.username
              }}</span></span
            >
          </button>
        </div>
      </div>
    </div>
    <p v-if="loading" role="status">{{ t('cccReferences.searching') }}</p>
    <p v-else-if="failed" role="status">{{ t('cccReferences.unavailable') }}</p>
    <p
      v-else-if="open && validProfileQuery(query.trim()) && !choices.length"
      role="status"
    >
      {{ t('cccReferences.noMatches') }}
    </p>
    <div
      v-if="selected"
      class="flex min-w-0 items-center gap-2 rounded-lg border border-admin-line p-2"
    >
      <img
        v-if="selected.avatar_url"
        :src="selected.avatar_url"
        alt=""
        referrerpolicy="no-referrer"
        class="size-8 shrink-0 rounded-full object-cover"
      />
      <UserRound v-else class="size-8 shrink-0" aria-hidden="true" />
      <span class="min-w-0"
        ><span class="block text-admin-fg">{{ selected.label }}</span
        ><span class="block truncate text-xs">{{
          selected.username
        }}</span></span
      >
    </div>
    <p v-if="value && !selected" class="truncate text-xs">
      {{ t('cccReferences.currentAccount', { id: value }) }}
    </p>
    <details class="min-w-0 text-xs">
      <summary class="cursor-pointer">{{ t('cccReferences.manual') }}</summary>
      <label class="mt-2 grid gap-1"
        >{{ t('cccMetadata.author') }}
        <input :value :disabled :class="fieldClass" @input="manual" />
      </label>
    </details>
  </div>
</template>
