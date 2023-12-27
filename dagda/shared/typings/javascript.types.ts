export enum JSTypes {
    boolean = "boolean",
    number = "number",
    string = "string",
    object = "object"
}

export type Nullable<T> = T | null;

export type JSStaticType<T extends JSTypes> =
    T extends JSTypes.string ? string :
    T extends JSTypes.number ? number :
    T extends JSTypes.boolean ? boolean :
    T extends JSTypes.object ? object :
    never;