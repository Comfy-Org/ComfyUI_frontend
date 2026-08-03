# BatchCountEdit

**Path:** `src/components/actionbar/BatchCountEdit.vue`
**Built on:** a native `<input>` + two `ui/button/Button.vue` — not `ui/stepper/FormattedNumberStepper.vue`

## Purpose

The run-count stepper next to the "Run" button in the top toolbar (the small numeric field with stacked up/down chevrons). **This is a different component from `FormattedNumberStepper`** — despite both being "a number field with +/- controls," the real app uses two distinct steppers for two distinct contexts, and they look and behave differently.

## Shape

Not a generic, reusable component — it's purpose-built for one thing (queue batch count) and reads/writes `useQueueSettingsStore()`'s `batchCount` directly, clamped to `[1, Comfy.QueueButton.BatchCountLimit]`. No props.

Layout: a compact `h-full w-14` pill — text input on the left, two stacked half-height square buttons (`size="unset"` `Button`s, `variant="secondary"`) on the right with tiny chevron icons, rather than `FormattedNumberStepper`'s side-by-side minus/input/plus row.

Behavior notably different from `FormattedNumberStepper`: increment **doubles** the current value, decrement **halves and floors** it (`batchCount * 2` / `Math.floor(batchCount / 2)`) — not a fixed `step`.

## Do

- Recognize this as the established pattern for "doubling" numeric steppers (batch/run counts, things that scale multiplicatively) — follow its increment/decrement logic if building something similar, rather than reusing `FormattedNumberStepper`'s fixed-step model.

## Don't

- Don't reach for `FormattedNumberStepper` for a run/batch-count-style control expecting it to match the real toolbar's stepper — check which one the surrounding UI actually uses. See `components/stepper.md` for the fixed-step, thousands-grouped alternative.
- Don't treat this as a general-purpose primitive — it's tightly coupled to `queueSettingsStore` and the `Comfy.QueueButton.BatchCountLimit` setting.
