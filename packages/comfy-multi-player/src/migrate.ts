/**
 * Schema-layout versioning (schema §10): stepwise vN → vN+1 migrations,
 * composed in order; exact no-op at the current version; FAIL-CLOSED on a
 * doc newer than this package, or one whose schema cannot be read at all —
 * never a best-effort read. Host-only: followers receive the migrated doc via
 * the struct stream / a new epoch.
 */

import type * as Y from "yjs";
import { metaMap } from "./doc.js";
import { SCHEMA_VERSION, SchemaVersionError } from "./types.js";

/**
 * The doc's OWN claim about its layout, read without materializing anything.
 *
 * `Y.Doc#getMap` lazily CREATES an absent root type and registers it in
 * `doc.share`, so calling it unconditionally turns an inspection into a
 * repair — the exact defect in #20. `doc.share.has("meta")` asks the safe
 * question instead: has this root been INTEGRATED, either by an incoming
 * update or by a prior `getMap`? Note that a root arrives over the wire only
 * once it carries content — an empty root map is not encoded — which is why a
 * snapshot-forked replica legitimately lacks roots the minting doc had. Both
 * "absent" and "present but empty" yield `undefined` here, and both are
 * fail-closed for the caller, so the distinction never has to be drawn.
 * Typing a root that is
 * ALREADY present (Yjs `AbstractType` → `Y.Map`) creates no struct and no new
 * share key, so the read stays byte-exact under `encodeStateAsUpdate` and
 * leaves the `doc.share` key set unchanged. It is a client-side
 * REINTERPRETATION of structs the doc already holds: the share entry for a
 * root that arrived untyped is replaced by the typed view of the same structs,
 * which is what every reader in this package (and the read-only surface) does.
 *
 * Returns `undefined` when the schema version is unreadable — either the
 * `meta` root is absent, or it carries no `schema_version`. Both are
 * fail-closed cases for the caller (KA-11), not defaults to fill in.
 */
function storedSchemaVersion(doc: Y.Doc): unknown {
  if (!doc.share.has("meta")) return undefined;
  return metaMap(doc).get("schema_version");
}

/**
 * Migrate a doc from schema `fromVersion` to `SCHEMA_VERSION`, in place.
 *
 * v1 is the first layout, so there is nothing to step through yet: the call
 * validates the doc's stored schema and no-ops at
 * `fromVersion === SCHEMA_VERSION`, and rejects everything else fail-closed.
 * When a v2 layout lands, its `v1 → v2` step registers here and this function
 * composes the steps in order.
 *
 * Validation runs on EVERY path, including the current-version one (KA-11:
 * schema-version discipline is enforced on read), and it never mutates the
 * document: a rejected call and a current-version no-op both leave
 * `encodeStateAsUpdate(doc)` byte-identical and the `doc.share` key set
 * unchanged — no root is materialized on any path.
 */
export function migrate(doc: Y.Doc, fromVersion: number): void {
  if (!Number.isInteger(fromVersion) || fromVersion < 1) {
    throw new SchemaVersionError(
      `migrate: no migration path from schema v${String(fromVersion)} (v1 is the first layout)`,
    );
  }
  if (fromVersion > SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `migrate: doc schema v${fromVersion} is newer than this package's v${SCHEMA_VERSION} — refusing to read (fail-closed, schema §10)`,
    );
  }

  // KA-11 fail-closed read gate. The caller's `fromVersion` is a claim about a
  // document it may not have minted; the document's own `meta.schema_version`
  // is the trusted value, so the two must agree before anything reads the
  // layout. An unreadable schema is rejected rather than assumed current.
  const stored = storedSchemaVersion(doc);
  if (stored === undefined) {
    throw new SchemaVersionError(
      `migrate: doc has no readable meta.schema_version — refusing to read (fail-closed, schema §10)`,
    );
  }
  if (stored !== fromVersion) {
    throw new SchemaVersionError(
      `migrate: doc meta.schema_version=${String(stored)} does not match fromVersion=${fromVersion}`,
    );
  }

  // `fromVersion` is now known to equal SCHEMA_VERSION: it is an integer in
  // [1, SCHEMA_VERSION] and v1 is both the first and the current layout. So
  // there is nothing to step, and — the point of #20 — no root type is
  // touched: this is an EXACT no-op, byte-identical under
  // `encodeStateAsUpdate` and leaving `doc.share` alone. The previous
  // implementation "validated" the layout here by calling the
  // `nodes`/`links`/`definitions`/`meta` helpers, and `Y.Doc#getMap` CREATES
  // an absent root, so it silently repaired an incomplete doc instead of
  // rejecting it.
  //
  // When a v2 layout lands, its `v1 → v2` step runs from here under
  // `if (fromVersion < SCHEMA_VERSION)`, and the steps compose in order.
}
