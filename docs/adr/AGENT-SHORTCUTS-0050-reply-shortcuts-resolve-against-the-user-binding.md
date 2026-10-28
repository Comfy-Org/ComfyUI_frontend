# ADR-AGENT-SHORTCUTS-0050: Reply Shortcuts Resolve Against the User's Binding

Date: 2026-10-28

## Status

Accepted

## Context

DES-779 asked for keyboard shortcuts in agent replies to stand out as inline
calls to action. Two problems sit behind that. The agent names a shortcut from
training data, so it sometimes gives a key that is wrong for this build, and it
always gives the wrong one to a user who rebound the action or loaded a preset.

The keybinding registry lives here. `keybindingStore` knows the live binding per
command, and `keyCombo.ts` labels `Meta` as `Ctrl` with no Mac-specific labels,
so the Keybindings settings panel reads `Ctrl + B` on every platform.

The agent's own prompt is the alternative place to answer this. Its always-on
`building` skill is inlined into the system prompt on every model round of every
turn, for every user, whether or not the turn mentions the canvas. Comfy-Org/cloud#16788
has the measurements.

## Decision

A keyboard shortcut named in an agent reply is resolved when the reply renders,
not supplied to the model.

`CANVAS_ACTION_COMMAND_IDS` maps the action phrases an agent reply uses to the
commands they run, and is the only place reply text is tied to a keybinding. It
holds no keys. `useCanvasActionShortcutKeys` closes over the keybinding store and
answers per command, so user bindings and presets win over the shipped defaults.
It is a public entry point of the keybindings domain; the agent domain declares
`keybindings` as an allowed dependency and keybindings declares `agent` as an
allowed consumer, so the reply panel reaches no other keybindings module.

`renderShortcutKeycaps` rewrites one block of rendered reply HTML. A
modifier-bearing key combo becomes `<kbd>` keycaps. When the sentence holding it
contains exactly one combo and names exactly one mapped canvas action, the combo
is replaced by that command's current keys. Everything else is styled and left as
written.

Three boundaries are part of the decision, not implementation detail:

- **Shape, not words.** A combo is matched by its shape, so the styling half is
  language independent.
- **Never inject.** A reply naming an action without a key is unchanged. The
  transform only ever rewrites text that already held a combo.
- **Ambiguity means hands off.** Two action words, or two combos, in one
  sentence makes the pairing a guess, so no substitution happens. A confidently
  wrong key is worse than an unstyled right one.

Keycaps are built from `createElement` and text nodes, never from an HTML string,
and the result is sanitized downstream.

`canvasActionShortcuts.test.ts` holds every command id in the table against
`CORE_KEYBINDINGS`, so unbinding or renaming a command fails there rather than
silently dropping a keycap from replies.

## Alternatives considered

**A shortcut list in the agent's always-on prompt** (Comfy-Org/cloud#13385,
closed). It can only carry the shipped default, so it is wrong for any user who
rebinds, and the PR said so. Nothing links it to `defaults.ts`, so it rots
silently. It is re-billed on every turn for every user. Its Mac note also
contradicted this app, telling macOS users the key is Cmd when the settings
panel shows Ctrl.

**An on-demand skill behind `load_skill`.** Cheaper than always-on, but
`load_skill` is a decision the model makes before starting a task, not mid-reply
when it is about to name a key. It would not fire where it is needed.

**A hint on a tool result.** Attaching the shortcut to a bypass or mute edit
result costs nothing and fires exactly when relevant. It covers only the turns
where the agent performed the action itself, not the ones where the user asked
how to do it by hand. Worth adding later as a complement, not a replacement.

**Treating a mouse gesture as a key.** `Ctrl+click` and `Shift+drag` are left as
written. Rendering them as keycaps is defensible but it is a separate call about
what a keycap means, and is not made here.

## Consequences

The prompt carries nothing about keyboard shortcuts, so a keybinding change
needs no agent change and costs no tokens.

A correction is invisible to the model. It will keep writing the key it
remembers, and the panel will keep rewriting it. Anything that reads the agent's
raw reply text, rather than the rendered panel, sees the unrewritten key.

Action-phrase matching is English, so a non-English reply gets the styling but
not the correction. The styling half is the part that is language independent.

The agent domain now depends on keybindings. That dependency is narrow by
construction: one entry point, one lookup.
