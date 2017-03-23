var Coverage = require('../build/coverage')
var ho = Coverage.wrap(require('./higher_order'), 'higher-order')

var f = function(a) { return a + 1 }
console.log(ho.f(f, true))
