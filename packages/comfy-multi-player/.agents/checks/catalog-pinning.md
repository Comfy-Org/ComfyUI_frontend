# Catalog pinning review

Apply this profile to catalog metadata, minting, widget writes, fixtures, and provenance. It protects KA-12 and FC-10.

- Require `meta.catalog_version` to identify the catalog with an immutable sha256, never a branch, tag, or other moving reference.
- Verify mint records the exact catalog used to interpret positional widget values.
- Fail closed and loudly when a widget write targets an uncatalogued class. Do not guess widget order or silently use current defaults.
- Require fixture/conformance generators to record repository URL, immutable commit SHA, exact command, and environment; regeneration should diff in CI when #23 lands.
- Flag any moving vocabulary/catalog citation as blocking, including examples that agents may copy.
