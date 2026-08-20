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

- If the config download fails, skip and report. Skip un-parseable files and continue. If no findings, report "No issues found."
