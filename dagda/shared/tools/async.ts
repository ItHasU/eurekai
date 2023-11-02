/** Set a timeout for the given amount of milliseconds */
export function wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}