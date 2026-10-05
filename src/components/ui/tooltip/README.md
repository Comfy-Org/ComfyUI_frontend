# Tooltip

The design-system tooltip is the shadcn-vue/reka-ui compound. `App.vue` mounts
the app's `TooltipProvider`, which sets the app-wide behaviour: a 300 ms open
delay, content that closes when the pointer leaves the trigger, and no opening
on pointer-caused focus. Do not add another provider inside the app tree,
except where a surface needs a different open delay. The selection toolbox
wraps its buttons in `<TooltipProvider :delay-duration="1000">` so tooltips do
not pop while you work on the canvas.

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

`tooltipSide` defaults to `top`. Attributes, listeners and focus still go to the
rendered `<button>`.

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

Set `:disabled` on `Tooltip` when the text can be empty. Use `:delay-duration`
only for a delay a setting controls, such as the node tooltip delay.

## Rules

- **A Button with a tooltip has a fragment root.** `v-show`, other directives
  and `$el` on that `Button` do not reach the `<button>`. Use `v-if`. If you
  need the element through a template ref, compose
  `<Tooltip><TooltipTrigger as-child><Button ref="…">` without the `tooltip`
  prop.
- **Do not put `<Tooltip>` directly inside another trigger's `as-child` slot**,
  such as `PopoverTrigger`, `DropdownMenuTrigger` or the `Menu` `#trigger`
  slot. Reka's popper contexts collide and the outer popover loses its anchor.
  Put the tooltip on the inner `Button` with the `tooltip` prop instead.
- A disabled `<button>` receives no pointer or focus events. To explain why it
  is disabled, wrap it in a focusable element and make that the trigger.
- A tree mounted with `render()` outside `App.vue` needs its own
  `TooltipProvider`.
- Known reka-ui 2.6.2 bug: a tooltip opened by keyboard focus stays open when
  you hover another trigger, because reka dispatches its "tooltip opened" event
  on `document` but listens for it on `window`. reka-ui's `v2` branch listens on
  `document`, so upgrading reka-ui fixes it.
