---
type: llm
focus: last_message
---

PASS if the final message tells the designer the pull request is merged, in plain language, and says what happens next (the site updates after the deploy).
FAIL if it says the pull request is still waiting, queued, or blocked, or if it never states the outcome, or if it reports merged without having run the merge command.
