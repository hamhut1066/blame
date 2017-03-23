// Coverage for the project
/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Immutable = require('immutable');
import Reflect   = require("harmony-reflect");

import todts     = require("./todts")
import Infer     = require("./infer")
import Tracking  = require("./tracking");

// types ----------
export type Name = string;
type Key = string;

export enum TypeEnum {
    Integer,
    String,
    Boolean,
    Object,
    Undefined,
    FunctionRef,
    FunctionLit,
    Array
}

enum Action {
    Set,
    Get,
    Apply
}

export type Type
    = BuiltinType
    | ObjectRefType
    | ObjectLitType
    | FunctionRefType
    | FunctionLitType
    | UndefinedType
    | ArrayRefType
    | ArrayLitType

export type ObjectMap = Immutable.Map<Name, ObjectLitType>;

interface ArrayLitType {
    type: 'array-lit',
    internal: Immutable.List<Type>
}

interface ArrayRefType {
    type: 'array-ref',
    action: Action,
    name: string
}

interface UndefinedType {
    type: 'undefined'
}

interface ObjectLitType {
    type: 'object-lit',
    properties: Immutable.Map<String, Immutable.List<Type>>
    call?: Immutable.List<FunctionLitType>
}
interface ObjectRefType {
    type: 'object-ref',
    action: Action,
    name: string
}

interface FunctionRefType {
    type: 'function-ref',
    action: Action,
    name: string
}

interface Property {
    type: Type
}

type BasicTypes
    = "number"
    | "string"
    | "boolean"
    | "void"
    | "any"
    | "undefined"

export interface BuiltinType {
    type: BasicTypes
    action: Action
}

export interface FunctionLitType {
    type: 'function-lit'
    parameters: Immutable.List<Parameter>,
    returnType: Type
}

interface Parameter {
    type: Type
}

type TimeoutID = number;


const NAME = "__BLAME__INTERNAL_NAME__"
// code ----------
var DEBUG = false;
var output = true

export var object_map: ObjectMap = <ObjectMap>Immutable.Map({})
export var root_parent_key;
var timeoutID: TimeoutID;

export function RESET() {
    object_map = <ObjectMap>Immutable.Map({})
}
export function outputTypes(val: boolean) {
    output = val
}

