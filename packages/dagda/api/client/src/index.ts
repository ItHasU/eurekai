/** Base typing for a list of methods */
type BaseMethods = { [MethodName: string]: (...args: any) => any };

/** Call a method on the server */
export async function apiCall<Methods extends BaseMethods, MethodName extends keyof BaseMethods>(url: string, name: MethodName, ...args: Parameters<Methods[MethodName]>): Promise<ReturnType<Methods[MethodName]>> {
    const URL = `${url}/${name}`;

    const response = await fetch(URL, {
        method: "POST",
        body: JSON.stringify(args),
        headers: {
            'Content-Type': 'application/json',
        }
    });
    if (!response.ok) {
        throw new Error(`Method call failed: ${URL}() => ${response.status} ${response.statusText}`);
    } else {
        const data = await response.json();
        return data as ReturnType<Methods[MethodName]>;
    }
}
