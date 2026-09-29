import { $el } from '../ui'

interface ToggleSwitchItem {
  text: string
  value?: string
  tooltip?: string
  selected?: boolean
}

type ResolvedToggleSwitchItem = ToggleSwitchItem & { value: string }

interface ToggleSwitchOptions {
  onChange?: (e: {
    item: ResolvedToggleSwitchItem
    prev?: ResolvedToggleSwitchItem
  }) => void
}

/**
 * Creates a toggle switch element
 */
export function toggleSwitch(
  name: string,
  items: (string | ToggleSwitchItem)[],
  e?: ToggleSwitchOptions
) {
  const onChange = e?.onChange
  const switchItems: ResolvedToggleSwitchItem[] = items.map((item) =>
    typeof item === 'string'
      ? { text: item, value: item }
      : { ...item, value: item.value ?? item.text }
  )
  const initialIndex = Math.max(
    switchItems.findLastIndex((item) => item.selected),
    0
  )

  let selectedIndex: number | undefined

  function updateSelected(index: number) {
    if (selectedIndex != null) {
      elements[selectedIndex].classList.remove('comfy-toggle-selected')
    }
    onChange?.({
      item: switchItems[index],
      prev: selectedIndex == null ? undefined : switchItems[selectedIndex]
    })
    selectedIndex = index
    elements[selectedIndex].classList.add('comfy-toggle-selected')
  }

  const elements = switchItems.map((item, i) =>
    $el(
      'label',
      {
        textContent: item.text,
        title: item.tooltip ?? ''
      },
      $el('input', {
        name,
        type: 'radio',
        value: item.value,
        checked: i === initialIndex,
        onchange: () => {
          updateSelected(i)
        }
      })
    )
  )

  const container = $el('div.comfy-toggle-switch', elements)
  updateSelected(initialIndex)

  return container
}
