import Tracking = require("./tracking");

declare function Proxy(target: any, handler: {}): void;
// Shim WeakMap
type WeakMap<K,V> = any;
declare function WeakMap(): void;

export enum TypeKind {
  AnyType,
  BaseType,
  FunctionType,
  ForallType,
  TypeVariable,
  BoundTypeVariable,
  ArrayType,
  DictionaryType,
  ObjectType,
  HybridType,
  LazyType,
  BoundLazyType,
  UnionType
}

export interface IType {
  description: string;
  kind(): TypeKind;
  clone(): IType;
}

export class BaseType implements IType {

  constructor(public description: string, public contract: (any) => boolean) {
  }

  public kind(): TypeKind {
    return TypeKind.BaseType;
  }

  public clone(): IType {
    return new BaseType(this.description,
                        this.contract);
  }
}

// Declaring BaseTypes
export var Num = new BaseType("Num", function (value: any): boolean {
  var t = typeof value;
  if(t === "object" || t === "function") {
    if(BoundTypeVariable.sealTypeOf.has(value)) {
      var underlyingT = BoundTypeVariable.sealTypeOf.get(value);
      return underlyingT === "number";
    }
  }
  return typeof value === "number";
});

export var Bool = new BaseType("Bool", function (value: any): boolean {
  return typeof value === "boolean";
});

export var Str = new BaseType("Str", function (value: any): boolean {
  return typeof value === "string";
});

export var Void = new BaseType("Void", function (value: any): boolean {
  return typeof value === "undefined";
});

// Private BaseTypes, used by other types
export var Obj = new BaseType("Obj", function (value: any): boolean {
  return typeof value === "object";
});

export var Fun = new BaseType("Fun", function (value: any): boolean {
  return typeof value === "function";
});


export var Null = new BaseType("Null", function (value: any): boolean {
  return typeof value === "undefined" || value === null;
});

var Arr = new BaseType("Arr", function (value: any): boolean {
  return Array.isArray(value);
});

// Declaring Type Any
export var Any: IType = {
  description: "Any",
  kind: function(): TypeKind {
    return TypeKind.AnyType;
  },
  clone: function(): IType {
    return this
  }
};

function description(postfix: string): (IType) => string {
  return function (arg: IType): string {
    var desc = arg.description;
    if ((arg.kind() === TypeKind.FunctionType) ||
        (arg.kind() === TypeKind.ForallType)) {
      desc = "(" + desc + ")";
    }

    return desc + postfix;
  };
}

export class FunctionType implements IType {
  public requiredParameters: IType[];
  public optionalParameters: IType[];
  public restParameter: IType;
  public returnType: IType;
  public constructType: IType;

  public description: string;

  constructor(requiredParameters: IType[],
              optionalParameters: IType[],
              restParameter: IType,
              returnType: IType,
              constructType: IType) {

    this.requiredParameters = requiredParameters || [];
    this.optionalParameters = optionalParameters || [];

    this.restParameter = null;
    if (restParameter) {
      this.restParameter = restParameter;
    }

    this.returnType = returnType || Any;
    this.constructType = constructType || Any;

    var descs: string[] = ([])
      .concat(this.requiredParameters.map(description("")),
              this.optionalParameters.map(description("?")));

    if (this.restParameter) {
      descs.push(description("*")(this.restParameter));
    }

    if (this.requiredParameters.length === 0 &&
        this.optionalParameters.length === 0 &&
        !this.restParameter) {
      descs.push("()");
    }

    descs.push(description("")(this.returnType));

    this.description = descs.join(" -> ");

    if (this.constructType !== Any) {
      this.description += "  C:" + this.constructType.description;
    }
  }

  public kind(): TypeKind {
    return TypeKind.FunctionType;
  }

  public clone(): IType {
    return new FunctionType(
      this.requiredParameters.map(
        function(x) { return x.clone(); }),
      this.optionalParameters.map(
        function(x) { return x.clone(); }),
      this.restParameter ? this.restParameter.clone() : null,
      this.returnType.clone(),
      this.constructType.clone()
    )
  }
}

export function fun(range: IType[], optional: IType[], rest: IType, ret: IType, cons: IType): FunctionType {
  return new FunctionType(range, optional, rest, ret, cons);
}

export function func(...args: IType[]) {
  if (args.length < 0) {
    throw new Error("Invalid function type");
  }

  var returnType: IType = args.pop();

  return new FunctionType(args, [], null, returnType, null);
}

