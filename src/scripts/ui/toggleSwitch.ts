import { $el } from '../ui'

export interface ToggleSwitchItem {
  text: string
  value?: string
  tooltip?: string
  selected?: boolean
}

/**
 * Creates a toggle switch element
 */
export function toggleSwitch(
  name: string,
  items: (string | ToggleSwitchItem)[],
  e?: {
    onChange?: (e: { item: ToggleSwitchItem; prev?: ToggleSwitchItem }) => void
  }
) {
  const onChange = e?.onChange

  const normalizedItems: ToggleSwitchItem[] = items.map((item) => {
    if (typeof item === 'string') {
      return { text: item, value: item }
    }
    return { ...item, value: item.value ?? item.text }
  })

  let selectedIndex: number | null = null
  let elements: HTMLLabelElement[]

  function updateSelected(index: number) {
    if (selectedIndex != null) {
      elements[selectedIndex].classList.remove('comfy-toggle-selected')
    }
    onChange?.({
      item: normalizedItems[index],
      prev: selectedIndex == null ? undefined : normalizedItems[selectedIndex]
    })
    selectedIndex = index
    elements[selectedIndex].classList.add('comfy-toggle-selected')
  }

  elements = normalizedItems.map((item, i) => {
    const toggle = $el(
      'label',
      {
        textContent: item.text,
        title: item.tooltip ?? ''
      },
      $el('input', {
        name,
        type: 'radio',
        value: item.value ?? item.text,
        checked: item.selected,
        onchange: () => {
          updateSelected(i)
        }
      })
    )
    if (item.selected) {
      updateSelected(i)
    }
    return toggle
  })

  const container = $el('div.comfy-toggle-switch', elements)

  if (selectedIndex == null) {
    const firstInput = elements[0].children[0]
    if (firstInput instanceof HTMLInputElement) {
      firstInput.checked = true
    }
    updateSelected(0)
  }

  return container
}
