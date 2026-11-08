# ADR-KEYBINDINGS-0054: Conflict-free keymaps and native focus ownership

Date: 2026-11-08

## Status

Proposed

## Context

ComfyUI has a graph canvas, editors, viewports, and dialogs that can assign different meanings to the same key. Users need one place to inspect and change those assignments without reasoning about handler registration or extension provenance. A deterministic priority order still leaves competing assignments and makes a binding's effect depend on hidden rules.

The browser already provides focus, text editing, standard control behavior, and modal interaction. Application shortcuts must cooperate with those owners. Focus containment alone does not isolate shortcuts: keyboard events inside a modal still propagate through document and window listeners.

## Decision

Maintain one effective application keymap. For every reachable focus and mode state, a key sequence has at most one eligible application assignment. Resolve conflicts before activating assignments, never by ranking handlers when a key is pressed.

### Focus determines ownership

Use actual DOM focus to identify the application owner and target instance. DOM ancestry locates that owner; it does not activate a stack of ancestor keymaps. Pointer hover and the last clicked panel do not override focus. Canvas-based editors expose a keyboard-focusable owner. Clicking an editor can focus it, but does not establish a separate active-panel state. When no application owner has focus, only explicitly applicable application-wide assignments can run. Window blur suspends application shortcuts.

Modes that cannot coexist are mutually exclusive eligibility states. A modal excludes background application assignments, including application-wide assignments. Modal commands may opt into that modal's context explicitly. Nonmodal panels remain reachable through normal keyboard navigation.

Use native modal behavior or the existing component library for focus containment, restoration, and dismissal. Do not add a parallel Escape handler that also closes the dialog or changes the background graph. An explicit component integration is required to replace a component-owned key behavior.

Native editing, IME composition, and standard widget keys remain with their control. Application undo is rebindable; text undo remains with the focused editor. Editing-specific application commands require an explicit integration with that editor. Browser and operating-system shortcuts are not promised as rebindable application commands.

### Validate assignments before activation

Commands register independently of key assignments. Core and extension defaults are proposed assignments, subject to the same validation as user edits, imports, resets, and configuration migrations. No registration or settings write may bypass validation of the resulting effective keymap.

Each assignment declares its command, keys, and applicability. Applicability uses a bounded model of focus owners, mutually exclusive modes, modal ownership, and editing state. Arbitrary JavaScript predicates and CSS selector specificity do not determine eligibility. If disjointness cannot be established, treat the assignments as conflicting.

Use the same key normalization for validation and dispatch, including platform modifier aliases. Where applicability overlaps, reject duplicate sequences and any sequence that is a prefix of another. Command availability does not excuse a conflict: disabling one command must not expose another assignment.

A conflict requires explicit replacement, unbinding, or narrower applicability. Replacement removes or narrows every conflicting assignment and validates the whole result before committing it. An invalid edit or import leaves the current valid keymap unchanged. The same keys may perform different actions only in contexts that cannot be eligible together.

Collect proposed defaults before validating them. On a fresh configuration, colliding defaults remain inactive until resolved; registration order chooses neither one. Later default proposals cannot displace an accepted assignment without confirmation. Conflicts remain visible, and explicit unbindings survive default updates. Source provenance is diagnostic metadata, never dispatch priority.

The proposed assignment flow handles ambiguity while the user edits the map. The effective map changes only after the complete replacement passes validation.

```mermaid
sequenceDiagram
    actor User
    participant Editor as Shortcut editor
    participant Validator as Assignment validation
    participant Keymap as Effective keymap
    User->>Editor: Assign K to canvas action
    Editor->>Validator: Validate proposed map
    Validator->>Keymap: Read accepted assignments
    Keymap->>Validator: K already applies application-wide
    Validator->>Editor: Conflict and affected assignments
    Note over Editor,Keymap: Accepted map remains unchanged
    Editor->>User: Offer replace, unbind, or narrower applicability
    User->>Editor: Confirm replacement
    Editor->>Validator: Validate complete replacement
    Validator->>Keymap: Commit valid replacement atomically
    Keymap->>Editor: Updated effective map
    Editor->>User: Show K and its resulting applicability
```

