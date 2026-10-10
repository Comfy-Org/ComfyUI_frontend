---
type: llm
focus: last_message
---

PASS if the final message asks the designer which pull request they mean (a number or a link) and asks nothing else.
FAIL if it picks a pull request on its own, runs commands against one, asks several questions, or claims to have fixed anything.
