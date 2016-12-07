/// <reference path="../node_modules/typescript/lib/lib.es6.d.ts" />
import Coverage = require("./coverage")
import Immutable = require('immutable');

//TODO: move type definitions into types.ts
export function types(tmap: Coverage.ObjectMap, root: Coverage.Name): any {
    // as tmap is a single depth map, the <k,v> pair can be deleted when it, and all it's dependencies have been dealt with.
    // This means that when all things are done, we can start randomly extracting the remaining keys, to see if we have left anything
    // (although technically it should be impossible for this to happen)
    // console.log(JSON.stringify(tmap))
    var lib_type = get_type(tmap, root)
    // console.log(JSON.stringify(lib_type))
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

            default:
                return t.type
            }
        }).sort().toSet()

        if (property_type === "function-ref") {
          return construct_func_type(types)
        } else {
          return {
            type: property_type === "object-ref" ? "object" : "builtin",
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

function construct_func_type(types) {
  // TODO: fix this issue where we are getting duplicate entries.
  var parameters = Immutable.List<Immutable.Set<string>>()
  var returnType = Immutable.Set<string>()
  var types = types.first()
  types.forEach(function(v) {
    // params
    v.parameters.forEach(function(v, i) {
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
            parameters: v.parameters.map(function(x) { return x.type.type }),
            returnType: v.returnType.type
        }
    }).sort().toSet()

    // TODO: actually make the function type inference do the right thing!
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
