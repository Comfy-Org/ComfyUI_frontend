import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  SchemaVersionError,
  metaMap,
  migrate,
  mint,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

describe("schema version on read", () => {
  // project() currently has NO schema-version guard, so migrate() is the
  // fail-closed read entrypoint a host must call before project(). These tests
  // pin both guarded branches of migrate() against a tampered meta.schema_version.

  it("fails closed when the stored schema is newer than this reader", () => {
    const doc = mint({ nodes: [], links: [] }, loadCatalog());
    const futureVersion = SCHEMA_VERSION + 1;
    metaMap(doc).set("schema_version", futureVersion);

    // Reading a doc minted by a newer package must refuse, not best-effort read.
    expect(() => migrate(doc, futureVersion)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, futureVersion)).toThrow(/newer than this package.*refusing to read/);
  });

  it("rejects a fromVersion that disagrees with the stored schema_version", () => {
    const doc = mint({ nodes: [], links: [] }, loadCatalog());
    metaMap(doc).set("schema_version", SCHEMA_VERSION + 1);

    // The stored version and the caller's fromVersion must agree, or the read
    // is ambiguous and must fail closed.
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(SchemaVersionError);
    expect(() => migrate(doc, SCHEMA_VERSION)).toThrow(/does not match fromVersion/);
  });
});
