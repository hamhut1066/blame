// test-suite foo.js
var Coverage = require('../build/coverage.js')
var x = Coverage.wrap(require('./obj_fun'), 'obj_fun').x
x(false)
x.prop
x._secret += 1
