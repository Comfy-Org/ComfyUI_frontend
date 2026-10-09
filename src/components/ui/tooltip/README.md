# Tooltip

The design-system tooltip is the shadcn-vue/reka-ui compound. `App.vue` mounts
the app's `TooltipProvider`, which sets the app-wide behaviour from
`tooltipConfig.ts`: a 300 ms open delay, content that closes when the pointer
leaves the trigger, and no opening on pointer-caused focus. Vitest
(`vitest.setup.ts`) and Storybook (`.storybook/preview.ts`) supply the same
provider, so tests and stories do not mount their own.

Add a nested provider only for a surface with its own open delay, and add its
file to the `comfy/single-tooltip-provider` ESLint block:

- the selection toolbox waits 1000 ms so tooltips do not pop while you work on
  the canvas;
- the Vue node layer (`TransformPane.vue`) uses the `LiteGraph.Node.TooltipDelay`
  setting.

Tooltips hold short, text-only hints. Content that is interactive or that users
need to select or copy must use `Popover` or `HoverCard`, never `Tooltip`.

## Buttons

Give a `Button` a tooltip with props:

```vue
<Button
  :tooltip="t('g.delete')"
  tooltip-side="bottom"
  :aria-label="t('g.delete')"
>
  <i class="icon-[lucide--trash-2]" />
</Button>
```

- `tooltipSide` defaults to `top`.
- Attributes, listeners and focus still go to the rendered `<button>`.
- A tooltip equal to the button's `aria-label` is not repeated as its
  accessible description.
- Use the `#tooltip` slot for formatted content, such as a shortcut hint. The
  `tooltip` prop must still be set.
- `tooltip=""` keeps the tooltip wiring and disables it; `undefined` renders a
  plain button. When a tooltip comes and goes, pass `''`, never `undefined`,
  or the `<button>` remounts and loses focus and any popover anchored to it.

Compose `<Tooltip><TooltipTrigger as-child><Button>` without the `tooltip`
prop when the tooltip needs a template ref to the button, a controlled `open`,
or `open-on-click`.

## Other triggers

Compose the parts. The trigger child must render a single element:

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <span tabindex="0">{{ label }}</span>
  </TooltipTrigger>
  <TooltipContent side="right">{{ description }}</TooltipContent>
</Tooltip>
```

- Set `:disabled` on `Tooltip` when the text can be empty. A tooltip that
  becomes disabled while open closes.
- `TextTooltip` wraps one trigger with a plain-text tooltip, as `Button` and
  the menus use it.
- `<Tooltip open-on-click>` opens on click or tap and stays open until the
  pointer leaves or you press Escape. Use it for disclosure badges that must
  work on touch screens.

## Behaviour

- Hovering or keyboard focus opens the tooltip; pointer-caused focus,
  touch and a pressed mouse button do not.
- The tooltip closes when the pointer leaves, on click, on Escape, and on any
  wheel scroll, even one the canvas stops from propagating.
- `TooltipTrigger` opens on `pointerenter` as well as reka's `pointermove`,
  because trigger content such as node widgets can stop `pointermove` from
  bubbling.
- An open tooltip is the topmost dismissable layer, so inside a menu or dialog
  the first Escape closes the tooltip and the second closes the menu or
  dialog. This is reka's standard layering.

## Rules

- **A Button with a tooltip, a `<Tooltip>`, and a `Transition` child are
  fragments or non-element roots.** `v-show`, other directives (such as
  `v-coachmark`), `$el`, a parent's `<style scoped>` rules, attributes the
  parent passes, and `TransitionGroup` animations do not reach the element.
  Put the directive or `v-for` key on a wrapper element, or pass the attribute
  to the inner element.
- **Do not put `<Tooltip>` directly inside another trigger's `as-child` slot**,
  such as `PopoverTrigger`, `DropdownMenuTrigger` or the `Menu` `#trigger`
  slot. The outer trigger's attributes and listeners land on the `<Tooltip>`
  fragment instead of the element, so the menu never opens. Put the tooltip on
  the inner `Button` with the `tooltip` prop instead.
- A disabled `<button>` receives no pointer or focus events. To explain why it
  is disabled, wrap it in a focusable element and make that the trigger.
- A tree mounted with `render()` outside `App.vue` needs its own
  `TooltipProvider`.
- Known reka-ui bug before 2.10.4: a tooltip opened by keyboard focus stays
  open when you hover another trigger, because reka dispatches its "tooltip
  opened" event on `document` but listens for it on `window`. Upgrading
  reka-ui to 2.10.4 or later fixes it.
