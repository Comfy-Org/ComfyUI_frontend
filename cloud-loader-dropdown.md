Fixes loader dropdown placeholder
===============================

Cloud loader dropdowns hydrate via `useAssetWidgetData(nodeType)`, so `dropdownItems` stays empty until the Asset API returns friendly filenames. Meanwhile `modelValue` already holds the saved asset and the watcher at [WidgetSelectDropdown.vue#L215-L227](https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/renderer/extensions/vueNodes/widgets/components/WidgetSelectDropdown.vue#L215-L227) only tracks `modelValue`. It runs before assets load, fails to find a match, clears `selectedSet`, and the placeholder persists.

```ts
watch(
  modelValue,
  (currentValue) => {
    if (currentValue === undefined) {
      selectedSet.value.clear()
      return
    }
    const item = dropdownItems.value.find((item) => item.name === currentValue)
    if (item) {
      selectedSet.value.clear()
      selectedSet.value.add(item.id)
    }
  },
  { immediate: true }
)
```

Once the API resolves, `dropdownItems` recomputes but nothing resyncs because the watcher never sees that change. Desktop doesn’t hit this because it still reads from `widget.options.values` immediately.
