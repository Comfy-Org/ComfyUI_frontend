# ADR-WIDGET-AUGMENTATION-0057: Core renders extension contributions

Date: 2026-11-14

## Status

Proposed

## Context

A custom-node author wants to help someone write a prompt, not maintain another
editor. Today that help can require replacing widget factories, attaching DOM
listeners, or assigning widget values. Those integrations inherit each
renderer's selection, focus, undo, and teardown problems. Expanding the same
prompt into a dialog can leave the extension's behavior behind.

## Decision

Let extensions register declarative contributions against named node widgets.
Core resolves active contributions and renders their controls beside the
existing input. Start with completion suggestions, live text hints, and
synchronous text transformations. The devtools example tells this story with
lighting suggestions, a tag count, and a Normalize tags action on one ordinary
multiline widget, leaving its neighboring notes field alone.

Registration supplies behavior without handing the extension an input element.

![Core resolves and renders targeted contributions](./WIDGET-AUGMENTATION-0057-core-renders-extension-contributions/registration.svg)

An accepted suggestion or transformation goes through core's guarded native
editing operation, then the input's existing value pipeline. There is no second
widget-value writer. The node editor and expanded editor share contributions,
not selection or browser undo history. Refusing an edit leaves the value intact.

![Guarded insertion rejoins the existing widget update path](./WIDGET-AUGMENTATION-0057-core-renders-extension-contributions/editing.svg)

## Migration stories

**Custom Scripts could keep its dictionaries and stop owning the input.** Its
[autocomplete integration](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/609f3afaa74b2f88ef9ce8d939626065e3247469/web/js/autocompleter.js)
replaces the string-widget factory and attaches an autocomplete engine to each
eligible textarea. Already-loaded words could supply completion providers for
explicit widget targets. This migrates cached lookup, not its global widget
discovery, rich dropdown, or custom escaping and insertion rules.

**Impact Pack could offer prompt help without mutating prompt widgets.** Its
[wildcard integration](https://github.com/ltdrdata/ComfyUI-Impact-Pack/blob/9e2d41da75c185bf7638f860d5d004035f378e9b/js/impact-pack.js)
appends wildcard and LoRA tokens through combo callbacks and writes guidance
directly to textareas. Cached wildcard tokens could supply completions for
`ImpactWildcardProcessor.wildcard_text` and
`ImpactWildcardEncode.wildcard_text`; static guidance could become hints.
Completion would be a different discovery UI, not a drop-in combo replacement.
Population, serialization overrides, and mode-dependent editability stay
outside this API. These are source-based migration candidates, not tested
migrations or promises of full compatibility.

## Tradeoffs and limits

Keep native textareas instead of replacing prompt editing with a rich editor.
Reuse existing positioning and design-system controls instead of adding an
autocomplete library. A general mount callback would admit arbitrary UI, but
would also require a public focus, keyboard, accessibility, and edit-lifecycle
contract. Defer that until a concrete contribution cannot fit this model.

The prototype covers multiline native textareas, not every widget or the
agent's structured ProseMirror editor. Exact targets and synchronous callbacks
deliberately limit discovery and remote suggestions. Native insertion still
depends on deprecated `execCommand`. Core skips unsupported insertion to
preserve undo. Cross-browser undo and automatic loading of the
built devtools extension remain release gates. Existing extension behavior is
not removed or intercepted by this proposal.
