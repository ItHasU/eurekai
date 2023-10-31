import { NamedTyping, Static } from "src/typings";

export class Text extends NamedTyping<"string", string> { }
export class Integer extends NamedTyping<"integer", number> { }
export class Bool extends NamedTyping<"boolean", boolean> { }
export class Length extends NamedTyping<"length_in_meters", number>{ }
export class Tmp extends NamedTyping<"tmp", { length: Static<Length> }>{ }
