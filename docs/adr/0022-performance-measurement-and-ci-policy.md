# 22. Performance Measurement and CI Policy

Date: 2026-08-26

## Status

Proposed

## Context

Frontend performance has correctness-like properties (for example, one
progress event should not cause an unrelated background redraw) and
distributional properties (for example, frame intervals vary with the browser,
GPU, display, and host load). Treating both kinds as a single FPS number makes
the signal unreliable.

The previous performance helper illustrated this failure mode: it sampled
`requestAnimationFrame` after the measured workload had stopped, so the frame
distribution described the idle tail rather than the workload. A busy-loop
positive control exposed the error. The replacement developed in
[#15997](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15997) samples inside
aligned workload boundaries, retains raw intervals, reports percentiles and
threshold buckets, records rejection reasons, and prevents comparisons across
incompatible schema versions. The CDP accounting work in
[#16016](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16016) also shows why
missing metrics must remain missing: `TaskOtherDuration` is a broad residual,
not proof of native work, and unsupported counters must not be fabricated as
zero.

The Alexis performance investigation found another important boundary. A long
DevTools recording contained 350–726 ms CPU-active renderer tasks but could not
name the native routine responsible. Screenshots, memory instrumentation, CPU
sampling, tracing, and DevTools itself can perturb the page. Diagnostic traces
can explain a regression, but their timings are not interchangeable with an
unprofiled benchmark.

Performance CI therefore needs two systems with different contracts:

- deterministic PR gates that detect behavioral complexity regressions; and
- repeated distribution benchmarks that detect timing regressions under a
  controlled identity.

Diagnostic captures are an incident-response tool outside those two CI
systems. They explain regressions but do not produce gate or benchmark samples.

## Decision

We will separate deterministic performance gates, distribution benchmarks, and
diagnostic captures. A result is comparable only when its measurement schema,
scenario, workload denominators, and execution identity match.

### Deterministic PR gates

Required PR checks should prefer exact, low-noise invariants that fail for a
known bad implementation and pass for its treatment. Examples include:

- foreground and background draws per confirmed progress event;
- geometry refreshes and changed writes per node draw;
- render-order builds and graph traversals per canvas pass;
- style and layout counts for a deterministic interaction; and
- observer, listener, timer, or widget instances remaining after cleanup.

Every gate must assert that the intended workload occurred. Counts are divided
by confirmed denominators such as events received and applied, visible nodes,
links traversed, frames sampled, or interactions completed. A sent event is not
assumed to have been received. Setup and teardown are outside the measurement
window.

A gate must include a positive control or historical treatment proving that the
instrumentation detects the targeted regression. Exact-count budgets can block
PRs once stabilized. Host-sensitive timing does not become a blocking PR gate
only because it has a numerical threshold.

### Distribution benchmarks

Timing scenarios collect raw in-window `requestAnimationFrame` intervals from
aligned start and stop boundary frames. Reports include sample count, p50, p95,
p99, maximum, and counts and percentages above 8.33, 16.67, 33.3, and 50 ms.
These are interval thresholds, not claims of dropped frames unless the actual
display refresh rate and presentation data support that interpretation.

This is the contract for the future versioned schema introduced below. The
current advisory lane persists only mean and p95 after removing raw intervals;
it does not satisfy this distribution contract and cannot be promoted to a
timing gate until the schema rollout is complete.

At 60 Hz the entire browser frame budget is 16.67 ms; at 120 Hz it is 8.33 ms;
at 144 Hz it is 6.94 ms. Application JavaScript must leave time for style,
layout, paint, raster, and composition. We will therefore use
scenario-specific budgets rather than a global FPS target:

| Scenario            | Primary budget                                                       | Supporting metrics                                           |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Idle                | zero unexplained steady-state draws; bounded style/layout per second | renderer task occupancy                                      |
| Job progress        | draws and changed writes per confirmed event                         | interval distribution and task time per event                |
| Pan, zoom, drag     | percentage of intervals over the display budget and p99              | script, style/layout, paint, and thread time per interaction |
| Link topology       | traversals or facade reads per visible slot/link and scaling slope   | script time per draw                                         |
| DOM widgets         | changed layout writes and observer callbacks per changed widget      | style/layout counts and long-animation-frame blocking time   |
| Subgraph transition | mounts and traversals per transition                                 | interval distribution and transition blocking time           |
| 3D or preview       | interval distribution within a named renderer/GPU cell               | main-thread, compositor, and GPU evidence kept separate      |

The concrete numerical budget for a timing scenario is versioned with that
scenario after a shadow period. It must state an absolute practical effect and
a relative change, use enough accepted repetitions to estimate variability,
and compare running-minus-idle where applicable. Repetitions are randomized or
interleaved (for example, ABBA), and builds run sequentially on the same host.
Means alone do not gate; a comparison uses distributions and uncertainty.

### Measurement identity and artifacts

Each result records at least:

- performance schema and scenario versions;
- frontend commit and build hash, browser and Playwright versions;
- operating system, runner image, CPU architecture, GPU/driver/ANGLE mode;
- headless/headful mode, viewport, device pixel ratio, zoom, and display rate
  when available;
- renderer and feature-flag state;
- workflow/fixture hash, node/link/widget/visible-node counts;
- extension names, versions or content hashes, and active/inactive state;
- expected, emitted, received, and applied workload counts; and
- accepted/rejected status with a machine-readable reason.

This is the target contract for a future identity-complete schema epoch, not
the acceptance contract of the current performance lane. The report on `main`
records only timestamp, commit, branch, and measurements; the versioned schema
being introduced in [#15997](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15997)
adds `schemaVersion` but not the rest of the identity above. Those reports may
continue to populate the advisory `perf-data` history during rollout, but they
must not be described as identity-complete, compared as a policy-compliant
epoch, or promoted to a merge or release timing gate.

The rollout is complete only when the report schema and writer record the
required identity, reject incomplete identity before upload or baseline
persistence, and the comparison path refuses incompatible epochs. Until all
three boundaries are enforced, the existing workflow and `perf-data` branch are
explicitly the legacy advisory lane.

Raw intervals, counters, and metadata are the evidence of record. PR comments
contain bounded summaries and links to artifacts. Schema changes, browser or
runner changes, renderer-default changes, and fixture hash changes start a new
history epoch; incompatible epochs are never silently compared. Optional
metrics remain `null` or absent and are listed as missing. Counter resets and
non-monotonic values reject the affected metric or run rather than becoming
zero.

### Controls, noise, and rejection

Every timing suite includes a quiet negative control and a known blocking
positive control. Scenario-specific controls prove delivery, rendering, layout,
or cleanup instrumentation as appropriate. A suite is incomplete when an
expected control or scenario is missing.

Runs are rejected, with their raw identity and reason retained, when visibility
changes, timestamps are invalid, expected workload counts differ, identity is
incomplete, the browser crashes, the profiler configuration differs, or a
predeclared host-noise limit is exceeded. We do not discard valid slow runs as
outliers, retry until green, or add repetitions to hide systematic contention.
Changed performance is first reported in shadow mode and promoted to a gate
only after the controls, variability, practical threshold, and ownership are
reviewed.

### CI tiers and diagnostics

The CI tiers are:

1. **PR:** deterministic invariant checks and a small headless sentinel matrix.
2. **Scheduled:** repeated distribution benchmarks on stable, pinned runners;
   broader topology, renderer, extension, DPR, and workload matrices.
3. **Release canary:** representative headful hardware-GPU scenarios on stable
   machines, kept in a separate history from headless or software-rendered
   results.
4. **Diagnostic:** bounded traces or native profiles triggered by a regression,
   never used as benchmark samples.

Headful/native-GPU, headless, and software-rendered histories do not mix.
Scheduled and release results are initially advisory; promotion to a release
gate requires demonstrated control sensitivity and stable runner variance.

Diagnostic escalation follows
[the performance incident runbook](../guidance/performance-incident-runbook.md).
Trace capture is short, bounded, and excludes screenshots, memory, network
payloads, and native sampling unless each is the isolated question. JavaScript,
GC, style/layout, paint, compositor, GPU, and residual time are reported without
double-counting nested or overlapping slices. Unattributed time is not assigned
to native code, Canvas, ECS, Vue, an extension, or the GPU without the required
stacks or counters.

### Privacy and retention

Fixtures and shared captures must contain no prompts, credentials, private
workflow contents, network payloads, screenshots, or unrelated application
data. Use opaque graph and capture identifiers. Native traces may contain paths,
process metadata, window titles, and sampled stacks and therefore remain in an
approved restricted channel.

The live CI guarantee is 30 days for uploaded raw metric artifacts and the
latest 20 snapshots on the `perf-data` branch. This ADR does not extend either
guarantee. Identity-complete scheduled and release lanes target 90-day raw
metric retention, but that requirement takes effect only after their workflow
uses date-based retention and storage sized for that window. Regression-only
bounded browser traces are retained for 14–30 days. A longer-lived report may
retain aggregates, hashes, decisions, and links, but not sensitive raw captures.
Organization retention policy overrides these maxima.

## Alternatives Considered

- **Gate on average FPS in every PR** — Rejected because averages hide tail
  frames, refresh rate changes their meaning, and shared CI timing is noisy.
- **Use post-workload frame sampling** — Rejected because it measures recovery
  or idle behavior instead of the workload.
- **Use one large DevTools trace for every run** — Rejected because it is slow,
  storage-heavy, privacy-sensitive, and can create or amplify the behavior being
  measured.
- **Use only deterministic operation counts** — Rejected because exact counts
  can prevent known complexity regressions but cannot detect expensive native,
  paint, compositor, GPU, or environment-specific work.
- **Use only scheduled timing benchmarks** — Rejected because actionable
  correctness-like regressions should fail at the introducing PR, not wait for
  a noisy nightly result.
- **Merge headless and hardware-GPU history** — Rejected because they exercise
  different rendering paths and would turn environment changes into apparent
  product changes.
- **Treat missing CDP counters as zero or residual task time as native time** —
  Rejected because both fabricate attribution that the instrumentation did not
  provide.

## Consequences

### Positive

- PR gates become fast, causal, and resistant to host timing noise.
- Timing results describe the workload window and retain enough raw evidence to
  audit percentile and threshold calculations.
- Identity epochs prevent false before/after comparisons across harness or
  environment changes.
- Headful/GPU canaries cover behavior that headless CI cannot reproduce.
- Diagnostic escalation can explain a regression without contaminating its
  baseline or creating unbounded artifacts.

### Negative

- The suite and report schema are more complex than a single FPS score.
- Scheduled and hardware-GPU lanes require stable infrastructure, ownership,
  storage, and periodic calibration.
- New schema, fixture, browser, or environment versions intentionally break
  historical continuity.
- Repetition and interleaving increase scheduled runtime.
- Some timing regressions remain advisory until variance and practical budgets
  are established; deterministic gates cannot cover every bottleneck.
- Privacy review and short retention make raw diagnostic evidence less
  convenient to revisit later.

## Notes

This ADR defines the measurement contract. It does not accept the implementation
in either linked pull request, set final numerical timing thresholds, or claim
that a green synthetic suite excludes platform-specific native stalls.
