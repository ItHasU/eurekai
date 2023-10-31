/** Base typing for a list of methods */
type BaseMethods = {
    [MethodName: string]: (...args: any) => any;
};
type PromiseReturn<T> = T extends Promise<infer R> ? R : T;
/** Call a method on the server */
export declare function apiCall<Methods extends BaseMethods, MethodName extends keyof BaseMethods>(url: string, name: MethodName, ...args: Parameters<Methods[MethodName]>): Promise<PromiseReturn<ReturnType<Methods[MethodName]>>>;
export {};
