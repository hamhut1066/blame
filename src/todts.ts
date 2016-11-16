import Immutable = require('immutable');

export function print(obj) {
    var str = generate(obj)
    str.forEach(function(v) {
        console.error(v)
    })
}

/*
 * The top level object has different properties to all nested objects,
 * so we want to treat it a little differently.
 *
 * TODO: I also need to figure out the types for this code.
 *
 * The first stage just needs to figure out whether we have a top level function or not.
 */
export function generate(obj) {
    return obj.map(function(v, k) {
        var is_function = false
        var ret_arr = []
        var return_type = undefined
        switch (v.type) {
          case "function":
            return construct_func(k, v.parameters, v.returnType)
          case "object":
            return construct_obj(k, v.types)
          default:
            return construct_var(k, v.types)
        }
    })
}


function construct_obj(name: string, types) {
  return "export var " + name.toString() + ": " + types.map(generate_obj).join("|")
}

function construct_func(name: string, types: string[], return_type: string) {
    // console.log(JSON.stringify(types))
    return "export function " + name + "(" + construct_func_params(types) + "): " + return_type.join("|")
}

function construct_func_params(params) {
  var args = []
  params.forEach(function(v) {
    args.push(v.join("|"))
  }
  return args.join(", ")
}

function construct_var(name: string, types: string[]) {
    return "export var " + name.toString() + ": " + types.join("|")
}

export function generate_obj(obj) {
    if (obj instanceof Immutable.Map) {
        var type_list = []
        obj.forEach(function(v, k) {
            var is_function = false
            var ret_arr = []
            var return_type = undefined
            switch (v.type) {
              case "function":
                break
              case "object":
                type_list.push(k + ": " + construct_obj_prop(v.types))
                break
              default:
                type_list.push(k + ": " + construct_var_prop(k, v.types))
                break
            }
        })
        return "{" + type_list.join(", ") + "}"
    } else return obj
}


function construct_obj_prop(types) {
  // console.error(JSON.stringify(types))
  return generate_obj(types.first())
}

function construct_var_prop(name, types) {
  return types.join("|")
}
/*
function construct_obj_fragment(obj) {
    var property_list = []
    obj.forEach(function(v, k) {
        property_list.push(k + ": " + v.map(function(elem) {
            if (elem instanceof Immutable.Set) {
                return construct_obj_func_fragment(elem)
            }
            return elem
        }).join("|"))
    })
    return "{" + property_list.join(", ") + "}"
}

function construct_obj_func_fragment(elem) {
    return elem
}

function construct_func_fragment(f) {
    return {
        parameters: f.parameters.join(", "),
        returnType: f.returnType
    }
}
*/
