<template>
  <div class="flex min-h-0 flex-1 flex-col gap-6 px-6 py-4">
    <p class="text-sm text-muted-foreground">
      {{ $t('comfyHubPublish.finishPlaceholder') }}
    </p>

    <!-- Tags -->
    <div class="flex flex-col gap-2">
      <span class="text-sm text-muted-foreground">
        {{ $t('comfyHubPublish.tags') }}
      </span>
      <TagsInput
        v-slot="{ isEmpty }"
        class="bg-modal-card-background-hovered"
        :model-value="tags"
        @update:model-value="$emit('update:tags', $event as string[])"
      >
        <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput
          :is-empty="isEmpty"
          :placeholder="$t('comfyHubPublish.tagsPlaceholder')"
        />
      </TagsInput>
      <div v-if="availableSuggestions.length > 0" class="flex flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('comfyHubPublish.suggestedTags') }}
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="tag in availableSuggestions"
            :key="tag"
            class="cursor-pointer rounded-full border border-border-default bg-transparent px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted-background hover:text-base-foreground"
            @click="addTag(tag)"
          >
            + {{ tag }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'
import { computed } from 'vue'

const { tags } = defineProps<{
  tags: string[]
}>()

const emit = defineEmits<{
  'update:tags': [value: string[]]
}>()

const availableSuggestions = computed(() =>
  COMFY_HUB_TAG_OPTIONS.filter((tag) => !tags.includes(tag))
)

function addTag(tag: string) {
  emit('update:tags', [...tags, tag])
}
</script>
