export type Named<Name, Value> = Value & { _name: Name };

export function asNamed<Name extends string, V>(v: V): Named<Name, V> {
    return v as Named<Name, V>;
}