export class ForallType implements IType {

  public type: IType;

  public description: string;

  constructor(public tyvar: string, type: IType) {

    //switch (type.kind()) {
    //  case TypeKind.FunctionType:
    //  case TypeKind.ForallType:
    //    break;

    //  default:
    //    throw new Error("Panic, type " + type.description + " not supported for forall");
    //}

    this.type = type;
    this.tyvar = tyvar;
    this.description = "forall " + this.tyvar + ". " + this.type.description;
  }

  public kind(): TypeKind {
    return TypeKind.ForallType;
  }

  public clone(): IType {
    return new ForallType(this.tyvar, this.type.clone());
  }
}

export function forall(tyvar: any, type: IType) {
  return new ForallType(String(tyvar), type);
}

export class TypeVariable implements IType {

  constructor(public description: string) {
  }

  public kind(): TypeKind {
    return TypeKind.TypeVariable;
  }

  public clone(): IType {
    return new TypeVariable(this.description);
  }
}

export function tyvar(id: string): TypeVariable {
  return new TypeVariable(id);
}

class Token {
  constructor(public tyvar: string) {}
}

export class BoundTypeVariable extends TypeVariable {
  private storage: WeakMap<Token, any>;
  private static globalStorage: WeakMap<Token, any> = new WeakMap();
  public static sealTypeOf = new WeakMap();
  private setSealLock: (v: boolean) => void;

  
  constructor(description: string, storage?: WeakMap<Token, any>) {
    super(description);
    this.storage = storage || new WeakMap();
  }

  public seal(value: any, p: any): Token {

    // Create a token to wrap incase value is a primitive
    // (only objects can be proxied).

    var token = {
      tyvar: this.description
    };

    var lockSeal:boolean = false;
    this.setSealLock = (v:boolean) => { lockSeal = v };

    var sealed = new Proxy(token, {
      get: function (target: any, name: string, receiver: any): any {
        if (lockSeal) {
          Tracking.blameContext(target,p)
        }
        if (name === "tyvar") {
          return target.tyvar;
        }
        if (name === "valueOf") {
          return value.valueOf.bind(value);
        }
        if (name === "toString") {
          return value.toString.bind(value);
        }
        return value[name];
      },
      set: function (target: any, name: string, val: any, receiver: any): void {
        if(lockSeal) {
          Tracking.blameContext(target,p)
        }
        return value[name] = val;
      },
      apply: function (target: any, thisValue: any, args: any[]): any {
        if(lockSeal) {
          Tracking.blameContext(target,p)
        }
        return value.bind(value).apply(thisValue, args);
      }
    });
    this.storage.set(sealed, value);
    BoundTypeVariable.globalStorage.set(sealed, this.setSealLock);
    this.setSealLock(true);

    var t = typeof value;
    if(t === "object" || t === "function") {
      if(BoundTypeVariable.sealTypeOf.has(value)) {
        var underlyingT = BoundTypeVariable.sealTypeOf.get(value);
        BoundTypeVariable.sealTypeOf.set(sealed,underlyingT);
        return sealed;
      }
    }
    BoundTypeVariable.sealTypeOf.set(sealed,t);
    return sealed;
  }

  public unseal(t: Token, p: any): any {
    if(!(typeof t === 'object')) {
      return Tracking.blame(t,p)
    } else if(!(BoundTypeVariable.globalStorage.has(t))) {
      return Tracking.blame(t,p)
    }

    if (this.storage.has(t)) {
      return this.storage.get(t);
    }
    BoundTypeVariable.globalStorage.get(t)(false);
    var tyvr = t.tyvar;
    BoundTypeVariable.globalStorage.get(t)(true);
    return Tracking.blame(t,p)
  }

  public kind(): TypeKind {
    return TypeKind.BoundTypeVariable;
  }

  public clone(): IType {
    // Should not be cloned
    return this;
  }
  
}

export class ArrayType implements IType {
  public description: string;
  public type: IType;

  constructor(type: IType) {
    this.type = type;
    this.description = "[" + this.type.description + "]";
  }

  public kind(): TypeKind {
    return TypeKind.ArrayType;
  }

  public clone(): IType {
    // Should not be cloned
    return new ArrayType(this.type.clone());
  }
}

