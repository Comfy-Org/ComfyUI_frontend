# ADR-NODE-PREVIEW-0060: Default output preview ownership

Date: 2026-11-19

## Status

Accepted

## Context

Extensions can replace a generated node class with their own class and media
renderer. The replacement need not inherit core preview support. Vue's implicit
executed-output preview previously rendered stored images regardless of that
choice, duplicating custom previews. Stored output alone cannot establish who
should render it.

## Decision

Installing core preview support opts the generated prototype into Vue's default
executed-output preview through the existing `hideOutputImages = false`
contract. Subclasses inherit the opt-in. An instance can opt out with `true`.
An unset flag leaves rendering to the replacement class.

Keep output storage independent of rendering ownership. Restoring outputs does
not claim a preview surface. Live sampling previews and explicitly promoted
subgraph previews retain their existing behavior.

## Alternatives considered

- Widget names identify extensions rather than ownership. Custom widgets can
  also coexist with a legitimate default preview.
- Callback presence or identity cannot distinguish custom drawing from a
  wrapper that preserves core preview behavior.
- A separate prototype registry duplicates the existing flag and prototype
  inheritance without adding an ownership fact.

## Compatibility

A standalone replacement class that relied on Vue's implicit output preview
must explicitly set `hideOutputImages = false`. A replacement with its own
preview needs no change. Generated subclasses with custom previews must still
set `hideOutputImages = true`.

There is no reliable inference that both suppresses duplicates and preserves
the implicit preview for every unmarked replacement class.
