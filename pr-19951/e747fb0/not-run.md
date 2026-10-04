# webbreaker coverage list for head `e747fb0`

## Not run (2)

| Cell | Surface | Reason | Id |
|---|---|---|---|
| Changed modules that no page reaches | website routes | No page imports these changed modules at runtime, so no sweep covers them: `apps/website/src/content/customers.schema.ts`. | `9db6ae92e735` |
| Vision judgement not run on some findings | PR #19951 | vision not run on 5 finding(s) (Element cut at the page edge on /customers/; Element cut at the page edge on /zh-CN/customers/; Dialog does not work with the keyboard on /customers/hakoniwa-yui/; Console error on /customers/hakoniwa-yui/): the mechanical oracle already decided; vision judges collateral pixel changes only. vision not run on 2 finding(s) (Pixels changed on /customers/hakoniwa-yui/, component not mapped; Pixels changed on /zh-CN/customers/hakoniwa-yui/, component not mapped): the pixel change was not reproduced, so it is not a failure | `4c7b45d5c62f` |

## Info and pre-existing (0)

| Finding | Oracle | Result | Regression | Id |
|---|---|---|---|---|
