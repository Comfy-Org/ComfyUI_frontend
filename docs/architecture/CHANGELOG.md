# Codebase Caverns changelog

The version history of the architecture adventure game
([adventure.html](adventure.html), [WALKTHROUGH.txt](WALKTHROUGH.txt)).

## 2.0 (2026-08-25)

A holistic overhaul after the ECS migration merged. Room weight now follows a
review-volume proxy: the areas that drew the heaviest review and iteration in
PR #14246's constituent PRs get the most game depth.

### Added

- **The Registry Office** (room 11, Identity & Ownership). Registration policy
  was the migration's dominant bug class (#13528, #15009, #15017, #15019), and
  the game previously did not cover it. Its challenge, _The Clipboard Hijack_,
  is the real bug where a copied subgraph node's clone reroutes hijacked live
  chain registrations. Artifacts: GraphScope, Ownership Attachment.
- **The Hall of Mirrors** (room 12, Compatibility). The two mirror-deletion PRs
  (#13479, #13498) were the most heavily reviewed work of the migration. Its
  challenge, _The Mirror Deletion_, walks the throw vs tolerant-facade shim
  decision that review actually settled: removals and `input.link = null`
  execute through the store, additions warn and are discarded. Artifacts:
  Deprecation Telemetry, Serialization Goldens.
- A measurement ledger in the Renderer Overlook: the deleted 197µs/op layout
  operation log and the WeakMap cache that lost a benchmark to `indexOf`.
- This changelog.

### Changed

- Challenge count 9 → 11; room count 10 → 12. The ending still requires every
  challenge.
- Exits rewired to reach the new rooms: Litegraph and Services connect to the
  Hall of Mirrors; the ECS Chamber and Subgraph Depths connect to the Registry
  Office.
- The Eternal Refactor ending now names the real remaining work (slots, groups,
  properties, `widgets_values` shadows, one-sided `sendToBack`).
- All art regenerated in the V2 theme: vintage architectural blueprint,
  luminous cyan linework on midnight-blue drafting paper, generated with
  Krea 2 Turbo on Comfy Cloud. The v1 art was pixel art from a local Z-Image
  Turbo pipeline. Room images ship as WebP (~140KB each) to stay under the
  repository's 1 MiB binary cap.
- A prose pass over the room and challenge text against AI-writing checklists
  (unslop / humanizer): repeated stock openers varied, dash clusters and
  negative parallelisms rewritten.
- Walkthrough rewritten for the new map, route (24 key presses), artifact
  checklist (22), and Spaghetti Singularity path.

### Fixed

- Saves from v1 are normalized on load: a finished v1 save carried
  `endingShown: true`, which would have blocked the two new challenges and all
  keyboard navigation. The flag now resets whenever a loaded save has fewer
  than the current challenge count.

## 1.1 (2026-08-25)

The post-merge update. PR #14246 landed on 2026-08-24, so the game stopped
describing a plan and started describing what shipped, what got reversed, and
what got deferred.

### Changed

- **ECS Architect's Chamber**: the central World registry became "The Unbuilt
  World". What shipped instead: five dedicated store authorities
  (`nodeDataStore`, `linkStore`, `rerouteStore`, `widgetValueStore`,
  `layoutStore`) using register-by-reference state adoption, with a universal
  registry listed as an explicit non-goal. The badge store's
  ship-then-delete reversal appears as the derive-on-read lesson.
- **Command Forge**: inverted. The old "good" answer assumed the command bus
  was built; the shipped phase deliberately deferred it. Undo remains
  snapshot-based via ChangeTracker, and the new good answer is data-first
  sequencing.
- **Store Vaults**: `promotionStore` removed (ADR 0009 demolished it);
  `linkStore.ts` and `nodeDataStore.ts` added as artifacts. The scattered
  `_version++` challenge now reports that centralization shipped: one
  increment remains, inside `incrementVersion()` itself.
- **Service Corridors**: the "5-phase plan" answer became the real process, 22
  reviewed slices merged through `feature/ecs-migration`, with serialization
  goldens and the #13528 audit PR. Extension guidance now describes the real
  facades (warning getters, non-enumerable fields, `node._state`).
- **Subgraph Depths**: promotion feedback updated to the shipped ADR 0009
  linked-inputs design (PR #12617 deleted the view layer); state flattening,
  unpack topology preservation (#15018), and replacement transfer (#15019)
  described as shipped.
- **ID Crossroads**: branded IDs updated to what landed: per-concern keys,
  root-wide identity with GraphScope owner addressing (#15001, #15009),
  load-time collision repair, and slots deliberately left unbranded.
- **Renderer Overlook / Composables**: geometry-at-attach (#14128), cached
  projections (#14133), DOM measurement kept out of saved sizes (#14758), and
  the Yjs-for-layout-only non-goal.
- Endings rewritten around the real outcomes (mirrors deleted, wire format
  byte-identical).
- Stale documentation links fixed (`docs/architecture/ecs/` audit suite,
  extension migration guides); walkthrough updated to match.

### Added

- Icons for new and renamed artifacts and reworded choices, generated with
  Krea 2 Turbo and Ideogram at 1024px, downscaled to the 128px format.

## 1.0 (2026-03-24)

Initial release: 10 rooms, 9 challenges, 4 endings, 16 artifacts. Written
while the ECS migration was still a plan, with art from a local Z-Image Turbo
pipeline.
