export const logFull = (values: Record<string, any>) =>
    console.dir(values, { depth: null })

/** Async promise that waits x amount in milleseconds */
export const wait = (dt: number) => new Promise((res) => setTimeout(res, dt))
