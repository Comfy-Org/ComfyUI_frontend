# ADR-AGENT-ERRORS-0059: Error reports reach the agent as files, not prompt text

Date: 2026-11-24

## Status

Accepted

## Context

The "Ask agent" handoff formats the error into the message it sends. That text
is capped because it is prose inside a prompt: forty problems, 1,500 characters
of detail each, 500 characters per single-line field. Server logs, system stats,
the serialized workflow and the account's plan limits are not in it at all.

A user reported the consequence: the agent received a smaller error than the
Issues panel showed, and the reason their run stopped, the maximum runtime on
their account, never reached it. The two surfaces read from different sources
and the chat is always the poorer one.

Raising the caps is not a fix. A prompt is the wrong container for a 200 KB
report, and every raised cap costs tokens on every ask whether the agent needs
that detail or not.

Three report builders exist and disagree. The CRDT debug report escapes code
fences by measuring the longest backtick run in the content, redacts secrets
recursively by key shape at every depth, redacts launch arguments and
path-shaped values, truncates without splitting a surrogate pair, and collects
each source independently so a dead backend degrades to a note rather than
losing the report. The error dialog's builder has none of that. The agent's
formatter has a third, weaker set.

## Decision

The handoff attaches the full report as a readable file and references it. The
message keeps a one-line summary per problem so the agent has the shape without
a tool call, and so a person reading their own history can see what they asked
about. The file carries the depth.

No new transport is built. `zAgentReadableAttachmentExtension` already covers
`.md`, `.txt`, `.json`, `.log` and `.yaml`; `attachableFiles.ts` already maps
those to a `read` capability; the composer already uploads through the
`/api/upload/image` endpoint; `MediaKind` already includes `text`. The
composer uses the server's upload limit, falling back to 20 MiB, and a full
report caps around 256 KB. Above that cap, the existing builder
(`truncateReport` in `crdtDebugReport.ts`) keeps the head and tail of the
joined report and drops the middle, inserting a truncation marker between
them. That is unchanged by this decision. A problem "arrives whole" only
while the joined report stays under the cap; a report that is already over
it can still lose a problem's detail, including a plan-limit explanation, if
that problem's section falls in the removed middle.

The three builders consolidate onto the strongest implementation, and that
consolidation lands before or with the attachment change rather than after it.
The plan-limit explanation that prompted this ADR lives in
`ErrorItem.displayMessage`, populated by
`resolveRunErrorMessage` from the runtime error catalog, not in
`CrdtDebugReportInput.workflowError` (currently set only by the dev panel). The
consolidation must add that field to the CRDT builder's input and populate it
from the Issues panel's resolved error, or the "arrives whole" promise does not
hold for the case this ADR exists to fix.

The CRDT builder's workflow section serializes the workflow verbatim with no
redaction, so an embedded API key would appear as written. The current
handoff does not include workflow JSON, so this is latent today, but
consolidating onto this builder must not inherit it: workflow redaction, or
explicit user consent at upload time, is a precondition for including the
workflow section in an auto-attached report, not a follow-up.

**Settings are excluded from automatic upload until the user reviews and
explicitly agrees, per setting, to share them.** The report's key-shape
redactor replaces values under recognized credential-like keys at every
depth, but a custom node that names a secret something else, `serviceCode`
rather than `apiKey`, reaches the report unredacted. A warning banner next to
a value that has already left the browser does not give the user a chance to
withhold it, so the banner documents the residual risk without closing it.
Unlike the workflow section above, redaction is not an accepted alternative
here: the same incomplete key-shape gap applies to settings, so per-setting
review and consent is the only precondition for including a setting in an
auto-attached report, not a follow-up.

**Server logs are opt-in, not attached by default.** Nobody objected during the
comment window, so this is the author's call rather than a ratified one, and the
reasoning is recorded here so it can be overturned cheaply:

- Logs echo filesystem paths and occasionally tokens. An attached report puts
  those values in an uploaded file instead of the visible message, so the user
  must be able to review them before sharing.
- Whole-value redaction cannot be applied to logs. A ComfyUI log almost always
  contains its own `http://127.0.0.1:8188`, and the path-and-URL redactor would
  collapse the entire log to a marker. Redaction must be chosen per section,
  which means logs carry more residual risk than the other sections.
- The reported failure does not need them. The plan-limit reason lives in the
  error explanation, not the log, so a default-off report still fixes the case
  that prompted this.

## Consequences

The agent sees what the Issues panel sees. While the joined report stays under
the 256 KB cap, a problem with a long traceback, a large workflow, or a
plan-limit explanation arrives whole, and the agent reads the part it needs
rather than being handed a truncation of the whole. Past the cap, the same
head-and-tail truncation as today applies, so a problem can still arrive
partial or missing if its section falls in the removed middle; sections in
the retained head or tail are unaffected. A serialized workflow over 200,000
characters is replaced with an omission marker before the report is joined,
so staying under the 256 KB cap does not guarantee the workflow arrived
whole; a workflow that must arrive whole needs a separate file attachment.

More data leaves the browser than before, which is why redaction consolidation
is a precondition and not a follow-up.

Attaching a file per ask creates assets. Whether those persist in the user's
asset library or are scoped to the turn is unresolved and tracked separately;
either is defensible, but one is clutter.

A reader of a chat transcript can no longer see the full error inline. The
one-line summaries are what keeps the transcript legible, so they are part of
the decision rather than a leftover of the old design.

## Alternatives considered

**Raise the caps.** Rejected: it trades a truncation bug for a token cost on
every ask, and does not reach logs or workflow JSON at any cap worth paying for.

**Dump the whole report into the message.** Considered and rejected in the
originating discussion. It wastes context on detail the agent may not need and
makes the transcript unreadable.

**Build a report-reading tool and a report domain entity.** Rejected as
inventing an API to emulate file reading the agent already does well, and the
readable-attachment tier already exists.

**Attach logs by default.** The stronger position for fixing reports in one
step, and the weaker one for privacy. Revisit if support finds the opt-in rate
too low to diagnose from.

## References

- Design, socialized 2026-11-20 with a comment window to 2026-11-21:
  [Ask agent on errors: hand the agent a file, not a summary](https://app.notion.com/p/Ask-agent-on-errors-hand-the-agent-a-file-not-a-summary-41e6d73d365081209d24e7d382ad3200)
- Originating report and the decision to use a file:
  [#epd-agent thread](https://comfy-organization.slack.com/archives/C0A8Z4U7Y1K/p1795061530550689)
- Tracking: [BE-27149](https://linear.app/comfyorg/issue/BE-27149/attach-full-error-reports-as-files-for-ask-agent)
- The handoff this changes: [#21176](https://github.com/Comfy-Org/ComfyUI_frontend/pull/21176)
- Shared error vocabulary, complementary and separate:
  [BE-27004](https://linear.app/comfyorg/issue/BE-27004)
