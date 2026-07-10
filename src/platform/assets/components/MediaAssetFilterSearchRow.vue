<template>
  <div class="flex h-10 items-center gap-2 px-3">
    <i
      class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
    <input
      ref="inputRef"
      v-model="model"
      type="text"
      :placeholder="placeholder"
      class="min-w-0 flex-1 border-none bg-transparent text-sm text-base-foreground outline-none placeholder:text-muted-foreground"
      @keydown="onSearchKeydown"
    />
  </div>
  <DropdownMenuSeparator class="h-px bg-border-subtle" />
</template>

<script setup lang="ts">
import { DropdownMenuSeparator } from 'reka-ui'
import { ref } from 'vue'

const { placeholder } = defineProps<{ placeholder: string }>()
const model = defineModel<string>({ required: true })
const inputRef = ref<HTMLInputElement>()

function menuItems(fromEl: HTMLElement): HTMLElement[] {
  const menu = fromEl.closest('[role="menu"]')
  return menu
    ? Array.from(
        menu.querySelectorAll<HTMLElement>(
          '[role^="menuitem"]:not([aria-disabled="true"])'
        )
      )
    : []
}

// This box owns its keys: Down/Up hand focus into the results (reka drives nav
// from there), and printable keys stay in the box so reka's menu typeahead can't
// steal focus. Stopping propagation keeps global canvas keybindings out.
// Escape / Enter still reach the menu.
function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const items = menuItems(event.currentTarget as HTMLElement)
    if (!items.length) return
    event.preventDefault()
    event.stopPropagation()
    const target =
      event.key === 'ArrowDown' ? items[0] : items[items.length - 1]
    target.focus()
    return
  }
  if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    event.stopPropagation()
  }
}

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
