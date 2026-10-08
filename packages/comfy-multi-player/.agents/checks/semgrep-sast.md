# Semgrep SAST

Run Semgrep static analysis on changed TypeScript/JavaScript files to catch dangerous patterns and injection-class bugs.

## Steps

1. Probe: `semgrep --version`. If not installed, skip and report: "Skipped: semgrep not installed (`pip3 install semgrep`)".
2. Identify changed `.ts`/`.js` files from the diff. If none, skip and report: "Skipped: no changed JS/TS files."
3. Run:
   ```bash
   semgrep --config=auto --json --quiet <changed_files>
   ```
4. Parse `.results[]`. Map `ERROR`→critical, `WARNING`→major, `INFO`→minor. Report the `check_id`, `path:start.line`, `extra.message`, and `extra.fix` if present.

## Repo-specific emphasis

- This package has no DOM, network, exec, filesystem, or deserialization surface, so most web-app rules will not fire. Prioritize any finding about unsafe dynamic evaluation, prototype pollution, or insecure randomness — the last matters because ID minting must stay collision-free without coordination (KA-5). A weak-randomness finding on the mint path is a real correctness concern, not just a style nit.
- Treat any injection/exec/network finding as a signal that non-pure code has leaked into the op layer (FC-3); cross-check against `check:purity`.

## Error handling

- If the config download fails, skip and report. Skip un-parseable files and continue.
- Non-vacuousness: `--config=auto` fetches its rules over the network, so an empty `.results[]` may mean "no rules ran" rather than "nothing found". Before reporting anything, check `.paths.scanned` is non-empty and `.errors[]` is empty. **Zero files scanned is INCONCLUSIVE, not clean.** Report "No issues found (<n> files scanned)" — always with the count — and only after a run that actually scanned files.
  - `.paths.scanned` is the reliable signal because it collapses both failure modes (verified on semgrep 1.174.0): a config that loads but contributes zero rules exits `0` with `results = 0` **and `paths.scanned = 0`**, even though real files were passed on the command line — semgrep does not scan a file no rule targets. A *total* rule-fetch failure is loud on this version (exit `2`, no JSON at all), but do not rely on that: a stale cache or a partial fetch is not guaranteed to be, and the `paths.scanned` check costs nothing.
  - Findings do not change the exit code: a run with results still exits `0`. Read `.results[]`, never the exit status, for the verdict.

> Before reporting PASS for any check above, apply [vacuity.md](vacuity.md): P0 to every check, P1 to any guard this change adds, P10 to what that guard's test asserts on, P2 to any tool you ran, and P7 to any run you quote.
