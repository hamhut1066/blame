/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Coverage = require("./coverage")
import Immutable = require('immutable');

//TODO: move type definitions into types.ts
export function types(tmap: Coverage.ObjectMap, root: Coverage.Name): any {
    // as tmap is a single depth map, the <k,v> pair can be deleted when it, and all it's dependencies have been dealt with.
    // This means that when all things are done, we can start randomly extracting the remaining keys, to see if we have left anything
    // (although technically it should be impossible for this to happen)
    // console.error(JSON.stringify(tmap))
    var lib_type = get_type(tmap, root)
    // console.error(JSON.stringify(lib_type))
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
        var property_type = undefined
        var types = v.map(function(t) {
            property_type = update_type(property_type, t.type)
            switch (t.type) {
            case "object-ref":
                return get_type(tmap, t.name)
            case "function-ref":
                return get_func_type(tmap, t.name)
            case "array-ref":
                var tmp = get_arr_type(tmap, t.name)
                return tmp

            default:
                return t.type
            }
        }).sort().toSet()

        if (property_type === "function-ref") {
            return construct_func_type(tmap, types)
        } else if (property_type === "object-ref") {
            return {
                type: "object",
                types
            }
        } else if (property_type === "array-ref") {
            return {
                type: "array",
                types
            }
        } else {
          return {
            type: "builtin",
            types
          }
        }
    })

    return obj_types
}


/*
 * The idea with this function is that we have a hierarchy:
 * object > function > simple type
 * This means that we want the type with the
 * highest priority that a variable has taken on.
 */
function update_type(curr, new_type) {
  if (curr === "object-ref") { return curr }
  if (new_type === "object-ref") { return new_type }
  if (curr === "function-ref") { return curr }
  return new_type
}

function construct_func_type(tmap, types) {
  // TODO: fix this issue where we are getting duplicate entries.
  var parameters = Immutable.List<Immutable.Set<string>>()
  var returnType = Immutable.Set<string>()
  var types = types.first()
  types.forEach(function(v) {
    // params
    v.parameters.forEach(function(v, i, rest) {
        var arg = parameters.get(i, Immutable.Set<string>())
        arg = arg.add(v)
        parameters = parameters.set(i, arg)
    })
    // returnType

    returnType = returnType.add(v.returnType)
  })

  return {
    type: 'function',
    parameters: parameters,
    returnType: returnType
  }
}


function get_func_type(tmap: Coverage.ObjectMap, scope: string): any {
    if (scope === undefined) {
        throw Error()
    }
    var scoped_ref: any = tmap.get(scope, {
        type: 'object-lit',
        properties: Immutable.Map<String, Immutable.List<Coverage.Type>>(),
        call: Immutable.List<Coverage.FunctionLitType>()
    });

    // call

    var parameters = Immutable.List<Immutable.List<string>>()
    var returnType = Immutable.List<string>()
    var calls = scoped_ref.call
    var call_types = calls.map(function(v, k) {
        v.parameters.map(function(arg) {
            // TODO: figure out how get correct index.
        })
        return {
            parameters: v.parameters.map(function(x) {
                var type = x.type.type
                switch (type) {
                case "function-ref":
                    var tmp = get_func_type(tmap, x.type.name).first()
                    return {
                        type: 'function',
                        parameters: tmp.parameters,
                        returnType: tmp.returnType
                    }
                default:
                    return x.type.type
                }
            }),
            returnType: v.returnType.type
        }
    }).sort().toSet()

    // TODO: actually make the function type inference do the right thing!
    return call_types
}

/* This function assumes that every property will be the same (as any properly behaved array should). */
function get_arr_type(tmap: Coverage.ObjectMap, scope: string) {
    var scoped_ref: any = tmap.get(scope, {
        type: 'object-lit',
        properties: Immutable.Map<String, Immutable.List<Coverage.Type>>(),
        call: Immutable.List<Coverage.FunctionLitType>()
    });

    // properties
    var properties = scoped_ref.properties
    var types = properties.first()
    var tmp = types.map(function(val) {
        switch (val.type) {
        case "object-ref":
            var arro = get_type(tmap, val.name)
            return Immutable.Map(arro)
        case "function-ref":
            return get_func_type(tmap, val.name)
        case "array-ref":
            var arr_ref = get_arr_type(tmap, val.name)
            return {
                type: 'array',
                types: Immutable.List([arr_ref])
            }

        default:
            return val.type
        }
    }).sort().first()
    return tmp
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
