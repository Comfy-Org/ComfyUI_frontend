/**
 * Schema-layout versioning (schema §10): stepwise vN → vN+1 migrations,
 * composed in order; exact no-op at the current version; FAIL-CLOSED on a
 * doc newer than this package, or one whose schema cannot be read at all —
 * never a best-effort read. Host-only: followers receive the migrated doc via
 * the struct stream / a new epoch.
 */

import * as Y from "yjs";
import { definitionsMap, nodesMap } from "./doc.js";
import { readSchemaVersion } from "./schema-version.js";
import { compareStampKeys } from "./stamps.js";
import {
  LEGACY_NODE_INCARNATION,
  NODE_INCARNATION_KEY,
  SCHEMA_VERSION,
  SchemaVersionError,
  type StampKey,
} from "./types.js";

function migrateNodeMap(node: unknown): void {
  if (!(node instanceof Y.Map)) return;
  if (!node.has(NODE_INCARNATION_KEY)) node.set(NODE_INCARNATION_KEY, LEGACY_NODE_INCARNATION);
}

function migrateStampKey(key: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(key);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed[0] !== "widget" || parsed.length !== 3) return null;
  return JSON.stringify([parsed[0], String(parsed[1]), LEGACY_NODE_INCARNATION, parsed[2]]);
}

/** Apply the v1 → v2 compatibility translation in one host-owned transaction. */
function migrateV1ToV2(doc: Y.Doc): void {
  doc.transact(() => {
    nodesMap(doc).forEach(migrateNodeMap);
    definitionsMap(doc).forEach((definition) => {
      if (!(definition instanceof Y.Map)) return;
      const nodes = definition.get("nodes");
      if (nodes instanceof Y.Map) nodes.forEach(migrateNodeMap);
    });

    const stamps = doc.getMap<unknown>("__stamps");
    for (const oldKey of [...stamps.keys()]) {
      const newKey = migrateStampKey(oldKey);
      if (newKey === null) continue;
      const value = stamps.get(oldKey) as StampKey;
      const prior = stamps.get(newKey) as StampKey | undefined;
      if (prior === undefined || compareStampKeys(value, prior) > 0) stamps.set(newKey, value);
      stamps.delete(oldKey);
    }

    doc.getMap<unknown>("meta").set("schema_version", SCHEMA_VERSION);
  });
}

/**
 * Migrate a doc from schema `fromVersion` to `SCHEMA_VERSION`, in place.
 *
 * The v1 → v2 step seeds the legacy incarnation (`"0"`) on imported nodes and
 * rewrites legacy widget stamp keys into that namespace. New add operations
 * carry their immutable `op_id` as the incarnation token.
 *
 * Validation runs before the migration step on EVERY path (KA-11: schema-version
 * discipline is enforced on read). A rejected call and a current-version no-op
 * leave the `encodeStateAsUpdate` byte-identical and the `doc.share` key set
 * unchanged; only the explicit v1 → v2 path mutates the document.
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

  if (fromVersion === 1) {
    migrateV1ToV2(doc);
    return;
  }

  // The current-version path is an EXACT no-op, byte-identical under
  // `encodeStateAsUpdate`; validation above must not materialize any root.
}
