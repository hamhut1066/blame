// d.ts declaration
declare interface LengthConst {
    one: number
    two: number
}
declare interface Length {
    toCm(a: string|number): string
    toIn(a: number): string
    Const: LengthConst
}

export var Length: Length
export var supported: [string]