export function arr(type: IType): ArrayType {
  return new ArrayType(type);
}

export class DictionaryType extends ArrayType {
  constructor(type: IType) {
    super(type);
    this.description = "{" + this.type.description + "}";
  }

  public kind(): TypeKind {
    return TypeKind.DictionaryType;
  }

  public clone(): IType {
    // Should not be cloned
    return new DictionaryType(this.type.clone());
  }
  
}

export function dict(type: IType): DictionaryType {
  return new DictionaryType(type);
}

export interface TypeDict {
  [id: string]: IType
}

export class ObjectType implements IType {
  public description: string;
  public properties: TypeDict;

  constructor(properties: TypeDict) {
    this.properties = Object.create(null);

    var descs: string[] = [];

    for (var key in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        this.properties[key] = properties[key];
        descs.push(key + ": " + properties[key].description);
      }
    }

    this.description = "{" + descs.join(", ") + "}";
  }

  public kind(): TypeKind {
    return TypeKind.ObjectType;
  }

  public clone(): IType {
    var d:TypeDict = {};
    for (var key in this.properties) {
      d[key] = this.properties[key].clone();
    }
    var x = new ObjectType(d);
    return x
  }
  
}

export function obj(properties: TypeDict): ObjectType {
  return new ObjectType(properties);
}

// This is essentially and :P
export class HybridType implements IType {
  public description: string;
  public types: IType[] = [];

  constructor(types: IType[]) {
    this.types = types.map((type) => { return type; });
    this.description = this.types.map((type) => { return type.description; }).join(" && ");
  }

  public kind(): TypeKind {
    return TypeKind.HybridType;
  }

  public clone(): IType {
    return new HybridType(this.types.map(function(x) {return x.clone()}));
  }
  
}

export function hybrid(...types: IType[]): HybridType {
  return new HybridType(types);
}

export class LazyTypeCache {
  private typeCache: TypeDict;
  private requested: string[];

  constructor() {
    this.typeCache = Object.create(null);
    this.requested = [];
  }

  public get(name: string): IType {
    var resolver = () => {
      return this.typeCache[name] || Any;
    };

    this.requested.push(name);

    return new LazyType(name, resolver);
  }

  public set(name: string, type: IType): void {
    this.typeCache[name] = type;
  }

  public verify(): boolean {
    return this.requested.every((name) => {
      return Object.prototype.hasOwnProperty.call(this.typeCache, name);
    });
  }
}

export class LazyType {

  constructor(public description: string, public resolver: () => IType) {
  }

  public kind(): TypeKind {
    return TypeKind.LazyType;
  }

  public resolve(): IType {
    return this.resolver();
  }

  public clone(): IType {
    return new LazyType(this.description,this.resolver);
  }
}

export class BoundLazyType extends LazyType {
  private tys: string[];
  private new_types: IType[];

  constructor(type: LazyType) {
    super(type.description, type.resolver);
    this.tys = [];
    this.new_types = [];
  }

  public kind(): TypeKind {
    return TypeKind.BoundLazyType;
  }
  
  public add(ty: string, new_type: IType): void {
    this.tys.push(ty);
    this.new_types.push(new_type);
  }

  public resolve(): IType {
    var resolved = this.resolver();

    this.tys.forEach((tyi, i) => {
      resolved = capture_free_subst(resolved, tyi, this.new_types[i]);
    });

    return resolved;
  }

  public clone(): IType {
    return new BoundLazyType(new LazyType(this.description,this.resolver))
  }
  
  public hasTy(ty: string): boolean {
    return this.tys.some((myTy) => {
      return ty === myTy;
    });
  }
}


export class UnionType implements IType {
  public description: string;
  public types: IType[] = [];

  constructor(types: IType[]) {
    this.types = types.map((type) => { return type; });
    this.description = this.types.map((type) => { return type.description; }).join(" + ");
  }

  public kind(): TypeKind {
    return TypeKind.UnionType;
  }

  public clone(): IType {
    return new UnionType(this.types.map(function(x) { return x.clone()}));
  }
  
}

export function union(...types: IType[]): UnionType {
  return new UnionType(types);
}

