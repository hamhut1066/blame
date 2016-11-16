import Immutable = require('immutable');

export function print(obj) {
    var str = generate(obj)
    str.forEach(function(v) {
        console.error(v)
    })
}


export function generate(obj) {
    return obj.map(function(v, k) {
        var is_function = false
        var ret_arr = []
        var return_type = undefined
        var __ = v.map(function(sv) {
            if (sv instanceof Immutable.Map) {
                // pass, but probably recur
                ret_arr.push(construct_obj_fragment(v.first()))
            } else if (sv instanceof Immutable.Set) {
                // this is a function
                is_function = true
                var tmp = construct_func_fragment(v.first().first())
                ret_arr.push(tmp.parameters)
                return_type = tmp.returnType
            } else {
                ret_arr.push(sv)
            }
        })
        if (!is_function) {
            return construct_var(k, ret_arr)
        } else {
            return construct_func(k, ret_arr, return_type)
        }
    })
}


function construct_var(name: string, types: string[]) {
    return "export var " + name.toString() + ": " + types.join(" | ")
}

function construct_func(name: string, types: string[], return_type: string) {
    return "export function " + name + "(" + types.join(", ") + "): " + return_type
}


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
