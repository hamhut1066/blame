// test-suite func.js
var Coverage = require('../build/coverage.js')
var func = Coverage.wrap(require('./func.js'), 'func')
x = func.x
f = func.f
f(x)
