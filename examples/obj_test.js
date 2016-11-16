// test-suite obj.js
var Coverage = require('../build/coverage.js')
var obj = Coverage.wrap(require('./obj.js'), 'obj')

// console.log(obj)
// console.log(obj.o.f(obj.v))
// console.log(obj.o.f(obj.o.a))
obj.v
obj.v = true
obj.v = 23
obj.o.a
obj.o.b = 'hello'
obj.o.c = {}
obj.o.c.d = 'hello'
obj.o = true
obj.f = function() {}
obj.f('2')
obj.f(true)
obj.f(2)
obj.f('2')
obj.f('2', true)