### Show the effective map in one interface

The shortcut editor presents one flat assignment list with keys, command, human-readable applicability, and status. It includes inactive conflicts and unavailable commands. A current-context view identifies the focused owner and shows what each application binding would do, or that native input owns the interaction. Users do not need to understand scope depth, handler order, or which package registered a command.

The editor uses the same validated keymap and eligibility rules as dispatch. For example, assigning a canvas-only key already used by an application-wide command requires a visible configuration change. Focusing the canvas cannot silently make the canvas assignment win.

### Dispatch without arbitration

Let focused controls and component handlers process their input before application shortcut execution. Respect consumed events and native ownership. Execute the unique eligible assignment, or execute no application command. Do not fall through to another binding when a command is unavailable.

Prevent the browser default only for a handled application assignment or a recognized pending sequence in an application-owned context. Do not stop propagation globally to enforce listener order. Cancel pending sequences when ownership changes; never transfer an unfinished sequence to a new owner.

A held action retains its original target. Release it exactly once on key-up, focus or mode loss, modal exclusion, window blur, or target removal. Changing owners does not start an action from a key that was already held. Entity systems handle commands against the focused target; individual entities do not register competing physical-key listeners or own user keymap settings.

These are proposed responsibilities, not names of implemented APIs. The native-input branch leaves the browser default intact even when the event reaches the application listener. The application branch has no winner-selection step.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Control as Focused control or component
    participant Dispatch as Application dispatch
    participant Keymap as Effective keymap
    participant Command as Command and target
    User->>Browser: Press a key
    Browser->>Control: Deliver keydown
    Control->>Control: Process component-owned input
    opt Event continues to application listener
        Control->>Dispatch: Propagate event
        Dispatch->>Browser: Read focus and modal ownership
        Browser->>Dispatch: Current owner and target
        alt Native editing or component-owned input
            Note over Dispatch,Command: No application command executes
        else Application-owned input
            Dispatch->>Keymap: Lookup in current context
            Note over Dispatch,Keymap: Modal context excludes background assignments
            Keymap->>Dispatch: At most one assignment
            alt Assignment exists and command is available
                Dispatch->>Command: Execute against focused target
                Command->>Dispatch: Handled
                Dispatch->>Browser: preventDefault
            else No available command
                Note over Dispatch,Command: No fallback to another assignment
            end
        end
    end
    opt Default remains uncancelled
        Browser->>Control: Perform native default where applicable
    end
```

### Migrate without claiming control over arbitrary listeners

Move core and extension application shortcuts through this keymap. Preserve unknown stored assignments as inactive data with a visible reason. They must not execute through an unvalidated fallback dispatcher.

Legacy document and window listeners can bypass focus policy and uniqueness. Provide migration guidance and identify incompatible extensions. A compatibility path cannot claim the conflict-free guarantee while independent listeners can still execute the same input. Capture-first execution and extension ranking are not substitutes for that migration.

## Alternatives considered

- Scope depth, source priority, and registration-order tiebreaks make conflicts deterministic but require users to understand hidden precedence.
- Warning about conflicts while retaining both assignments leaves dispatch to choose a winner and defeats the editor's account of the effective map.
- Focus trapping every panel restricts keyboard navigation and still does not stop document listeners. Focus containment belongs to modal interaction.

### Runtime ranking versus a validated map

The ranking branch summarizes the [original ADR proposal at the reviewed head](https://github.com/Comfy-Org/ComfyUI_frontend/blob/627b3915daf2ab52ec396bc36a3abd86691e0352/docs/adr/KEYBINDINGS-0054-scoped-keybinding-resolution.md), not implemented behavior. A warning-only editor still needs runtime arbitration if it retains competing assignments. Both models need native ownership checks and held-action cleanup. The replacement moves conflict resolution to configuration rather than eliminating that work.

```mermaid
flowchart TB
    subgraph ranked["Alternative: keep competing assignments"]
        rankInput["Application-owned keydown"]
        rankMatches["Collect matching scopes and conditions"]
        rankDepth["Compare scope depth"]
        rankSource["Compare source and foreign-extension exception"]
        rankTie["Apply deterministic tiebreak"]
        rankExecute["Execute winning assignment"]
        rankInput --> rankMatches --> rankDepth --> rankSource --> rankTie --> rankExecute
    end
    subgraph unique["Proposed: reject ambiguity before activation"]
        uniqueInput["Application-owned keydown"]
        uniqueContext["Identify focused owner and mode"]
        uniqueLookup["Lookup validated effective map"]
        uniqueExecute["Execute unique available assignment or none"]
        uniqueInput --> uniqueContext --> uniqueLookup --> uniqueExecute
    end
