# TagsInput

**Path:** `src/components/ui/tags-input/{TagsInput,TagsInputItem,TagsInputItemText,TagsInputItemDelete,TagsInputInput}.vue`
**Built on:** Reka UI `TagsInputRoot` family

## Purpose

Editable array-of-strings tag/chip input with a click-to-edit interaction model: shows a compact read-only chip list until clicked, then reveals the text input for adding/removing tags, and reverts to read-only on click-outside.

## Props (`TagsInput.vue`, generic `T extends AcceptableInputValue = string`)

All `TagsInputRootProps<T>` (`modelValue`, `max`, `duplicate`, `delimiter`, `addOnPaste`, `addOnTab`, `convertValue`, `displayValue`, ...) forward from Reka UI, plus:

| Prop            | Type                      | Default | Notes                                                       |
| --------------- | ------------------------- | ------- | ----------------------------------------------------------- |
| `disabled`      | `boolean`                 | `false` |                                                             |
| `alwaysEditing` | `boolean`                 | `false` | skips the click-to-edit gating — stays permanently editable |
| `class`         | `HTMLAttributes['class']` | —       |                                                             |

## Slots

Default scoped slot: `{ isEmpty: boolean }`.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TagsInput from '@/components/ui/tags-input/TagsInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'

const tags = ref(['Vue', 'TypeScript'])
</script>

<template>
  <TagsInput v-model="tags" class="w-80" v-slot="{ isEmpty }">
    <TagsInputItem v-for="tag in tags" :key="tag" :value="tag">
      <TagsInputItemText />
      <TagsInputItemDelete />
    </TagsInputItem>
    <TagsInputInput :is-empty="isEmpty" placeholder="Add tag..." />
  </TagsInput>
</template>
```

## Do

- Use `alwaysEditing` when the tags input is the sole focus of a form field (e.g. a dedicated "keywords" field) and click-to-edit gating would just add friction.
- Rely on the default click-to-edit UX for compact, inline tag lists inside denser UIs.

## Don't

- Don't confuse this component's own `disabled` with Reka's — internally the underlying root is only "enabled" while actively editing (or `alwaysEditing`), so a plain `disabled` toggle plus expecting live editing without `alwaysEditing` won't work as expected.

## Notes

Escape blurs the input and exits editing mode. The text input only renders while editing or while the tag list is empty (`showInput = isEditing || isEmpty`).
