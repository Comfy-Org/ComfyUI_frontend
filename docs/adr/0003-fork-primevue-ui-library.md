# 3. Fork PrimeVue UI Library

Date: 2025-08-27

## Status

Proposed

## Context

ComfyUI's frontend requires modifications to PrimeVue components that cannot be achieved through the library's customization APIs. Two specific technical incompatibilities have been identified with the transform-based canvas architecture:

**Screen Coordinate Hit-Testing Conflicts:**
- PrimeVue components use `getBoundingClientRect()` for screen coordinate calculations that don't account for CSS transforms
- The Slider component's `updateDomData()` method (lines 89-94) captures screen coordinates, then `setValue()` (lines 96-110) calculates positions using raw `pageX/pageY` coordinates against these untransformed bounds
- This breaks interaction in transformed coordinate spaces where screen coordinates don't match logical element positions

**Virtual Canvas Scroll Interference:**
- LiteGraph's infinite canvas uses scroll coordinates semantically for graph navigation via the `DragAndScale` coordinate system
- PrimeVue overlay components automatically trigger `scrollIntoView` behavior which interferes with this virtual positioning
- This issue is documented in [PrimeVue discussion #4270](https://github.com/orgs/primefaces/discussions/4270) where the feature request was made to disable this behavior

**Historical Overlay Issues:**
- Previous z-index positioning conflicts required manual workarounds (commit `6d4eafb0`) where PrimeVue Dialog components needed `autoZIndex: false` and custom mask styling, later resolved by removing PrimeVue's automatic z-index management entirely

**Minimal Update Overhead:**
- Analysis of git history shows only 2 PrimeVue version updates in 2+ years, indicating that upstream sync overhead is negligible for this project

**Future Interaction System Requirements:**
- The ongoing canvas architecture evolution will require more granular control over component interaction and event handling as the transform-based system matures
- Predictable need for additional component modifications beyond current identified issues

## Decision

We will fork PrimeVue as a workspace package within our existing monorepo using git subtree with `--squash` flag.

**Implementation:**
1. Add PrimeVue fork to `packages/@comfyui/primevue/` using git subtree
2. Use `--squash` flag to avoid polluting contributor graph with upstream history  
3. Link via pnpm workspace: `"@comfyui/primevue": "workspace:*"`
4. Mark vendored directory in `.gitattributes` with `linguist-vendored`

**Rationale:**
Following the same pattern established in [ADR-0001](0001-merge-litegraph-into-frontend.md) (except with `squash` this time), this approach allows seamless editing within the monorepo while preserving the ability to sync upstream changes when needed.

## Consequences

### Positive

- **Atomic commits**: Frontend and UI changes can be committed together
- **Hot reload**: Development workflow remains fast with immediate feedback  
- **Technical control**: Can modify coordinate calculation methods and scrollIntoView behavior for canvas compatibility
- **Consistent contributor graph**: Squashed commits prevent upstream authors from appearing in our repository statistics
- **Upstream sync capability**: Can pull upstream changes using `git subtree pull --squash` (though rarely needed based on update history)
- **No publishing overhead**: No need to coordinate npm releases across repositories
- **Future-proofed**: Accommodates ongoing interaction system requirements as canvas architecture evolves

### Negative

- **Repository size increase**: Monorepo will grow with PrimeVue source code
- **Manual conflict resolution**: Upstream syncs may require manual conflict resolution due to squashed history 
- **Maintenance responsibility**: Must maintain PrimeVue code directly instead of relying on upstream
- **Upstream contribution difficulty**: Cannot easily contribute changes back to PrimeVue upstream
- **Developer onboarding**: All developers need to understand the full monorepo structure

## Notes

- Will use same git subtree approach as LiteGraph merge in ADR-0001
- PrimeVue upstream sync commands:
  ```bash
  git subtree pull --prefix=packages/@comfyui/primevue primevue-upstream main --squash
  ```
- This decision supports the monorepo structure outlined in [ADR-0002](0002-monorepo-conversion.md)
- Primary focus on coordinate system compatibility and canvas interaction requirements
