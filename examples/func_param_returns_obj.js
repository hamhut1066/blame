var Coverage = require('../build/coverage')
var ho = Coverage.wrap(require('./higher_order'), 'higher-order')

var f = function(x) { console.log('inner function'); return {a: x} }
y = ho.f(f)
y.a
