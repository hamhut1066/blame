///<reference path="./node.d.ts" />
var Reflect = require("harmony-reflect");
import Tracking = require("./tracking");
import Type = require("./types");

// Level of blame error reporting
var SILENT_MODE: boolean = true;
Tracking.enableSilentMode(SILENT_MODE);

// Counter for generating blame labels
var count: number = 0;

declare function Proxy(target: any, handler: {}): void;

// Shim WeakMap
type WeakMap<K,V> = any;
declare function WeakMap(): void;

function compatible_base(A: Type.BaseType, B: Type.BaseType): boolean {
  return A.description === B.description;
}

function compatible_fun(A: Type.FunctionType, B: Type.FunctionType): boolean {
  return A.requiredParameters.length === B.requiredParameters.length &&
    A.optionalParameters.length === B.optionalParameters.length &&
    (!!A.restParameter) === (!!B.restParameter);
}

function compatible_forall(A: Type.ForallType, B: Type.ForallType): boolean {
  return true; //TODO: Probably add some alpha equivalence here.
}

function compatible_obj(A: Type.ObjectType, B: Type.ObjectType): boolean {
  for (var key in A.properties) {
    if (Object.prototype.hasOwnProperty.call(A, key)) {
      if (!Object.prototype.hasOwnProperty.call(B, key)) {
        return false;
      }
    }
  }
  return true;
}

function compatible_hybrid(A: Type.HybridType, B: Type.HybridType): boolean {
  return (A.types.length == B.types.length);
}

function compatible_lazy(A: Type.LazyType, B: Type.LazyType): boolean {
  return A.description === B.description;
}

function compatible_union(A: Type.UnionType, B: Type.UnionType): boolean {
  return (A.types.length == B.types.length);
}

export function simple_wrap(value: any, A: Type.IType): any {
  var p = Tracking.createLabelMutable(count.toString());
  count += 1
  return wrap(value, p, A, A.clone());
}

export function wrap(value: any, p: any, A: Type.IType, B: Type.IType): any {
  // These don't play well with proxies.
  if(value instanceof RegExp) {
    return value;
  }
  if(value instanceof Date) {
    return value;
  }
  if(value instanceof Buffer) {
    return value;
  }

  var a: Type.TypeKind = A.kind();
  var b: Type.TypeKind = B.kind();

  if (a === b) {
    switch (a) {
    case Type.TypeKind.AnyType:
      return value;

    case Type.TypeKind.BaseType:
      if (compatible_base(<Type.BaseType> A, <Type.BaseType> B)) {
        return wrap_base(value, p, <Type.BaseType> A);
      }
      break;

    case Type.TypeKind.FunctionType:
      if (compatible_fun(<Type.FunctionType> A, <Type.FunctionType> B)) {
        return wrap_fun(value, p, <Type.FunctionType> A, <Type.FunctionType> B);
      }
      break;

    case Type.TypeKind.ForallType:
      if (compatible_forall(<Type.ForallType> A, <Type.ForallType> B)) {
        return wrap_forall(value, p, <Type.ForallType> A, <Type.ForallType> B);
      }
      break;

    case Type.TypeKind.ArrayType:
      // Arrays are always compatible
      return wrap_arr(value, p, <Type.ArrayType> A, <Type.ArrayType> B);

    case Type.TypeKind.DictionaryType:
      // Dictionaries are also compatible
      return wrap_dict(value, p, <Type.DictionaryType> A, <Type.DictionaryType> B);

    case Type.TypeKind.ObjectType:
      if (compatible_obj(<Type.ObjectType> A, <Type.ObjectType> B)) {
        return wrap_obj(value, p, <Type.ObjectType> A, <Type.ObjectType> B);
      }
      break;

    case Type.TypeKind.HybridType:
      if (compatible_hybrid(<Type.HybridType> A, <Type.HybridType> B)) {
        return wrap_hybrid(value, p, <Type.HybridType> A, <Type.HybridType> B);
      }
      break;


    case Type.TypeKind.UnionType:
      if (compatible_union(<Type.UnionType> A, <Type.UnionType> B)) {
        return wrap_union(value, p, <Type.UnionType> A, <Type.UnionType> B);
      }
      break;

    case Type.TypeKind.BoundLazyType:
    case Type.TypeKind.LazyType:
      if (compatible_lazy(<Type.LazyType> A, <Type.LazyType> B)) {
        return wrap_lazy(value, p, <Type.LazyType> A, <Type.LazyType> B);
      }
      break;
    }
  }

  // Seal And Unseal
  if (a === Type.TypeKind.AnyType && b === Type.TypeKind.BoundTypeVariable) {
    return (<Type.BoundTypeVariable> B).seal(value,p);
  }

  if (a === Type.TypeKind.BoundTypeVariable && b === Type.TypeKind.AnyType) {
    return (<Type.BoundTypeVariable> A).unseal(value, p);
  }

  return value;
}


