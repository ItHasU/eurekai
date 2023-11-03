declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export async function jsonGet<T>(url: string): Promise<T> {
    const result = await fetch(url, {
        method: "GET"
    });
    if (result.status !== 200) {
        throw new Error(result.statusText);
    }

    return (await result.json()) as T;
}

export async function jsonPost<T>(url: string, parameters: Record<string, any>): Promise<T> {
    const result = await fetch(url, {
        method: "POST",
        body: JSON.stringify(parameters),
        headers: {
            'Content-Type': 'application/json',
        }
    });
    if (result.status !== 200) {
        throw new Error(result.statusText);
    }

    return (await result.json()) as T;
}
