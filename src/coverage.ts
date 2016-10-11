// Coverage for the project
/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Immutable = require('immutable');
import Reflect   = require("harmony-reflect");

import Infer     = require("./infer")
import Tracking  = require("./tracking");

export type Name = string;
type Key = string;

export enum Type {
    Integer,
    String,
    Boolean,
    Object,
}

enum Action {
    Set,
    Get
}

interface TypeObject {
    type: Type,
    action: Action
};

export type ObjectMap = Immutable.Map<Name, ObjectType>;
export type ObjectType = Immutable.Map<Key, [TypeObject]>;
type TimeoutID = number;

var DEBUG = false;

export var object_map: ObjectMap = <ObjectMap>Immutable.Map({});
var timeoutID: TimeoutID;
var root_key: Name;

function touch(): void {
    if (timeoutID) {
        clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(function() {
        console.log(Infer.types(object_map, root_key))
    }, 50)
}

// name might have to be allowed to be undefined.
export function wrap(value: any, name: string): any {
    switch(simple_type(value)) {
    case Type.Object:
        return wrap_obj(value, name);
    default:
        return value
    }
}

function wrap_obj(value: any, name: string): any {

    root_key = root_key || name;
    let me = object_map.get(name, <ObjectType> Immutable.Map());

    function updateType(key: string, value: any, action: Action): ObjectType {
        var res_type = me.get(key, [] as [TypeObject])
        let new_type: TypeObject = get_type(value, action);
        res_type.push(new_type);
        me = me.set(key, res_type);
        return me
    }

    return new Proxy(value, {
        get: function(target: any, key: string, receiver: any): any {
            var res = Reflect.get(target,key);


            if (typeof key === "symbol") {
                res = target
            }

            me = updateType(key, res, Action.Get)
            object_map = object_map.set(name, me)

            touch()
            return wrap(res, name + '.' + key.toString());
        },
        set: function(target: any, key: string, value: any, receiver: any): any {

            me = updateType(key, value, Action.Set)
            object_map = object_map.set(name, me)

            // set value to thing.
            Reflect.set(target, key, value)

            // return value
            touch()
            return value
        }
    })
}


export function inverse_type(t: Type) {
    switch (t) {
    case Type.Integer:
        return 'int'
    case Type.String:
        return 'string'
    case Type.Boolean:
        return 'boolean'
    default:
        throw Error('Unhandled Type: ' + t)
    }
}

function get_type(value: any, action: Action): TypeObject {
    return {
        type: simple_type(value),
        action: action
    }
}

function simple_type(value: any): Type {
    if (is_boolean(value)) {
        return Type.Boolean
    } else if (is_number(value)) {
        return Type.Integer
    } else if (is_string(value)) {
        return Type.String
    } else if (is_object(value)) {
        return Type.Object
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