function wrap_base(value: any, p: any, A: Type.BaseType): any {
  if (!A.contract(value)) {
    return Tracking.blame(value,p);
  }
  return value;
}

function wrap_fun(value: any, p: any, A: Type.FunctionType, B: Type.FunctionType) {
  // Checking if value is a function
  if (typeof value !== "function") {
    return Tracking.blame(value,p)
  }

  return new Proxy(value, {
    get: function(target, name, receiver) {
      if (name === 'toJSON') {
        return function() {
          return target; }
      } else {
        var res = Reflect.get(target,name);
        if(typeof res == "function") {
          if(name !== "apply") {
            // res = res.bind(target);
          }
        }
        return res;
      }
    },
    set: function (target: any, name: string, val: any, receiver: any): void {
      return Reflect.set(target,name,val);
    },
    apply: function (target: any, thisValue: any, args: any[]): any {
      var nodes = Tracking.createAppContextMutable(p);
      var pDom = nodes.dom;
      var pCod = nodes.cod;

      var nArgs: number = args.length;
      var minArgs: number = A.requiredParameters.length;
      var maxArgs: number = (A.requiredParameters.length +
                             A.optionalParameters.length);

      if (nArgs < minArgs) {
        Tracking.blame(null,pDom);
        return Reflect.apply(target,thisValue,args);
      }

      if (nArgs > maxArgs && !A.restParameter) {
        Tracking.blame(null,pDom);
        return Reflect.apply(target,thisValue,args);
      }

      var wrapped_args: any[] = [];
      for (var i = 0; i < A.requiredParameters.length; i++) {
        wrapped_args.push(wrap(args[i], pDom, B.requiredParameters[i],
                               A.requiredParameters[i]));
      }

      for (var j = 0; j < A.optionalParameters.length && (i + j) < args.length; j++) {
        wrapped_args.push(wrap(args[i + j], pDom,
                               Type.union(B.optionalParameters[j],Type.Null),
                               Type.union(A.optionalParameters[j],Type.Null)));
      }

      for (var k = i + j; k < args.length; k++) {
        wrapped_args.push(wrap(args[k], pDom, B.restParameter, A.restParameter));
      }
      var ret = Reflect.apply(target,thisValue,wrapped_args);
      return wrap(ret, pCod, A.returnType, B.returnType);
    },
    construct: function (target: any, args: any[]): any {
      var nodes = Tracking.createAppContextMutable(p);
      var pDom = nodes.dom;
      var pCod = nodes.cod;

      var nArgs: number = args.length;
      var minArgs: number = A.requiredParameters.length;
      var maxArgs: number = (A.requiredParameters.length + A.optionalParameters.length);

      // Create the instance
      var instance = Object.create(target.prototype);

      if (nArgs < minArgs) {
        Tracking.blame(null,pDom);
        Reflect.apply(target,instance, args);
        return instance;
      }

      if (nArgs > maxArgs && !A.restParameter) {
        Tracking.blame(null,pDom);
        Reflect.apply(target,instance, args);
        return instance;
      }

      var wrapped_args: any[] = [];

      for (var i = 0; i < A.requiredParameters.length; i++) {
        wrapped_args.push(wrap(args[i], pDom, B.requiredParameters[i], A.requiredParameters[i]));
      }

      for (var j = 0; j < A.optionalParameters.length && (i + j) < args.length; j++) {
        wrapped_args.push(wrap(args[i + j], pDom, B.optionalParameters[j], A.optionalParameters[j]));
      }

      for (var k = i + j; k < args.length; k++) {
        wrapped_args.push(wrap(args[k], pDom, B.restParameter, A.restParameter));
      }
      var cons_instance = wrap(instance, pCod, A.constructType, B.constructType);
      Reflect.apply(target,cons_instance,wrapped_args);
      return cons_instance;
    }
  });
}

function wrap_forall(value: any, p: any, A: Type.ForallType, B: Type.ForallType): any {

  function fresh_wrap(value: any): any {
    var XX = new Type.BoundTypeVariable(A.tyvar + "'");
    var A_XX: Type.IType = Type.capture_free_subst(A.type, A.tyvar, XX);
    var B_prim: Type.IType = Type.capture_free_subst(B.type, B.tyvar, Type.Any);
    return wrap(value, p, A_XX, B_prim);
  }

  if (typeof value !== "function") {
    return fresh_wrap(value);
  }

  return new Proxy(value, {
    get: function(target, name, receiver) {
      if (name === 'toJSON') {
        return function() {
          return target; }
      } else {
        return Reflect.get(target,name);
      }
    },
    apply: function (target: any, thisValue: any, args: any[]): any {
      var wrapped_fun = fresh_wrap(target);
      return Reflect.apply(wrapped_fun,thisValue,args);
    }
  });
}

