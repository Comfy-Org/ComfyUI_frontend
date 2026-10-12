/**
 * Schema-layout versioning (schema §10): exact no-op at the current version;
 * older schemas are refused under the private-alpha no-compat-reader policy;
 * FAIL-CLOSED on a
 * doc newer than this package, or one whose schema cannot be read at all —
 * never a best-effort read. Host-only: followers receive the current-format doc via
 * the struct stream / a new epoch.
 */

import * as Y from "yjs";
import { readSchemaVersion } from "./schema-version.js";
import { SCHEMA_VERSION, SchemaVersionError } from "./types.js";

/**
 * Validate that a doc is already at `SCHEMA_VERSION`.
 *
 * The current-version path is an exact no-op. Older, newer, unreadable, and
 * caller/document-mismatched versions are refused fail-closed (KA-11). Every
 * path leaves `encodeStateAsUpdate` byte-identical and the `doc.share` key set
 * unchanged; this function provides no compatibility reader and never
 * relabels an old layout as the current one.
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

  if (fromVersion < SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `migrate: schema v${fromVersion} is unsupported by the private-alpha no-compat-reader policy; refusing to relabel it as v${SCHEMA_VERSION}`,
    );
  }

  // The current-version path is an EXACT no-op, byte-identical under
  // `encodeStateAsUpdate`; validation above must not materialize any root.
}
