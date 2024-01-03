export enum JSTypes {
    boolean = "boolean",
    number = "number",
    string = "string",
    custom = "custom",
    object = "object"
}

export type Nullable<T> = T | null | undefined;

export type JSStaticType<T extends JSTypes, C = never> =
    T extends JSTypes.boolean ? boolean :
    T extends JSTypes.number ? number :
    T extends JSTypes.string ? string :
    T extends JSTypes.custom ? C :
    T extends JSTypes.object ? object :
    never;
