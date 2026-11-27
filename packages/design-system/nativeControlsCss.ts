import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

import { cn } from '@comfyorg/tailwind-utils'

import { buttonRecipe, buttonVariants } from './src/button.variants'
import {
  checkboxClass,
  checkboxIndicator
} from './src/components/checkbox/checkbox.styles.ts'
import { inputClass } from './src/components/input/input.styles.ts'
import {
  selectControlRecipe,
  selectControlVariants
} from './src/components/select/selectControl.variants.ts'
import {
  sliderHorizontalTrackClass,
  sliderRootClass,
  sliderThumbClass,
  sliderTrackClass
} from './src/components/slider/slider.styles.ts'
import { textareaClass } from './src/components/textarea/textarea.styles.ts'
import {
  toggleGroupItemRecipe,
  toggleGroupItemVariants,
  toggleGroupVariants
} from './src/components/toggle-group/toggleGroup.variants.ts'

function attribute(name: string, value: string, defaultValue: string) {
  const match = `[data-${name}=${JSON.stringify(value)}]`
  return value === defaultValue ? `:is(${match}, :not([data-${name}]))` : match
}

function applyCommonClasses(selector: string, combinations: Set<string>[]) {
  const first = combinations.at(0)
  if (!first) return ''
  const common = [...first].filter((utility) =>
    combinations.every((classes) => classes.has(utility))
  )
  if (!common.length) return ''
  for (const classes of combinations) {
    for (const utility of common) classes.delete(utility)
  }
  return `${selector} { @apply ${common.join(' ')}; }`
}

function variantRules<V extends string, S extends string>(
  selector: string,
  recipe: {
    variants: { variant: Record<V, string>; size: Record<S, string> }
    defaultVariants: { variant: NoInfer<V>; size: NoInfer<S> }
  },
  classes: (props: { variant: NoInfer<V>; size: NoInfer<S> }) => string
) {
  const variants = new Map<string, Map<string, Set<string>>>()
  for (const variant in recipe.variants.variant) {
    const sizes = new Map<string, Set<string>>()
    for (const size in recipe.variants.size) {
      sizes.set(
        attribute('size', size, recipe.defaultVariants.size),
        new Set(classes({ variant, size }).split(/\s+/))
      )
    }
    variants.set(
      attribute('variant', variant, recipe.defaultVariants.variant),
      sizes
    )
  }

  const rows = [...variants.values()]
  const rules = [
    applyCommonClasses(
      selector,
      rows.flatMap((row) => [...row.values()])
    )
  ]
  for (const [variant, sizes] of variants) {
    rules.push(applyCommonClasses(selector + variant, [...sizes.values()]))
  }
  for (const size of rows[0]?.keys() ?? []) {
    rules.push(
      applyCommonClasses(
        selector + size,
        rows.flatMap((row) => row.get(size) ?? [])
      )
    )
  }
  for (const [variant, sizes] of variants) {
    for (const [size, utilities] of sizes) {
      rules.push(applyCommonClasses(selector + variant + size, [utilities]))
    }
  }
  return rules.join('\n')
}

function checkboxRules() {
  const selector = 'input.ds-checkbox[type="checkbox"]'
  const root = cn(checkboxClass, 'appearance-none')
    .replaceAll('data-[state=checked]:', 'checked:')
    .replaceAll('data-[state=indeterminate]:', 'indeterminate:')
  return `
    ${selector} { @apply ${root}; }
    ${selector}:checked:not(:indeterminate)::before { content: ''; @apply ${checkboxIndicator.checked}; }
    ${selector}:indeterminate::before { content: ''; @apply ${checkboxIndicator.indeterminate}; }
  `
}

function sliderRules() {
  const selector = 'input.ds-slider[type="range"]'
  const root = cn(
    sliderRootClass,
    'min-h-6 cursor-pointer appearance-none bg-transparent focus-visible:outline-none'
  ).replaceAll('data-disabled:', 'disabled:')
  const track = cn(
    sliderTrackClass,
    sliderHorizontalTrackClass.replace('data-[orientation=horizontal]:', ''),
    'w-full'
  )
  const thumb = sliderThumbClass.replace(
    /(?:^| )(?:focus-visible|disabled):\S+/g,
    ''
  )
  return `
    ${selector} { @apply ${root}; }
    ${selector}::-webkit-slider-runnable-track { @apply ${track}; }
    ${selector}::-moz-range-track { @apply ${track}; }
    ${selector}::-webkit-slider-thumb { @apply ${thumb} appearance-none relative top-1/2 -translate-y-1/2; }
    ${selector}::-moz-range-thumb { @apply ${thumb} border-none; }
    ${selector}:focus-visible::-webkit-slider-thumb { @apply ring-2; }
    ${selector}:focus-visible::-moz-range-thumb { @apply ring-2; }
  `
}

function selectRules() {
  return Object.entries(selectControlRecipe.variants.size)
    .map(([size]) => {
      if (size !== 'md' && size !== 'lg') return ''
      const selector = `select.ds-select${attribute('size', size, selectControlRecipe.defaultVariants.size)}`
      return [false, true]
        .map((invalid) => {
          const state = invalid
            ? '[aria-invalid="true"]'
            : ':not([aria-invalid="true"])'
          return `${selector}${state} { @apply ${cn(selectControlVariants({ size, invalid }), 'appearance-auto')}; }`
        })
        .join('\n')
    })
    .join('\n')
}

export const nativeControlsEntry = fileURLToPath(
  new URL('./native-controls.js', import.meta.url)
)
const stylesheet = fileURLToPath(
  new URL('./src/css/native-controls.css', import.meta.url)
)

export function nativeControlsCss(): Plugin {
  return {
    name: 'design-system-native-controls',
    resolveId(id) {
      if (id === nativeControlsEntry) return id
      if (id === stylesheet) return id
    },
    load(id) {
      if (id === nativeControlsEntry)
        return `import ${JSON.stringify(stylesheet)}`
      if (id !== stylesheet) return

      const button = variantRules('button.ds-button', buttonRecipe, (props) =>
        cn(buttonVariants(props))
      )
      const toggle = variantRules(
        'button.ds-toggle[aria-pressed]',
        toggleGroupItemRecipe,
        (props) =>
          cn(toggleGroupItemVariants(props), 'min-w-0 flex-none')
            .replaceAll('data-[state=on]:', 'aria-pressed:')
            .replaceAll('hover:bg-', 'aria-[pressed=false]:hover:bg-')
      )
      const segment = variantRules(
        'label.ds-segment',
        toggleGroupItemRecipe,
        (props) =>
          cn(toggleGroupItemVariants(props), 'min-w-0 flex-none')
            .replaceAll('data-[state=on]:', 'has-[:checked]:')
            .replaceAll('hover:bg-', '[&:not(:has(:checked))]:hover:bg-')
            .replaceAll('focus-visible:', 'has-[:focus-visible]:')
            .replaceAll('disabled:', 'has-[:disabled]:')
      )

      return `@reference './theme.css';
        @layer components {
          ${button}
          ${toggle}
          .ds-segmented { @apply ${toggleGroupVariants()}; }
          .ds-segment > input[type="radio"] { @apply sr-only; }
          ${segment}
          ${checkboxRules()}
          input.ds-input { @apply ${inputClass}; }
          textarea.ds-textarea { @apply ${textareaClass}; }
          ${sliderRules()}
          ${selectRules()}
        }
      `
    }
  }
}