function is_index(value: string): boolean {
  // Bitwise necessary for checking if the number is array index
  var index = Number(value) >>> 0;
  return value === index.toString() && index !== (-1 >>> 0);
}

function wrap_arr(value: any, p: any, A: Type.ArrayType, B: Type.ArrayType): any {
  if(!(Array.isArray(value))) {
    return Tracking.blame(value,p)
  }

  return new Proxy(value, {
    get: function (target: any, name: string, receiver: any): any {
      var getNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.POSITIVE,
        name,
        p);
      if (name === 'toJSON') {
        return function() {
          return target; }
      }
      else if (is_index(name)) {
        var desc = Object.getOwnPropertyDescriptor(target, name);
        if (desc !== undefined) {
          if (desc.configurable === false && desc.writable === false) {
          return Reflect.get(target,name);
          }
        }
        return wrap(Reflect.get(target,name),getNode, A.type, B.type);
      }
      return Reflect.get(target,name)
    },
    set: function (target: any, name: string, val: any, receiver: any): void {
      var setNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.NEGATIVE,
        name,
        p);
      if (is_index(name)) {
        return Reflect.set(target,name,wrap(val, setNode, B.type, A.type));
      }
      return Reflect.set(target,name,val);
    }
  });
}

function wrap_dict(value: any, p: any, A: Type.DictionaryType, B: Type.DictionaryType): any {
  var type: string = typeof value;
  if (type !== "object" && type !== "function") {
    return Tracking.blame(value,p);
  }

  if (!value) {
    return value;
  }

  return new Proxy(value, {
    get: function (target: any, name: string, receiver: any): any {
      var getNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.POSITIVE,
        name,
        p);

      if (name === 'toJSON') {
        return function () {
          return target;
        };
      }
      var desc = Object.getOwnPropertyDescriptor(target, name);
      if (desc !== undefined) {
        if (desc.configurable === false && desc.writable === false) {
          return Reflect.get(target,name);
        }
      }
      return wrap(Reflect.get(target,name),getNode, A.type, B.type);
    },
    set: function (target: any, name: string, val: any, receiver: any): void {
      var setNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.NEGATIVE,
        name,
        p);
      return Reflect.set(target,name,wrap(val, setNode, B.type, A.type));
    }
  });
}

function wrap_obj(value: any, p: any, A: Type.ObjectType, B: Type.ObjectType): any {
  var type: string = typeof value;

  if (type !== "object" && type !== "function") {
    return Tracking.blame(value,p);
  }

  // Don't wrap or blame null pointers
  if (!value) {
    return value;
  }

  return new Proxy(value, {
    get: function (target: any, name: string, receiver: any): any {
      var getNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.POSITIVE,
        name,
        p);
      var res = Reflect.get(target,name);
      if (Object.prototype.hasOwnProperty.call(A.properties, name)) {
        var A_type = A.properties[name];
        var B_type = B.properties[name];
        var desc = Object.getOwnPropertyDescriptor(target, name);
        if (desc !== undefined) {
          if (!desc.configurable && !desc.writable) {
            return res
          }
        }
        return wrap(res, getNode, A_type, B_type);
      }
      if (typeof res == "function") {
        // Buffer hack
        if (name == "readUInt16BE" || name == "hexSlice") {
          return res.bind(target);
        }
      }
      return res;
    },
    set: function (target: any, name: string, val: any, receiver: any): void {
      var setNode = Tracking.createPropContextMutable(
        Tracking.BLAME_POLARITY.NEGATIVE,
        name,
        p);
      if (Object.prototype.hasOwnProperty.call(A.properties, name)) {
        var A_type: Type.IType = A.properties[name];
        var B_type: Type.IType = B.properties[name];
        return Reflect.set(target,name, wrap(val, setNode, B_type, A_type));
      }
      return Reflect.set(target,name,val);
    }
  });
}

function wrap_hybrid(value: any, p: any, A: any, B: Type.HybridType): any {
  var blameState = [];
  return A.types.reduce((value, type, i) => {
    return wrap(value, Tracking.createBranchMutable(i,A.types,p,blameState), A.types[i], B.types[i]);
  }, value);
}

function wrap_lazy(value: any, p: any, A: Type.LazyType, B: Type.LazyType): any {
  return wrap(value, p, A.resolve(), B.resolve());
}

function wrap_union(value: any, p: any, A: Type.UnionType, B: Type.UnionType): any {
  return value;
}
