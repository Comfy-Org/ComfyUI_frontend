import assert from 'node:assert/strict'
import { NumberFieldRoot } from 'reka-ui'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import Card from '@comfyorg/design-system/card/Card'
import EditableText from '@comfyorg/design-system/common/EditableText'
import type { OverlayIconProps } from '@comfyorg/design-system/common/OverlayIcon'
import type { SelectOption } from '@comfyorg/design-system/lib/select/types'
import NumberFieldInput from '@comfyorg/design-system/number-field/NumberFieldInput'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

const overlay: OverlayIconProps = { mainIcon: 'main', subIcon: 'sub' }
const option: SelectOption = { name: 'Option', value: 'option' }
type Assert<T extends true> = T
export type InvalidPositionRejected = Assert<
  'middle' extends NonNullable<OverlayIconProps['positionX']> ? false : true
>
export const contracts = { overlay, option, TooltipTrigger }

const app = createSSRApp({
  render: () =>
    h(Card, { surface: 'secondary' }, () => [
      h(EditableText, { modelValue: 'Packed consumer', isEditing: false }),
      h(NumberFieldRoot, { modelValue: 7 }, () => h(NumberFieldInput))
    ])
})

const html = await renderToString(app)
assert.match(html, /Packed consumer/)
assert.match(html, /value="7"/)
assert.match(html, /bg-secondary/)
await Promise.all(
  ['common/textTickerUtils', 'lib/tab/tabKeys'].map((entry) =>
    assert.rejects(import(`@comfyorg/design-system/${entry}`), {
      code: 'ERR_MODULE_NOT_FOUND'
    })
  )
)
process.stdout.write('Packed components render with host Reka context.\n')
