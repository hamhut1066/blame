// test-suite foo.js
var Coverage = require('../build/coverage.js');
var arr = Coverage.wrap(require('./array'), 'array');
arr.i_arr[0] + 1;
arr.obj_arr[1].a = 3;
arr.obj_arr
arr.nest[0][0]
arr.nest[1][0]
arr.obj.a[0]
arr.obj.a[1]
arr.obj.z[0]
arr.obj.z[0].b
