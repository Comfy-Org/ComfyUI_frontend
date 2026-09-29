// @ts-expect-error a declared key keeps its string type
export const declaredKey: number = import.meta.env.PUBLIC_POSTHOG_KEY

// @ts-expect-error strict mode rejects a key missing from ImportMetaEnv
export const undeclaredKey = import.meta.env.PUBLIC_NOT_DECLARED_ANYWHERE
