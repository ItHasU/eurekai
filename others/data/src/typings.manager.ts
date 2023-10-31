import { Named, NamedTyping, asNamed } from "./typings";

export class TypingsManager<K extends string, JSONTypes extends { [name in K]: any }, DBTypes extends { [name in K]: any }> {

    constructor(protected readonly knownTypes: { [key in K]: NamedTyping<key, JSONTypes[key], DBTypes[key]> }) {
    }

    public getTypes(): K[] {
        return Object.keys(this.knownTypes) as K[];
    }

    public asType(t: K): K { return t };

    public assertJSONType<N extends K>(_type: N, value: JSONTypes[N]): JSONTypes[N] { return value };

    public getNamedType<N extends K>(_type: N, value: JSONTypes[N]): Named<N, JSONTypes[N]> {
        return asNamed(value);
    }
}

export type JSONTypeOf<K extends string, TM extends TypingsManager<K, JSONTypes, DBTypes>, JSONTypes extends { [name in K]: any }, DBTypes extends { [name in K]: any }> = JSONTypes[K];
