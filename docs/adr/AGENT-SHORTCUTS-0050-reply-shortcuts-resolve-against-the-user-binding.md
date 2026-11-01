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
not supplied to the model. **The combo identifies the command; the surrounding
prose is never consulted.**

`canvasCommandForWrittenKeys` answers which command ships a given combo as its
default. It covers every modifier-bearing entry in `CORE_KEYBINDINGS`, not a
hand-kept list of canvas actions. A curated list drifts from the defaults, which
is the failure this decision avoids.

The lookup folds the macOS spellings (`Cmd`, `Command`, `⌘`, `Option`, `Opt`,
`⌥`, `⇧`, `Meta`), the named-key synonyms (`Return`, `Esc`, `Del`, `Spacebar`)
and case onto the labels this app uses. `useCanvasActionShortcutKeys` closes
over the keybinding store and reports every sequence that command is bound to
now, not just the first. Both are public entry points of the keybindings domain;
the agent domain declares `keybindings` as an allowed dependency, so the reply
panel reaches no other keybindings module.

`renderShortcutKeycaps` rewrites one block of rendered reply HTML. Matching runs
over a _run_ of text nodes that read as one stretch of prose rather than over
each node alone, so a combo markdown split by emphasis (`Press **Ctrl**+**B**`)
is still one combo; a run ends at a code span, link, existing keycap, line break
or any other non-prose element, so nothing is joined across them and nothing is
reordered around them. A combo is a run of modifiers terminated by one
non-modifier key, which keeps `Ctrl+C + Ctrl+V` two combos rather than one
four-key chain. A cross-platform alternation (`Ctrl/Cmd+B`) is one combo, since
both spellings fold onto the same key; matching half of it and leaving `Ctrl/`
in the prose is the failure this rules out.

Four boundaries are part of the decision, not implementation detail:

- **Shape, not words.** A combo is matched by its shape and identified by its
  keys, so the whole behaviour is language independent.
- **Never inject.** A reply naming an action without a key is unchanged. The
  transform only ever rewrites text that already held a combo.
- **Substitute only on an exact default.** A combo that is not a canvas
  action's default is left as written, even when the sentence names an action we
  have a command for.
- **Never substitute a key that still works.** A canvas default resolves to the
  binding it matches when the command still carries it, so a command with
  several defaults does not have one swapped for a sibling: `Alt++` stays
  `Alt++` rather than becoming `Alt+=`. Only a genuine rebind changes the keys.

A canvas default the user has unbound entirely is left as plain prose rather
than keycapped. The keys are known-stale, and a keycap is this panel asserting
that a key works.

Only modifier-bearing defaults enter the lookup, because a bare key in prose is
a word. Modifier-free entries in `CORE_KEYBINDINGS` are filtered out rather
than retained as silently unreachable actions.

Keycaps are built from `createElement` and text nodes, never from an HTML string,
and the result is sanitized downstream.

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

**Pairing a combo with an action word in the same sentence.** This was the first
shape of this change and it is wrong. The table of action phrases does not cover
every action, so `undo` and `copy` are absent while `save` and `run` are present,
and "Hit Ctrl+Z to undo, then save" re-keyed `Ctrl+Z` to the save binding. Guards
counting action words and combos narrowed the hole without closing it, and the
remaining cases turn a key the model got right into a wrong one, which is the
opposite of what this change is for. Caught in review by @dante01yoon.

**Treating a mouse gesture as a key.** `Ctrl+click` and `Shift+drag` are left as
written. Rendering them as keycaps is defensible but it is a separate call about
what a keycap means, and is not made here.

**A curated list of agent-relevant actions.** This repeats the defaults in a
second place and makes every new canvas shortcut a maintenance task. It also
requires a product guess about which actions the model might mention. Matching
the modifier-bearing defaults instead keeps the lookup complete without
injecting any action or shortcut that was absent from the reply.

## Consequences

The prompt carries nothing about keyboard shortcuts, so a keybinding change
needs no agent change and costs no tokens.

A correction is invisible to the model. It will keep writing the key it
remembers, and the panel will keep rewriting it. Anything that reads the agent's
raw reply text, rather than the rendered panel, sees the unrewritten key.

A key the model invented, rather than remembered, is styled and left wrong. We
cannot tell which command such a combo was meant to be without guessing from the
prose, and guessing is what this design gives up. The case it does fix, a user
who rebound an action, is the one we can answer exactly.

The agent domain now depends on keybindings. Its production import crosses one
public entry point and performs one lookup.
