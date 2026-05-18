<template>
  <div class="flex flex-col gap-2">
    <div v-if="showDivider" class="flex items-center justify-center py-0.5">
      <span class="text-xs font-bold text-muted-foreground">
        {{ t('rightSidePanel.missingMedia.or') }}
      </span>
    </div>

    <Select
      :model-value="modelValue"
      :disabled="options.length === 0"
      @update:model-value="handleSelect"
    >
      <SelectTrigger
        size="md"
        class="border-transparent bg-secondary-background text-xs hover:border-interface-stroke"
      >
        <SelectValue
          :placeholder="t('rightSidePanel.missingMedia.useFromLibrary')"
        />
      </SelectTrigger>

      <SelectContent class="max-h-72">
        <template v-if="options.length > SEARCH_THRESHOLD" #prepend>
          <div class="px-1 pb-1.5">
            <div
              class="flex items-center gap-1.5 rounded-md border border-border-default px-2"
            >
              <i
                aria-hidden="true"
                class="icon-[lucide--search] size-3.5 shrink-0 text-muted-foreground"
              />
              <input
                v-model="filterQuery"
                type="text"
                :aria-label="t('g.searchPlaceholder', { subject: '' })"
                class="h-7 w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                :placeholder="t('g.searchPlaceholder', { subject: '' })"
                @keydown.stop
              />
            </div>
          </div>
        </template>

        <SelectItem
          v-for="option in filteredOptions"
          :key="option.value"
          :value="option.value"
          class="text-xs"
        >
          <div class="flex items-center gap-2">
            <img
              v-if="mediaType === 'image'"
              :src="getPreviewUrl(option.value)"
              alt=""
              class="size-8 shrink-0 rounded-sm object-cover"
              loading="lazy"
            />
            <video
              v-else-if="mediaType === 'video'"
              aria-hidden="true"
              :src="getPreviewUrl(option.value)"
              class="size-8 shrink-0 rounded-sm object-cover"
              preload="metadata"
              muted
            />
            <i
              v-else
              aria-hidden="true"
              class="icon-[lucide--music] size-5 shrink-0 text-muted-foreground"
            />
            <span class="min-w-0 truncate">{{ option.name }}</span>
          </div>
        </SelectItem>
        <div
          v-if="filteredOptions.length === 0"
          role="status"
          class="px-3 py-2 text-xs text-muted-foreground"
        >
          {{ t('g.noResultsFound') }}
        </div>
      </SelectContent>
    </Select>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFuse } from '@vueuse/integrations/useFuse'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import type { MediaType } from '@/platform/missingMedia/types'
import { api } from '@/scripts/api'

const {
  options,
  showDivider = false,
  mediaType
} = defineProps<{
  modelValue: string | undefined
  options: { name: string; value: string }[]
  showDivider?: boolean
  mediaType: MediaType
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const { t } = useI18n()

const SEARCH_THRESHOLD = 4
const filterQuery = ref('')

watch(
  () => options.length,
  (len) => {
    if (len <= SEARCH_THRESHOLD) filterQuery.value = ''
  }
)

const { results: fuseResults } = useFuse(filterQuery, () => options, {
  fuseOptions: {
    keys: ['name'],
    threshold: 0.4,
    ignoreLocation: true
  },
  matchAllWhenSearchEmpty: true
})

const filteredOptions = computed(() => fuseResults.value.map((r) => r.item))

function getPreviewUrl(filename: string): string {
  return api.apiURL(`/view?filename=${encodeURIComponent(filename)}&type=input`)
}

function handleSelect(value: unknown) {
  if (typeof value === 'string') {
    filterQuery.value = ''
    emit('select', value)
  }
}
</script>