```

### Why focus containment alone is insufficient

This deliberately ungated native-dialog example illustrates the limit of focus containment. Focus remains in the modal, but the document listener still receives the key. The replacement prevents the background command by making its assignment ineligible, while leaving native modal behavior intact.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Modal as Modal input
    participant Listener as Ungated document listener
    participant Background as Background command
    User->>Browser: Open dialog with showModal
    Browser->>Modal: Focus input and make background inert
    User->>Browser: Press x
    Browser->>Modal: Deliver keydown
    Modal->>Listener: Event bubbles through document
    Listener->>Background: Execute without checking modal ownership
    Browser->>Modal: Insert x through native default
    Note over Modal,Background: Focus containment succeeded but command isolation failed
```

## Consequences

Users resolve ambiguous assignments in configuration, where the effect is visible. Native controls keep their established behavior, and repeated viewport instances share command definitions while focus supplies the target.

Some defaults and imported assignments need user resolution before activation. The application must maintain an explicit, bounded eligibility model and validate all assignment changes against it. Extensions with independent listeners require migration; this decision does not establish a security boundary against arbitrary extension JavaScript.

## Acceptance criteria

- An overlapping assignment or prefix conflict cannot activate through any configuration entry point. A rejected change preserves the valid keymap.
- The same key can serve two exclusive modes, but an application-wide and a focused-panel assignment cannot overlap without explicit resolution.
- Changing registration order does not change an accepted keymap. Conflicting fresh defaults remain visibly inactive rather than selecting a winner.
- A modal prevents background commands while preserving its focus and dismissal behavior. Text editing, composition, and standard widget keys remain local.
- The current-context view and dispatch agree on command and target. Unavailable commands do not reveal hidden fallback assignments.
- Ownership loss releases held actions once and cancels pending sequences.

## References

- [HTML dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) and [Reka Dialog](https://reka-ui.com/docs/components/dialog) describe modal focus and dismissal behavior, not isolation from document listeners.
- [NbClassic shortcut editing](https://github.com/jupyter/nbclassic/blob/173fdfecbda8e4e6a70d865fda7970ceb5239137/nbclassic/static/notebook/js/shortcuteditor.js) and [mode dispatch](https://github.com/jupyter/nbclassic/blob/173fdfecbda8e4e6a70d865fda7970ceb5239137/nbclassic/static/notebook/js/keyboardmanager.js) provide partial precedents for rejecting occupied assignments and selecting exclusive modes. Programmatic registration can bypass editor validation.
- [Closure's shortcut registry](https://github.com/google/closure-library/blob/b312823ec5f84239ff1db7526f4a75cba0420a33/closure/goog/ui/keyboardshortcuthandler.js) rejects duplicate and prefix-conflicting registrations within one registry. The archived library is a reference, not a dependency recommendation.
