// Coverage for the project
/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Immutable = require('immutable');
import Reflect   = require("harmony-reflect");

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
    FunctionLit
}

enum Action {
    Set,
    Get,
    Apply
}

export type Type
    = BuiltinType
    | ObjectType
    | FunctionRefType
    | ObjectLitType
    | FunctionLitType

export type ObjectMap = Immutable.Map<Name, ObjectLitType>;

interface ObjectLitType {
    type: 'object-lit',
    properties: Immutable.Map<String, Immutable.List<Type>>
    call?: Immutable.List<FunctionLitType>
}
interface ObjectType {
    type: 'object',
    action: Action
}

interface FunctionRefType {
    type: 'function',
    action: Action
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


// code ----------
var DEBUG = false;
var output = true

export var object_map: ObjectMap = <ObjectMap>Immutable.Map({})
var timeoutID: TimeoutID;
var root_parent_key;

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
            console.log(JSON.stringify(object_map))
            const tmp = JSON.stringify(Infer.types(object_map, root_parent_key));
            // console.error(tmp)
        }
    }, 50)
}

// name might have to be allowed to be undefined.
export function wrap(value: any, name: string, parent?: string): any {
    var parent_key = parent || name;

    switch(simple_type(value)) {
    case TypeEnum.Object:
        return wrap_obj(value, name, parent_key)
    case TypeEnum.FunctionRef:
        return wrap_fun(value, name, parent_key)
    default:
        console.log('Skipping: ' + name);
        return value
    }
}

function updateType(parent: ObjectLitType, key: string, value: Type): ObjectLitType {
    var me = parent.properties.get(key, <any> Immutable.List<Type>())
    me = me.push(value)
    parent.properties = parent.properties.set(key, me)
    return parent
}

function wrap_fun(value: any, name: string, parent?: string): any {

    var _tmp = name.split('.')
    var rel_name = _tmp[_tmp.length-1]
    return new Proxy(value, {
        get: function(target: any, attr: string, __: any): any {
            if (name === "toJSON") {
                return function() {
                    return target
                }
            } else {
                var res = Reflect.get(target, attr)
                return res
            }
        },
        // refine this return type?
        set: function(target: any, attr: string, val: any, receiver: any): any {
            Reflect.set(target, attr, val)
        },
        apply: function(target: any, thisValue: any, args: any[]): any {
            const arg_types = Immutable.List(args.map(function(arg) {
                return {
                    type: get_type(arg, Action.Get)
                }
            }))

            var ret = Reflect.apply(target, thisValue, args)
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
            var parent_obj = object_map.get(parent)
            var list = parent_obj.properties.get(rel_name)

            console.log(parent)
            console.log(rel_name)
            console.log(JSON.stringify(parent_obj))
            list = list.push({
                type: 'function',
                action: Action.Apply
            })

            object_map = object_map.set(name, ref)

            touch()
            return ret
            // return wrap(ret, name + '.' + 'ret', name)
        }
    })
}

function wrap_obj(value: any, name: string, root_key?: string): any {


    return new Proxy(value, {
        get: function(target: any, key: string, receiver: any): any {
            var res = Reflect.get(target,key);

            if (typeof key === "symbol") {
                res = target
            }

            var new_type = get_type(res, Action.Get)

            let ref = object_map.get(name, {
                type: 'object-lit',
                properties: Immutable.Map<String, Immutable.List<Type>>(),
                call: undefined
            })
            let me = updateType(ref, key, new_type)
            object_map = object_map.set(name, me)

            touch(root_key)
            return wrap(res, name + '.' + key.toString(), name);
        },
        set: function(target: any, key: string, value: any, receiver: any): any {

            let ref = object_map.get(name, {
                type: 'object-lit',
                properties: Immutable.Map<String, Immutable.List<Type>>(),
                call: undefined
            })
            let me = updateType(ref, key, value)
            object_map = object_map.set(name, me)

            // set value to thing.
            Reflect.set(target, key, value)

            // return value
            touch(root_key)
            return value
        }
    })
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
            type: 'object',
            action: action
        }
    case TypeEnum.FunctionRef:
        return {
            type: 'function',
            action: action
        }
    default:
        console.log(value)
        throw Error('unhandled type in get_type')
    }
}

function simple_type(value: any): TypeEnum {
    if (is_boolean(value)) {
        return TypeEnum.Boolean
    } else if (is_number(value)) {
        return TypeEnum.Integer
    } else if (is_string(value)) {
        return TypeEnum.String
    } else if (is_object(value)) {
        return TypeEnum.Object
    } else if (is_undefined(value)) {
        return TypeEnum.Undefined
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
    return typeof(value) === "undefined"
}

function is_function(value: any) {
    return typeof(value) === "function"
}
