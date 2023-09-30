import { NamedTyping, Static, asNamed } from "./typings";

// -- Check types creation --
const SQLBoolean = new NamedTyping<"boolean", boolean, number>({
    dbToJSON: (v: number) => v === 0 ? false : true,
    jsonToDB: (v: boolean) => v ? 1 : 0
});
type SQLBoolean = Static<typeof SQLBoolean>;

const b1: SQLBoolean = asNamed<SQLBoolean>(true);

const b2: boolean = b1;