# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 20043-tp1.spec.ts >> TP1-R1-A2 >> [TP1-R1-A2] Workflows tab leads to /hub/workflows/ (R1, A2)
- Location: e2e/qa/20043-tp1.spec.ts:515:5

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('catalogue-tab-workflows')
Expected: "/hub/workflows/"
Received: "/hub/apps/"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" getByTestId('catalogue-tab-workflows') with timeout 5000ms
  - waiting for getByTestId('catalogue-tab-workflows')
    14 × locator resolved to <a href="/hub/apps/" data-testid="catalogue-tab-workflows" class="relative inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-5 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-out outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 motion-reduce:transition-none max-sm:px-3 text-content-secondary hover:text-content-bright">Workflows</a>
       - unexpected value "/hub/apps/"

```

```yaml
- link "Workflows":
  - /url: /hub/apps/
```

# Test source

```ts
  73  |     ...extra
  74  |   }
  75  | }
  76  | 
  77  | // env: engine viewport input theme motion locale
  78  | const rows: Row[] = [
  79  |   r('TP1-R1-S1', 'R1', 'S1', 'chromium 320x568 mouse dark normal zh'),
  80  |   r('TP1-R1-S2', 'R1', 'S2', 'webkit 390x844 touch light reduce en'),
  81  |   r('TP1-R1-S3', 'R1', 'S3', 'chromium 768x1024 touch dark normal en'),
  82  |   r('TP1-R1-S5', 'R1', 'S5', 'webkit 1920x1080 mouse dark reduce zh'),
  83  |   r('TP1-R1-S6', 'R1', 'S6', 'chromium 1536x864 mouse light normal zh'),
  84  |   r('TP1-R1-S8', 'R1', 'S8', 'chromium 1280x800 mouse dark reduce en'),
  85  |   r('TP1-R1-I1', 'R1', 'I1', 'webkit 768x1024 mouse light normal zh', {
  86  |     reach: 'populated',
  87  |     events: ['go-offline']
  88  |   }),
  89  |   r('TP1-R1-I2', 'R1', 'I2', 'chromium 390x844 touch dark normal zh'),
  90  |   r('TP1-R1-I3', 'R1', 'I3', 'webkit 320x568 mouse light reduce en'),
  91  |   r('TP1-R1-I5', 'R1', 'I5', 'webkit 1280x800 mouse light normal zh'),
  92  |   r('TP1-R1-I8', 'R1', 'I8', 'webkit 1536x864 mouse dark reduce en'),
  93  |   r('TP1-R1-I9', 'R1', 'I9', 'chromium 1920x1080 mouse light normal en'),
  94  |   r('TP1-R1-A1', 'R1', 'A1', 'webkit 768x1024 touch dark reduce zh'),
  95  |   r('TP1-R1-A2', 'R1', 'A2', 'chromium 390x844 mouse dark reduce zh'),
  96  |   r('TP1-R1-A3', 'R1', 'A3', 'chromium 320x568 touch dark normal zh'),
  97  |   r('TP1-R1-A5', 'R1', 'A5', 'chromium 320x568 mouse dark normal zh'),
  98  |   r('TP1-R1-V2', 'R1', 'V2', 'webkit 390x844 touch light reduce en'),
  99  |   r('TP1-R1-V3', 'R1', 'V3', 'chromium 768x1024 touch dark normal en'),
  100 |   r('TP1-R1-iOS4', 'R1', 'iOS4', 'webkit 390x844 touch light reduce en'),
  101 |   r('TP1-R2-S6', 'R2', 'S6', 'chromium 1536x864 mouse light normal zh'),
  102 |   r('TP1-R3-S6', 'R3', 'S6', 'chromium 1280x800 mouse dark reduce en'),
  103 |   r('TP1-R5-S6', 'R5', 'S6', 'webkit 768x1024 mouse light normal zh', {
  104 |     reach: 'populated',
  105 |     events: ['back']
  106 |   }),
  107 |   r('TP1-R6-S6', 'R6', 'S6', 'chromium 390x844 touch dark normal zh', {
  108 |     reach: 'populated',
  109 |     events: ['back', 'forward']
  110 |   }),
  111 |   r('TP1-R7-S6', 'R7', 'S6', 'webkit 320x568 mouse light reduce en'),
  112 |   r('TP1-R12-S6', 'R12', 'S6', 'webkit 1280x800 mouse light normal zh'),
  113 |   r('TP1-R14-S6', 'R14', 'S6', 'webkit 1536x864 mouse dark reduce en'),
  114 |   r('TP1-R15-S6', 'R15', 'S6', 'chromium 1920x1080 mouse light normal en'),
  115 |   r('TP1-R17-S6', 'R17', 'S6', 'webkit 768x1024 touch dark reduce zh'),
  116 |   r('TP1-R18-S6', 'R18', 'S6', 'chromium 390x844 mouse dark reduce zh'),
  117 |   r('TP1-R25-S6', 'R25', 'S6', 'chromium 320x568 touch dark normal zh'),
  118 |   r('TP1-R4-S6-s6', 'R4', 'S6', 'chromium 1280x800 mouse dark reduce en', {
  119 |     reach: 'populated',
  120 |     events: ['reload']
  121 |   }),
  122 |   r('TP1-R17-I5-s10', 'R17', 'I5', 'webkit 1280x800 mouse light normal zh', {
  123 |     reach: 'populated',
  124 |     events: ['hide-resume']
  125 |   }),
  126 |   r('TP1-R1-I1-s16', 'R1', 'I1', 'chromium 320x568 mouse dark normal zh', {
  127 |     reach: 'offline',
  128 |     events: ['go-online']
  129 |   }),
  130 |   r('TP1-R4-S6-s17', 'R4', 'S6', 'webkit 390x844 touch light reduce en', {
  131 |     reach: 'stale',
  132 |     events: ['reload']
  133 |   }),
  134 |   r('TP1-R1-I1-s18', 'R1', 'I1', 'chromium 768x1024 touch dark normal en', {
  135 |     reach: 'stale',
  136 |     events: ['go-offline']
  137 |   }),
  138 |   r('TP1-R5-S6-s19', 'R5', 'S6', 'webkit 1920x1080 mouse dark reduce zh', {
  139 |     reach: 'stale',
  140 |     events: ['back']
  141 |   }),
  142 |   r('TP1-R6-S6-s20', 'R6', 'S6', 'chromium 1536x864 mouse light normal zh', {
  143 |     reach: 'stale',
  144 |     events: ['back', 'forward']
  145 |   }),
  146 |   r('TP1-R17-I5-s21', 'R17', 'I5', 'chromium 1280x800 mouse dark reduce en', {
  147 |     reach: 'stale',
  148 |     events: ['hide-resume']
  149 |   }),
  150 |   r('TP1-R5-S6-s61', 'R5', 'S6', 'webkit 768x1024 mouse light normal zh', {
  151 |     reach: 'populated',
  152 |     events: ['back', 'reload']
  153 |   }),
  154 |   r('TP1-R5-S6-s62', 'R5', 'S6', 'chromium 390x844 touch dark normal zh', {
  155 |     reach: 'populated',
  156 |     events: ['back', 'go-offline']
  157 |   }),
  158 |   r('TP1-R6-S6-s63', 'R6', 'S6', 'webkit 320x568 mouse light reduce en', {
  159 |     reach: 'populated',
  160 |     events: ['back', 'forward', 'reload']
  161 |   }),
  162 |   r('TP1-R6-S6-s64', 'R6', 'S6', 'webkit 1280x800 mouse light normal zh', {
  163 |     reach: 'populated',
  164 |     events: ['back', 'forward', 'go-offline']
  165 |   })
  166 | ]
  167 | 
  168 | const tab = (page: Page, name: 'models' | 'workflows' | 'apps') =>
  169 |   page.getByTestId(`catalogue-tab-${name}`)
  170 | 
  171 | async function expectTabsReady(page: Page) {
  172 |   await expect(page.getByTestId('catalogue-tabs')).toBeVisible()
> 173 |   await expect(tab(page, 'workflows')).toHaveAttribute('href', WORKFLOWS)
      |                                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  174 | }
  175 | 
  176 | // --- entry routes ---------------------------------------------------------
  177 | 
  178 | const entry: Record<string, (page: Page) => Promise<void>> = {
  179 |   // Home first, then the designed hop into the hub models page.
  180 |   R1: async (page) => {
  181 |     await page.goto('/')
  182 |     await page.goto(HUB)
  183 |   },
  184 |   R2: async (page) => {
  185 |     await page.goto(HUB)
  186 |   },
  187 |   R3: async (page) => {
  188 |     await page.goto('/hub/models?utm_x=1&extra=a&extra=b#top')
  189 |   },
  190 |   R4: async (page) => {
  191 |     await page.goto(HUB)
  192 |   },
  193 |   R5: async (page) => {
  194 |     await page.goto(HUB)
  195 |   },
  196 |   R6: async (page) => {
  197 |     await page.goto('/')
  198 |     await page.goto(HUB)
  199 |   },
  200 |   R7: async (page) => {
  201 |     await page.goto(HUB)
  202 |   },
  203 |   R12: async (page) => {
  204 |     await page.goto(`${HUB}?utm_source=email&ref=abc#models`)
  205 |   },
  206 |   R14: async (page) => {
  207 |     await page.goto(HUB)
  208 |   },
  209 |   R15: async (page) => {
  210 |     await page.goto(HUB)
  211 |   },
  212 |   R17: async (page) => {
  213 |     await page.goto(HUB)
  214 |   },
  215 |   // A 404 page first, then the hub.
  216 |   R18: async (page) => {
  217 |     await page.goto('/hub/does-not-exist-404/')
  218 |     await page.goto(HUB)
  219 |   },
  220 |   R25: async (page) => {
  221 |     await page.goto(HUB)
  222 |   }
  223 | }
  224 | 
  225 | // --- state-table events ---------------------------------------------------
  226 | 
  227 | async function hideResume(page: Page) {
  228 |   await page.evaluate(() => {
  229 |     Object.defineProperty(document, 'visibilityState', {
  230 |       configurable: true,
  231 |       get: () => 'hidden'
  232 |     })
  233 |     Object.defineProperty(document, 'hidden', {
  234 |       configurable: true,
  235 |       get: () => true
  236 |     })
  237 |     document.dispatchEvent(new Event('visibilitychange'))
  238 |   })
  239 |   await page.evaluate(() => {
  240 |     Object.defineProperty(document, 'visibilityState', {
  241 |       configurable: true,
  242 |       get: () => 'visible'
  243 |     })
  244 |     Object.defineProperty(document, 'hidden', {
  245 |       configurable: true,
  246 |       get: () => false
  247 |     })
  248 |     document.dispatchEvent(new Event('visibilitychange'))
  249 |   })
  250 | }
  251 | 
  252 | async function fire(page: Page, context: BrowserContext, ev: Event) {
  253 |   switch (ev) {
  254 |     case 'back':
  255 |       await page.goBack()
  256 |       break
  257 |     case 'forward':
  258 |       await page.goForward()
  259 |       break
  260 |     case 'reload':
  261 |       await page.reload()
  262 |       break
  263 |     case 'go-offline':
  264 |       await context.setOffline(true)
  265 |       break
  266 |     case 'go-online':
  267 |       await context.setOffline(false)
  268 |       break
  269 |     case 'hide-resume':
  270 |       await hideResume(page)
  271 |       break
  272 |   }
  273 | }
```