/**
 * Schema-layout versioning (schema §10): stepwise vN → vN+1 migrations,
 * composed in order; exact no-op at the current version; FAIL-CLOSED on a
 * doc newer than this package, or one whose schema cannot be read at all —
 * never a best-effort read. Host-only: followers receive the migrated doc via
 * the struct stream / a new epoch.
 */

import type * as Y from "yjs";
import { readSchemaVersion } from "./schema-version.js";
import { SCHEMA_VERSION, SchemaVersionError } from "./types.js";

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
  //
  // `readSchemaVersion` is the package's ONE definition of that read, shared
  // with `project()`'s gate (#38) so the migration path and the normal read
  // path cannot drift into two conventions. It also normalizes: a
  // `schema_version` that is present but is not a positive integer (`"1"`,
  // `null`, `1.5`, `0`) reads as UNREADABLE rather than as a value to compare.
  // The set of documents this function rejects is unchanged — such a document
  // could never equal an integer `fromVersion` — only the message it gets
  // moves, from "does not match fromVersion" to "no readable
  // meta.schema_version", which is the more accurate of the two.
  const stored = readSchemaVersion(doc);
  if (stored === undefined) {
    throw new SchemaVersionError(
      `migrate: doc has no readable meta.schema_version — refusing to read (fail-closed, schema §10)`,
    );
  }
  if (stored !== fromVersion) {
    throw new SchemaVersionError(
      `migrate: doc meta.schema_version=${stored} does not match fromVersion=${fromVersion}`,
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
