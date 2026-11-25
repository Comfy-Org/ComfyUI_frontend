import assert from 'node:assert/strict'
import { NumberFieldRoot } from 'reka-ui'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import Button from '@comfyorg/design-system/button/Button'
import Card from '@comfyorg/design-system/card/Card'
import EditableText from '@comfyorg/design-system/common/EditableText'
import type { OverlayIconProps } from '@comfyorg/design-system/common/OverlayIcon'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import type { SelectOption } from '@comfyorg/design-system/lib/select/types'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import SearchableSingleSelect from '@comfyorg/design-system/single-select/SearchableSingleSelect'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

const overlay: OverlayIconProps = { mainIcon: 'main', subIcon: 'sub' }
const option: SelectOption = { name: 'Option', value: 'option' }
const menuItem: MenuItem = { label: 'Packed menu item' }
type Assert<T extends true> = T
export type InvalidPositionRejected = Assert<
  'middle' extends NonNullable<OverlayIconProps['positionX']> ? false : true
>
export const contracts = { overlay, option, menuItem, TooltipTrigger }

const app = createSSRApp({
  render: () =>
    h(Card, { surface: 'secondary' }, () => [
      h(EditableText, { modelValue: 'Packed consumer', isEditing: false }),
      h(NumberFieldRoot, { modelValue: 7 }, () => h(NumberFieldInput)),
      h(Button, { variant: 'secondary' }, () => 'Packed button'),
      h(SearchableSingleSelect, {
        accessibleLabel: 'Packed select',
        label: 'Choose',
        modelValue: undefined,
        options: [option],
        searchLabel: 'Search',
        emptyText: 'None'
      })
    ])
})

const html = await renderToString(app)
assert.match(html, /Packed consumer/)
assert.match(html, /value="7"/)
assert.match(html, /bg-secondary/)
assert.match(
  html,
  /<button data-variant="secondary"[^>]*>(<!--[^>]*-->)*Packed button/
)
assert.match(html, /aria-label="Packed select"/)
await Promise.all(
  ['common/textTickerUtils', 'lib/tab/tabKeys'].map((entry) =>
    assert.rejects(import(`@comfyorg/design-system/${entry}`), {
      code: 'ERR_MODULE_NOT_FOUND'
    })
  )
)
process.stdout.write('Packed components render with host Reka context.\n')
