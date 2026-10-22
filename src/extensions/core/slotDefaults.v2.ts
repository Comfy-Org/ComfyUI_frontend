/**
 * SlotDefaults — rewritten with the v2 extension API.
 *
 * v1 used `init` + `beforeRegisterNodeDef` + direct `app.ui.settings.addSetting`.
 * v2 uses `defineExtension({ setup(ext) })`. The `ExtensionManager` passed to
 * `setup` exposes `setting.get/set` but NOT `addSetting` — that gap is noted below.
 *
 * What this file demonstrates to Simon/Austin:
 *  1. App-level extensions (init/setup) map cleanly to `defineExtension`.
 *  2. `beforeRegisterNodeDef` has no v2 equivalent — node type metadata is not
 *     surfaced through the v2 API at registration time.
 *  3. `app.ui.settings.addSetting` (declares a new setting with slider + label)
 *     has no v2 `ExtensionManager` surface.
 *
 * API GAPS (feedback items for Simon/Austin):
 *  GAP-4: No `beforeRegisterNodeDef` hook on `ExtensionOptions`. This hook
 *         fires *once per node type*, before any instance exists, giving access
 *         to `nodeData` (input/output schema). Needed for type-level analysis
 *         (e.g. slot type registry). Candidate: `onNodeTypeRegistered(typeDef)`.
 *  GAP-5: `ExtensionManager.setting` exposes only `get/set`. It does NOT
 *         expose `addSetting` (declare a new setting with UI metadata, type,
 *         default, onChange callback). Needed for extensions that contribute
 *         settings to the settings dialog. Candidate: extend the `setting`
 *         interface with `add(spec: SettingSpec)`.
 *  GAP-6: `LiteGraph.registered_slot_in_types` / `slot_types_out` are
 *         global LiteGraph state mutated here. No v2 abstraction exists for
 *         the "node suggestions" subsystem. Low priority — this is fine to
 *         keep calling LiteGraph directly as an implementation detail.
 *
 * Interim strategy: `setup()` falls back to direct LiteGraph manipulation for
 * slot type data. The settings contribution stays as a TODO annotation until
 * GAP-5 is resolved.
 */

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { defineExtension } from '@/extension-api'

// ── v2 registration ──────────────────────────────────────────────────────────

/**
 * @remarks
 * **DEMO — incomplete migration.** Compared to v1
 * (`src/extensions/core/slotDefaults.ts`), this v2 port currently only sets
 * `LiteGraph.search_filter_enabled = true`. The following v1 features are
 * **not yet ported** and stay as feedback items for Simon/Austin:
 *
 *  - Node-type metadata accumulation via `beforeRegisterNodeDef` (GAP-4)
 *  - Settings-dialog contribution for the suggestion-count slider (GAP-5)
 *  - LiteGraph slot-type registry mutation (GAP-6, low priority)
 *
 * Do not rely on this extension for slot-default behavior in PoC bring-up —
 * load the v1 `slotDefaults.ts` instead, or wait for the gaps above to land.
 */
defineExtension({
  name: 'Comfy.SlotDefaults.V2 (DEMO — incomplete migration)',

  init() {
    LiteGraph.search_filter_enabled = true
  },

  setup() {
    // GAP-5: In v1, `app.ui.settings.addSetting(spec)` declared a user-facing
    // slider in the settings dialog with an onChange callback. In v2,
    // `defineExtension({ setup })` takes no arguments — the ExtensionManager
    // is not yet plumbed into the setup callback. Until GAP-5 is resolved,
    // we cannot register the user-facing setting from a v2 extension.
    //
    // GAP-4: In v1, `beforeRegisterNodeDef(nodeType, nodeData)` processed each
    // node type's input/output schema. In v2 there is no equivalent hook.
    // The slot-type accumulator logic from v1 cannot be ported until
    // `onNodeTypeRegistered(def)` or equivalent is added to the API.
  }
})
