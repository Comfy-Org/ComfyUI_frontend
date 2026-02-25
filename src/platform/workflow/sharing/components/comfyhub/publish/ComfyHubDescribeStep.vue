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

    <div class="flex flex-col gap-2">
      <span class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.workflowType') }}
      </span>
      <Select
        :model-value="workflowType"
        @update:model-value="$emit('update:workflowType', String($event))"
      >
        <SelectTrigger>
          <SelectValue
            :placeholder="$t('comfyHubPublish.workflowTypePlaceholder')"
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in workflowTypeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex flex-col gap-4 py-4">
      <p class="text-sm text-base-foreground">
        {{ $t('comfyHubPublish.tagsDescription') }}
      </p>
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
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tag in availableSuggestions"
          :key="tag"
          class="cursor-pointer rounded-sm bg-secondary-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-base-foreground"
          @click="addTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import SelectContent from '@/components/ui/select/SelectContent.vue'
import SelectItem from '@/components/ui/select/SelectItem.vue'
import SelectTrigger from '@/components/ui/select/SelectTrigger.vue'
import SelectValue from '@/components/ui/select/SelectValue.vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { tags, workflowType } = defineProps<{
  name: string
  description: string
  workflowType: string
  tags: string[]
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:description': [value: string]
  'update:workflowType': [value: string]
  'update:tags': [value: string[]]
}>()

const { t } = useI18n()

const workflowTypeOptions = [
  {
    value: 'imageGeneration',
    label: t('comfyHubPublish.workflowTypeImageGeneration')
  },
  {
    value: 'videoGeneration',
    label: t('comfyHubPublish.workflowTypeVideoGeneration')
  },
  {
    value: 'upscaling',
    label: t('comfyHubPublish.workflowTypeUpscaling')
  },
  {
    value: 'editing',
    label: t('comfyHubPublish.workflowTypeEditing')
  }
]

const availableSuggestions = computed(() =>
  COMFY_HUB_TAG_OPTIONS.filter((tag) => !tags.includes(tag)).slice(0, 10)
)

function addTag(tag: string) {
  emit('update:tags', [...tags, tag])
}
</script>