function touch(root_key?: string): void {
    root_parent_key = root_parent_key || root_key
    if (timeoutID) {
        clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(function() {
        if (output) {
            todts.print(Infer.types(object_map, root_parent_key));
        }
    }, 50)
}

// name might have to be allowed to be undefined.
export function wrap(value: any, name: string, parent?: string): any {
    var parent_key = parent || name;

    switch(simple_type(value)) {
    case TypeEnum.Object:
    case TypeEnum.FunctionRef:
        return wrap_fun(value, name, parent_key)
    case TypeEnum.Array:
        return wrap_arr(value, name, parent_key)
    default:
        return value
    }
}

var func_reserved = Immutable.List([
    "Symbol(Symbol.toStringTag)"
])

function wrap_fun(value: any, name: string, parent?: string): any {

    var _tmp = name.split('.')
    var rel_name = _tmp[_tmp.length-1]
    return new Proxy(value, {
        get: function(target: any, key: string, receiver: any): any {
            if (key === NAME) {
                return name
            } else if (key === 'valueOf') {
              return function() {
                return target
              }
            }
            var res = Reflect.get(target,key);
            var ret = res

            if (!func_reserved.includes(key.toString())) {
                if (typeof key === "symbol") {
                    res = target
                }

                var new_type = get_type(res, Action.Get)

                let ref = object_map.get(name, {
                    type: 'object-lit',
                    properties: Immutable.Map<String, Immutable.List<Type>>(),
                    call: Immutable.List<FunctionLitType>()
                })
                let me = updateType(ref, key, new_type)
                object_map = object_map.set(name, me)

                touch(parent)
                // the new_type expression below is known to have name either as defined or undefined.
                ret = wrap(res, (<any>new_type).name || name + '.' + key.toString(), name);
            }
            return ret
        },
        set: function(target: any, key: string, value: any, receiver: any): any {


            let ref = object_map.get(name, {
                type: 'object-lit',
                properties: Immutable.Map<String, Immutable.List<Type>>(),
                call: Immutable.List<FunctionLitType>()
            })
            var new_type = get_type(value, Action.Set)
            let me = updateType(ref, key, new_type)
            object_map = object_map.set(name, me)

            // set value to thing.
            Reflect.set(target, key, value)

            // return value
            touch(parent)
            return value
        },
        apply: function(target: any, thisValue: any, args: any[]): any {
            const arg_types = Immutable.List(args.map(function(arg) {
                return {
                    type: get_type(arg, Action.Get)
                }
            }))

            var wrapped_args = args.map(function(arg, index) {
                var lname: any = arg_types.get(index).type
                return wrap(arg, lname.name || name + '#' + index , name)
            })
            var ret = Reflect.apply(target, thisValue, wrapped_args)
            const ret_type = get_type(ret, Action.Get)

            var function_lit: FunctionLitType = {
                type: 'function-lit',
                parameters: arg_types,
                returnType: ret_type
            }

            let ref = object_map.get(name, {
                type: 'object-lit',
                properties: Immutable.Map<String, Immutable.List<Type>>(),
                call: Immutable.List<FunctionLitType>()
            })
            ref.call = ref.call.push(function_lit)

            // add ref in parent
            var parent_obj = object_map.get(parent, {
                type: 'object-lit',
                properties: Immutable.Map<String, Immutable.List<Type>>(),
                call: Immutable.List<FunctionLitType>()
            })
            var list = parent_obj.properties.get(rel_name, Immutable.List<Type>())

            list = list.push({
                type: 'function-ref',
                action: Action.Apply,
                name: name + '#'
            })

            object_map = object_map.set(name, ref)

            touch()
            return wrap(ret, (<any>ret_type).name || name + '.' + 'ret', name)
        }
    })
}

function updateType(parent: ObjectLitType, key: string, value: Type): ObjectLitType {
    var me = parent.properties.get(key, <any> Immutable.List<Type>())
    me = me.push(value)
    parent.properties = parent.properties.set(key, me)
    return parent
}

/* Reserved words in the array */
var arr_reserved = Immutable.List([
    'length',
    'valueOf'
])
function wrap_arr(value: any, name: string, root_key?: string): any {
    return new Proxy(value, {
        get: function(target: any, key: string, receiver: any): any {

            var res = Reflect.get(target,key);
            var ret = res
            var new_type: Type = {type: 'undefined'}
            if (!arr_reserved.includes(key)) {
                if (typeof key === "symbol") {
                    res = target
                }

                var new_type = get_type(res, Action.Get)

                let ref = object_map.get(name, {
                    type: 'object-lit',
                    properties: Immutable.Map<String, Immutable.List<Type>>(),
                    call: Immutable.List<FunctionLitType>()
                })
                let me = updateType(ref, key, new_type)
                object_map = object_map.set(name, me)

                ret = wrap(res, (<any>new_type).name || name + '.' + key.toString(), name);
            }



            touch(root_key)
            // the new_type expression below is known to have name either as defined or undefined.
            return ret
        },
        set: function(target: any, key: string, value: any, receiver: any): any {


            if (!arr_reserved.includes(key)) {
                let ref = object_map.get(name, {
                    type: 'object-lit',
                    properties: Immutable.Map<String, Immutable.List<Type>>(),
                    call: Immutable.List<FunctionLitType>()
                })
                var new_type = get_type(value, Action.Set)
                let me = updateType(ref, key, new_type)
                object_map = object_map.set(name, me)
            }
            // set value to thing.
            Reflect.set(target, key, value)

            // return value
            touch(root_key)
            return value
        }
    })
}

var counter = 0
function gensym(prefix: string) {
    counter += 1
    return prefix + counter
}

function get_type(value: any, action: Action): Type {
    var type = 'ERROR'
    switch (simple_type(value)) {
    case TypeEnum.Integer:
        return {
            type: 'number',
            action: action
        }
    case TypeEnum.String:
        return {
            type: 'string',
            action: action
        }
    case TypeEnum.Boolean:
        return {
            type: 'boolean',
            action: action
        }
    case TypeEnum.Object:
        return {
            type: 'object-ref',
            action: action,
            name: gensym('object')
        }
    case TypeEnum.FunctionRef:
        return {
            type: 'function-ref',
            action: action,
            name: gensym('function')
        }
    case TypeEnum.Array:
        return {
            type: 'array-ref',
            action: action,
            name: gensym('array')
        }
    case TypeEnum.Undefined:
        return {
            type: 'undefined',
            action: action
        }
    default:
        console.log(value)
        throw Error('unhandled type in get_type')
    }
}

export function simple_type(value: any): TypeEnum {
    if (is_boolean(value)) {
        return TypeEnum.Boolean
    } else if (is_undefined(value)) {
        return TypeEnum.Undefined
    } else if (is_number(value)) {
        return TypeEnum.Integer
    } else if (is_string(value)) {
        return TypeEnum.String
    } else if (is_array(value)) {
        return TypeEnum.Array
    } else if (is_object(value)) {
        return TypeEnum.Object
    } else if (is_function(value)) {
        return TypeEnum.FunctionRef
    }

    throw Error("Unknown Type for: " + typeof(value))
}

// types of things

function is_boolean(value: any) {
    return typeof(value) === "boolean"
}


function is_number(value: any) {
    return typeof(value) === "number"
}


function is_string(value: any) {
    return typeof(value) === "string"
}

function is_object(value: any) {
    return typeof(value) === "object"
}

function is_undefined(value: any) {
    return typeof(value) === "undefined" || value === null
}

function is_function(value: any) {
    return typeof(value) === "function"
}

function is_array(value: any) {
    return typeof(value) === "object" && value instanceof Array
}
