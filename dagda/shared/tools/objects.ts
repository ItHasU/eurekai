/** Simple implementation of deep equal using string comparison */
export function deepEqual(o1: any, o2: any): boolean {
    return o1 === o2 || JSON.stringify(o1) === JSON.stringify(o2);
}