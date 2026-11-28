import { render } from '@testing-library/vue'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

type RenderOptions = Parameters<typeof render>[1]

export function renderWithTooltipProvider(
  component: Component,
  options: RenderOptions = {}
) {
  const Host = defineComponent({
    setup:
      (_, { attrs, slots }) =>
      () =>
        h(TooltipProvider, { delayDuration: 0 }, () =>
          h(component, attrs, slots)
        )
  })

  return render(Host, options)
}
