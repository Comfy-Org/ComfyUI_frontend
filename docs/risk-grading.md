# PR Risk Grading

Every PR is graded `R0` (safest) to `R3` (riskiest) by an advisory grader and
carries exactly one `risk:*` label. Nothing gates, routes, or merges on the
label — it is a shadow signal while the map calibrates.

## How a grade is computed

`grade = worst(path floor, provenance, reversibility)` — each axis proposes a
tier independently and the worst wins, so no axis can move a PR into a safer
lane than another axis put it.

- **Path floor** — the worst tier over every rule in
  [`.github/risk.json`](../.github/risk.json) that any changed path matches
  (renames are graded under both the old and new path).
- **Provenance** — human-authored PRs floor at R1; external/fork PRs at R3;
  only runbook-automated PRs can reach R0.
- **Reversibility** — no green check rollup floors at R2; green checks but no
  test file touched floors at R1.

## Representative tiers

| Tier      | Example                                                        |
| --------- | -------------------------------------------------------------- |
| `risk:R0` | Automated locale sync touching only `src/locales/**`           |
| `risk:R1` | Component tweak with updated tests and green CI                |
| `risk:R2` | Editing `src/stores/**`, `src/services/**`, or flag defaults   |
| `risk:R3` | Lockfile bumps, auth/billing, LGraph entity surface, workflows |

## Disputing a grade

Add the human-owned `risk-dispute` label (the grader never touches it) plus a
comment saying why. Disputes are the calibration data for revising the map.

## Changing the rules

The grader reads `.github/risk.json` from the PR's **base** ref, so a PR
cannot edit the rules that judge it. Map changes take effect after merge and
are themselves graded R3 (`risk-map` class).
