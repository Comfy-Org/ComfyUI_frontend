# ADR-THEME-DOMAIN-0055: Theme presets and runtime targets

Date: 2026-11-09

## Status

Accepted

## Context

Color palettes configure semantic CSS tokens, canvas rendering, node shape,
and background images. The file format is an extension contract, but its
section names do not describe what application consumers need.

Settings types also depend on the preset schema. Putting that schema in the
application would make a shared package depend on the frontend.

## Decision

Separate an authored `ThemePreset` from a resolved `Theme`. A pure theme core
owns the schema, built-in presets, and resolution. The application theme domain
owns target writers, active selection, and persistence. Settings depends on the
core, not the application.

Resolution fills missing file values from the matching dark or light preset.
Semantic tokens then layer derived defaults, base tokens, legacy derivation for
non-core themes, and explicit tokens in that order. Resolution never mutates the
authored preset, so viewing a preset does not change its exported file.

Application consumers read resolved values by purpose rather than file section.
One apply entry point writes to an explicit style target. A canvas target also
enables LiteGraph globals and canvas writes. Style-only application must not
change the graph theme, including when a dark consent card appears in a light
workspace. The service owns transition suppression and splash persistence,
which are document lifecycle effects rather than theme values.

Keep the JSON format and persisted setting keys unchanged. Retain the legacy
`app.extensionManager.colorPalette` API, including its synchronous getter and
mutable completed file. WAS Node Suite mutates slot colors through that getter;
Genereti registers presets through the service; Wildcard Pipeline reads the
active preset's `light_theme` flag. These observed callers prevent removing or
replacing that API with a read-only runtime theme.

## Alternatives considered

- Move everything into the application. This reverses the dependency between
  settings and application code.
- Put the canvas writers and store in the pure package. They depend on the
  application's canvas and stores, so this would move the dependency problem.
- Rename the JSON sections as well. That requires a file migration and would
  break extensions without improving the internal runtime boundary.
- Keep separate style-only helpers. That leaves previews and onboarding with
  a different token application path from the workspace.

## Consequences

Future visual metrics belong in the resolved theme rather than leaking file
section names to consumers. The legacy completed file remains available only
for compatibility and target writers. This decision does not merge the light
and dark CSS token sets or change existing palette values.