var substitution_gensym: number = 0;
export function capture_free_subst(m: IType, x: string, n: IType): IType {
  switch (m.kind()) {
  case TypeKind.AnyType:
  case TypeKind.BaseType:
  case TypeKind.BoundTypeVariable:
    return m;

  case TypeKind.FunctionType:
    return capture_free_subst_fun(<FunctionType> m, x, n);

  case TypeKind.ForallType:
    return capture_free_subst_forall(<ForallType> m, x, n);

  case TypeKind.TypeVariable:
    return capture_free_subst_tyvar(<TypeVariable> m, x, n);

  case TypeKind.ArrayType:
    return capture_free_subst_arr(<ArrayType> m, x, n);

  case TypeKind.DictionaryType:
    return capture_free_subst_dict(<DictionaryType> m, x, n);

  case TypeKind.ObjectType:
    return capture_free_subst_obj(<ObjectType> m, x, n);

  case TypeKind.HybridType:
    return capture_free_subst_hybrid(<HybridType> m, x, n);

  case TypeKind.LazyType:
    return capture_free_subst_lazy(<LazyType> m, x, n);

  case TypeKind.BoundLazyType:
    return capture_free_subst_bound_lazy(<BoundLazyType> m, x, n);

  case TypeKind.UnionType:
    return capture_free_subst_union(<UnionType> m, x, n);
    // Sum Types are not supported
  default:
    throw new Error("Panic: unsupported type " + m.description +
                    "in tyvar substitution");
  }
}

function capture_free_subst_fun(m: FunctionType, x: string, n: IType): IType {
  function substitute(p: IType) {
    return capture_free_subst(p, x, n);
  }

  var requiredParameters: IType[] = m.requiredParameters.map(substitute);
  var optionalParameters: IType[] = m.optionalParameters.map(substitute);
  var restParameter: IType = null;
  if (m.restParameter) {
    restParameter = substitute(m.restParameter);
  }

  var returnType: IType = substitute(m.returnType);
  var constructType: IType = substitute(m.constructType);

  return new FunctionType(requiredParameters,
                          optionalParameters,
                          restParameter,
                          returnType,
                          constructType);
}
function capture_free_subst_forall(m: ForallType, x: string, n: IType): IType {
  if (m.tyvar === x) {
    return m;
  }
  var fresh:number = substitution_gensym++;
  var y:string = fresh.toString() + m.tyvar;
  var mprime = capture_free_subst(m.type,m.tyvar,new TypeVariable(y));
  mprime = capture_free_subst(mprime,x,n);
  return new ForallType(y, mprime);
}
function capture_free_subst_tyvar(m: TypeVariable, x: string, n: IType): IType {
  return m.description === x ? n : m;
}
function capture_free_subst_arr(m: ArrayType, x: string, n: IType): IType {
  return new ArrayType(capture_free_subst(m.type, x, n));
}
function capture_free_subst_dict(m: DictionaryType, x: string, n: IType): IType {
  return new DictionaryType(capture_free_subst(m.type, x, n));
}
function capture_free_subst_obj(m: ObjectType, x: string, n: IType): IType {
  var properties: TypeDict = Object.create(null);
  for (var key in m.properties) {
    if (Object.prototype.hasOwnProperty.call(m.properties, key)) {
      properties[key] = capture_free_subst(m.properties[key], x, n);
    }
  }
  return new ObjectType(properties);
}
function capture_free_subst_hybrid(m: HybridType, x: string, n: IType): IType {
  var new_types: IType[];
  new_types = m.types.map(
    (type) => { return capture_free_subst(type, x, n); });
  return new HybridType(new_types);
}
function capture_free_subst_lazy(m: LazyType, x: string, n: IType): IType {
  var blt: BoundLazyType = new BoundLazyType(m);
  blt.add(x, n);
  return blt;
}
function capture_free_subst_bound_lazy(m: BoundLazyType, x: string, n: IType): IType {
  m.add(x, n);
  return m;
}
function capture_free_subst_union(m: UnionType, x: string, n: IType): IType {
  var new_types: IType[];
  new_types = m.types.map(
    (type) => { return capture_free_subst(type, x, n); });
  return new UnionType(new_types);
}

export function tapp(l: IType, r: IType): IType {
  switch(l.kind()) {
  case TypeKind.ForallType:
    var fa: ForallType = <ForallType>l;
    return capture_free_subst(fa.type,fa.tyvar,r);
  case TypeKind.LazyType:
    return tapp((<LazyType>l).resolve(),r)
  default:
    throw new Error("Must directly apply forall " + TypeKind[l.kind()]);
  }
}
