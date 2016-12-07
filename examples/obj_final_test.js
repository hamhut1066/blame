// test-suite obj_final.js
var Coverage = require('../build/coverage')
var obj = Coverage.wrap(require('./obj_final.js'), 'obj_final')

obj.Length.toCm(obj.Length.Const.one);
obj.Length.toCm('hello', true);


// note no toIn never applied to a string,
// so we don't know if it will work.
obj.Length.toIn(obj.Length.Const.one);


obj.supported[0];
