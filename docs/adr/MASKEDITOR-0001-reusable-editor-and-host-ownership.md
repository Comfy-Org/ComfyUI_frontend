# ADR-MASKEDITOR-0001: Reusable editor and host ownership

Date: 2026-11-10

## Status

Accepted

## Context

The drawing engine already supports both the mask editor and painter.
Image composition and editor controls still depend on application modules
despite needing no node identity or backend transport.

## Decision

The existing mask-editor package owns image processing and reusable editor
presentation alongside its drawing engine. Dedicated UI entry points keep
painter imports separate from controls, translations, and theme integration.
The package remains browser-, Vue-, and Pinia-dependent, with one editor
per Pinia scope. The host supplies translations and theme styles.

The application owns node and widget mutations, backend references,
uploads, filename policy, persistent settings, and dialog lifetime.
The editor receives decoded images and brush-adjustment options. It reports
readiness and initialization failures, and its toolbar requests save and
cancel through events.

Masked PNG output must retain straight RGB values beneath transparent
pixels. Encoding the canvas bitmap would lose those values through alpha
premultiplication. Pixel composition therefore returns its encoded blob
alongside the canvas, before the application attaches backend references.

Clipspace remains shared extension-runtime compatibility code. Painter's
widget-scoped region history remains distinct from editor layer history.

## Alternatives

A separate editor UI package would isolate installation dependencies, but
the existing private package already requires Vue and Pinia. Dedicated
subpaths provide the import separation needed by current consumers.

Moving the application adapters into the package would introduce reverse
dependencies on node, transport, storage, and dialog contracts.
Keeping all presentation in the application would leave reusable editor
lifecycle behavior split between owners.

## Consequences

The package can build declarations and test its controls independently of
application aliases. Application tests retain upload and dialog contracts.
This decision does not add concurrent editor support or change save-failure
transaction semantics.
