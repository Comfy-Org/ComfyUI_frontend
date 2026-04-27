<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4">
    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.workflowName') }}
      </span>
      <Input
        :model-value="name"
        :placeholder="$t('comfyHubPublish.workflowNamePlaceholder')"
        @update:model-value="$emit('update:name', String($event))"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.workflowDescription') }}
      </span>
      <Textarea
        :model-value="description"
        :placeholder="$t('comfyHubPublish.workflowDescriptionPlaceholder')"
        rows="5"
        @update:model-value="$emit('update:description', String($event))"
      />
    </label>

    <label class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.tagsDescription') }}
      </span>
      <TagsInput
        v-slot="{ isEmpty }"
        always-editing
        class="bg-secondary-background select-none"
        :model-value="tags"
        @update:model-value="$emit('update:tags', $event as string[])"
      >
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput :is-empty />
      </TagsInput>
    </label>
    <TagsInput
      disabled
      class="hover-within:bg-transparent bg-transparent p-0 hover:bg-transparent"
    >
      <div
        v-if="displayedSuggestions.length > 0"
        class="flex basis-full flex-wrap gap-2"
      >
        <TagsInputItem
          v-for="tag in displayedSuggestions"
          :key="tag"
          v-auto-animate
          :value="tag"
          class="cursor-pointer bg-secondary-background px-2 text-muted-foreground transition-colors select-none hover:bg-secondary-background-selected"
          @click="addTag(tag)"
        >
          <TagsInputItemText />
        </TagsInputItem>
      </div>
      <Button
        v-if="shouldShowSuggestionToggle"
        variant="muted-textonly"
        size="unset"
        class="hover:bg-unset px-0 text-xs"
        @click="showAllSuggestions = !showAllSuggestions"
      >
        {{
          $t(
            showAllSuggestions
              ? 'comfyHubPublish.showLessTags'
              : 'comfyHubPublish.showMoreTags'
          )
        }}
      </Button>
    </TagsInput>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'
import { useComfyHubService } from '@/platform/workflow/sharing/services/comfyHubService'
import { computed, onMounted, ref } from 'vue'
import { vAutoAnimate } from '@formkit/auto-animate/vue'

const { tags } = defineProps<{
  name: string
  description: string
  tags: string[]
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:tags': [value: string[]]
}>()

const INITIAL_TAG_SUGGESTION_COUNT = 10

const showAllSuggestions = ref(false)
const tagOptions = ref<string[]>(COMFY_HUB_TAG_OPTIONS)

const { fetchTagLabels } = useComfyHubService()

onMounted(async () => {
  try {
    tagOptions.value = await fetchTagLabels()
  } catch {
    // Fall back to hardcoded tags
  }
})

const availableSuggestions = computed(() =>
  tagOptions.value.filter((tag) => !tags.includes(tag))
)

const displayedSuggestions = computed(() =>
  showAllSuggestions.value
    ? availableSuggestions.value
    : availableSuggestions.value.slice(0, INITIAL_TAG_SUGGESTION_COUNT)
)

const hasHiddenSuggestions = computed(
  () =>
    !showAllSuggestions.value &&
    availableSuggestions.value.length > INITIAL_TAG_SUGGESTION_COUNT
)

const shouldShowSuggestionToggle = computed(
  () => showAllSuggestions.value || hasHiddenSuggestions.value
)

function addTag(tag: string) {
  emit('update:tags', [...tags, tag])
}
</script>
