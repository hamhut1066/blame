// test-suite obj_final.js
var obj = require('./examples/obj_final.js');

obj.Length.toCm(obj.Length.Const.one);
obj.Length.toCm('hello');


// note no toIn never applied to a string,
// so we don't know if it will work.
obj.Length.toIn(obj.Length.Const.one);


obj.supported[0];
