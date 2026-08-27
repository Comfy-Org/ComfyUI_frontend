# Product Patterns

Patterns describe recurring composition and behavior. Components describe
individual reusable controls. Add a pattern here only when repeated evidence or
an explicit product decision makes it reusable.

## Application page shell

- Routes render inside `src/views/layouts/LayoutDefault.vue`.
- A page owns its content hierarchy and scrolling boundary; it should not
  recreate application-wide chrome.
- Use semantic base, secondary, and tertiary surfaces to express nesting.
- Keep page-specific data and behavior outside shared visual primitives.

## Modal task

Use the compound `src/components/ui/dialog` family. Compose title and optional
description, body, and footer actions. The primary action is last in reading
order; destructive actions use the destructive semantic variant. Define
loading, failure, dismissal, and unsaved-change behavior.

## Search and filter

Use the search-input family for query entry and Select, SingleSelect,
MultiSelect, or ToggleGroup for structured filters. Keep filter state explicit,
make clearing reversible, and provide a useful empty result. Do not recreate
search chrome inside a page.

## Sidebar or panel navigation

Use an established navigation family only when its density, active state, and
collapse behavior match the context. The whole visible row is interactive.
Selection uses semantic state styling and remains perceivable without color
alone.

## Data collection form

Compose the appropriate input primitives with a visible label, optional help,
and an error message. A Figma `InputFull` instance is evidence for a shared field
composition, not permission to bake labels and validation into every input.

## Pattern proposal template

When a mockup introduces an unrecognized recurring composition, add a proposal
with:

- problem and user intent;
- evidence: Comfy mockup nodes and external research URLs with access date;
- anatomy and component stack;
- states and transitions;
- responsive behavior;
- keyboard and screen-reader behavior;
- token roles, never copied color values;
- reuse threshold and why a shared pattern is warranted;
- decision: adopt, adapt, feature-local, or reject.
