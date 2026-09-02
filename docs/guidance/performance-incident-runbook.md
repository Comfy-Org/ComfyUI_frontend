# Frontend performance incident runbook

Use this runbook for frame drops, input latency, long tasks, unexpected redraws,
or browser crashes suspected to be performance-related. Start with cheap,
unprofiled evidence. Escalate only when the previous stage reproduces the issue.

## 1. Record identity and define the symptom

Before recording, write down:

- frontend commit/version and build hash; backend version;
- browser/version, OS, CPU, GPU/driver/ANGLE mode, hardware acceleration;
- headful/headless, viewport, DPR, browser zoom, display scale/rate, power mode;
- renderer and relevant feature flags;
- workflow hash plus node, visible-node, link, widget, and subgraph counts;
- extension names and versions/content hashes, including whether each feature is
  merely loaded or actively exercised;
- 3D/preview state: absent, hidden, frozen, or updating; and
- exact workload duration and expected/emitted/received/applied event counts.

Describe a measurable symptom, such as “p99 frame interval rises during 10 Hz
progress delivery” or “one event causes a background draw.” Do not use “slow” or
average FPS as the only acceptance criterion.

## 2. Run a lightweight reproduction

Use a fresh browser profile and a sanitized workflow. Close unrelated tabs and
applications that may expose private data or contend for the machine. Keep
DevTools closed.

Warm up first. Then collect in-page rAF intervals and Long Animation Frame (or
long-task fallback) entries entirely inside a short, fixed workload window.
Retain raw intervals, marks, counts, and identity. Run builds sequentially, not
in parallel.

Include these controls:

1. quiet/idle negative control;
2. known blocking positive control (for example, a bounded 100 ms busy loop);
3. workload with progress delivery disabled;
4. core-only, extension-loaded-inactive, and extension-active arms; and
5. matched renderer/3D arms when relevant.

Use at least two warm-ups and interleave repeated comparisons (ABBA or BAAB).
Reject rather than retry-away runs with visibility changes, missing denominators,
browser crashes, identity drift, non-monotonic timestamps, or excessive host
load. Preserve the rejection reason.

Stop here when exact counters identify a source-level regression. Create a
minimal red/green test and fix it without collecting a large trace.

## 3. Add bounded browser diagnostics

When the lightweight run reproduces but does not attribute the cost:

- First collect scalar CDP counters in a separate arm: task/script/style/layout,
  thread/process CPU, and supported residual categories.
- Then collect a 3–5 second trace around the reproduced window.
- Disable Memory, screenshots, network payload capture, and heap dumps.
- Use only the timeline/frame/layout/paint categories needed for the hypothesis.
- Stream trace output through a size-limited compressor when supported. Enforce
  raw and compressed byte limits during capture, abort and clean up partial
  output when either limit is reached, and retain the 32 MiB compressed artifact
  cap. Stop instead of extending the recording.

Never load a giant trace as one JSON object. Check size and free disk first;
inventory it with bounded streaming passes (`jq --stream`, an incremental JSON
parser, or equivalent) and retain only identifiers and intervals needed for the
next pass. Do not copy the raw trace into multiple temporary files.

Partition renderer-main time into disjoint JavaScript self time, GC,
style/layout, paint/prepaint/layer work, and residual. Report compositor and GPU
lanes separately because they overlap main-thread wall time. Inclusive stacks
help find callers but must not be summed as exclusive time.

## 4. Test profiler perturbation

Tracing is an intervention. Compare the same cell with:

1. in-page observer only;
2. scalar CDP metrics;
3. minimal trace without CPU sampling; and
4. CPU sampling in its own explanatory run.

Add screenshots, Memory, invalidation tracking, or another expensive feature
one at a time only when it is the question being tested. If the tail appears
only after instrumentation, report profiler interaction as the leading result;
do not use that run as the baseline.

## 5. Escalate to native stacks only when required

Use OS/native sampling when renderer tasks remain CPU-active but browser traces
cannot name the work. Capture the exact renderer PID and short workload marks.
On Windows, prefer an 8-second WPR CPU sample in memory mode; require at least 2
GiB free space and never use unbounded file mode. Add GPU providers only after
CPU stacks implicate graphics or remain unresolved.

Native captures can contain paths, process metadata, window titles, and sampled
stacks. Use a sanitized profile, review metadata, hash the artifact, keep it in
an approved private channel, and do not upload a raw capture above 512 MiB.
Report symbol coverage. Without usable symbols, module-level attribution is the
maximum defensible conclusion.

Stop escalation after two accepted captures reproduce the tail with attributable
stacks. “Did not reproduce” is a result, not permission to record indefinitely.

## 6. Clean up

- Disconnect observers and restore wrapped methods/listeners in `finally`.
- Stop tracing and verify no CDP/native recording remains active.
- Close the disposable browser profile and stop investigation servers.
- Treat CI raw metrics as available for 30 days and `perf-data` history as the
  latest 20 baselines. Export approved incident evidence before those limits
  when a longer investigation requires it. Keep bounded regression traces for
  14–30 days unless policy requires less.
- Keep restricted native evidence only until hash/import confirmation and the
  approved retention deadline. Never delete the only accepted copy before the
  recipient confirms it opens.
- Record rejected captures and cleanup status in the handoff.

## Handoff template

```markdown
### Performance incident handoff

- Symptom and user-visible threshold:
- First known bad / last known good:
- Accepted and rejected runs (with reasons):
- Build/browser/OS/GPU/display identity:
- Workflow and extension hashes; graph denominators:
- Workload expected/emitted/received/applied counts:
- Controls and whether each was sensitive:
- Raw rAF distribution and exact operation counts:
- CDP/trace/native instrumentation used (separate arms):
- Disjoint attribution; unresolved residual:
- Profiler perturbation comparison:
- Leading hypothesis and falsifier:
- Minimal red/green test or next bounded experiment:
- Artifact hashes, access location, retention deadline:
- Cleanup verified by:
```

See [ADR-PERF](../adr/PERF-performance-evidence-and-regression-framework.md) for the
measurement and CI policy behind this procedure.
