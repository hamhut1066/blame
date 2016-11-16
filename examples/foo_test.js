// test-suite foo.js
var Coverage = require('../build/coverage.js')
var foo = Coverage.wrap(require('./foo'), 'foo')
// console.log(foo)
var tmp = foo
foo.a === true
var x = foo.b + 3
foo.test = function() {}

