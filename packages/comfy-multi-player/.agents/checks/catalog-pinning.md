# Catalog pinning review

Apply this profile to catalog metadata, minting, widget writes, fixtures, and provenance. It protects KA-12 and FC-10.

- Require `meta.catalog_version` to identify the catalog with an immutable sha256, never a branch, tag, or other moving reference.
- Verify mint records the exact catalog used to interpret positional widget values.
- Fail closed and loudly when a widget write targets an uncatalogued class. Do not guess widget order or silently use current defaults.
- Require fixture/conformance generators to record repository URL, immutable commit SHA, exact command, and environment; regeneration should diff in CI when #23 lands.
- Flag any moving vocabulary/catalog citation as blocking, including examples that agents may copy.
- Require every cross-repository citation to name a commit registered in `docs/upstream-pins.json`, and require the registry entry to record the derivation that established that SHA. "Pinned to whatever upstream HEAD was that day" is an unverified claim that the citation is accurate, not a resolution — treat an `established_by` that does not say how the revision was determined as blocking.
<!-- claim: "established_by" :: docs/upstream-pins.json -->
<!-- claim: established_by must record HOW this SHA was resolved :: scripts/check-pins.mjs -->
- Treat moving a pin as a contract change, not a refresh: it needs the cited sections re-read, the applier reconciled, and the registry plus every `cited_by` site moved in the same change. `npm run check:pins` fails if they diverge.
<!-- claim: "check:pins": "node scripts/check-pins.mjs" :: package.json -->
<!-- claim: the citation and the registry have drifted apart :: scripts/check-pins.mjs -->
- Section and line references into an upstream file are only meaningful against a pin. Prefer symbol or section names to line numbers, and check that the anchor still exists at the pinned revision (`npm run check:pins -- --verify-remote` checks Markdown headings and Python definitions; it does not check line numbers, which is why line numbers are not an acceptable citation).
<!-- claim: has no ${anchor.what} in ${pin.path} :: scripts/check-pins.mjs -->
- A citation that wraps across lines is still one citation. The lint joins continuation lines before matching, because `(branch` and the branch name routinely land on separate lines; a per-line rule here caught one of the three citations that motivated it.
<!-- claim: const WINDOW_LINES = 3 :: scripts/check-pins.mjs -->
