/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Coverage = require("./coverage")
import Immutable = require('immutable');

//move type definitions into types.ts
export function types(tmap: Coverage.ObjectMap, root: Coverage.Name): any {
    // as tmap is a single depth map, the <k,v> pair can be deleted when it, and all it's dependencies have been dealt with.
    // This means that when all things are done, we can start randomly extracting the remaining keys, to see if we have left anything
    // (although technically it should be impossible for this to happen)
    var lib_type = get_type(tmap, root)
    return lib_type
}

// figure out this type
function get_type(tmap: Coverage.ObjectMap, scope: Coverage.Name): any {
    var scoped_ref: any = tmap.get(scope, {
        type: 'object-lit',
        properties: Immutable.Map<String, Immutable.List<Coverage.Type>>(),
        call: Immutable.List<Coverage.FunctionLitType>()
    });

    // properties
    var properties = scoped_ref.properties
    var obj_types = properties.map(function(v, k) {

        //extract types
        var types = v.map(function(t) {
            switch (t.type) {
            case "object":
                var new_scope = scope + '.' + k
                return get_type(tmap, new_scope)
            case "function":
                var new_scope = scope + '.' + k
                return get_func_type(tmap, new_scope)

            default:
                return t.type
            }
        }).sort().toSet()

        return types
    })

    return obj_types
}



function get_func_type(tmap: Coverage.ObjectMap, scope: string) {
    var scoped_ref: any = tmap.get(scope, {
        type: 'object-lit',
        properties: Immutable.Map<String, Immutable.List<Coverage.Type>>(),
        call: Immutable.List<Coverage.FunctionLitType>()
    });

    // call
    var calls = scoped_ref.call
    var call_types = calls.map(function(v, k) {
        return {
            parameters: v.parameters.map(function(x) { return x.type.type }),
            returnType: v.returnType.type
        }
    }).sort().toSet()

    return call_types
}

function construct_type(type_arr: any) {
    var type = Immutable.Map<string, any>({ // set type here
        type: Immutable.List() // set type here
    })

    var count = 0
    type_arr.forEach(function(v, k) {

        if (v instanceof Immutable.Map) {
            // non-simple type.
            var local_key = 'object' + count
            count += 1

            type = type.set('type',
                            type.get('type').push(local_key))

            type = type.set(local_key, construct_map_type(v))
        } else {
            type = type.set('type',
                            type.get('type').push(v).flatten().sort())
        }
    })
    return type
}

function construct_map_type(lmap: any) {
    var type = Immutable.Map()

    lmap.forEach(function(v, k) {
        type = type.set(k, construct_type(v));
    })
    return type
}
