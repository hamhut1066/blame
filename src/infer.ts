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
    // foreach key in object.
    var tmp = tmap.get(scope).map(function(vs, k) {

        var is_obj = false
        // foreach runtime type in key.
        let types = vs.map(function(v) {
            switch(v.type) {
            case Coverage.Type.Object:
                is_obj = true
                var new_scope = scope + '.' + k
                return get_type(tmap, new_scope)
            default:
                return Coverage.inverse_type(v.type)
            }
        }).toSet()

        if (is_obj) {
            if (types.size > 1) {
                throw Error("An Object Type should not be unioned with a primitive type.")
            }
            return types.first()
        } else {
            return types.join('|')
        }

    })
    return tmp;
}
