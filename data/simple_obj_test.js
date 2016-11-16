var Coverage = require('../build/coverage.js');
var obj = Coverage.wrap(require('../data/simple_obj.js'), 'simple_obj');
var Immutable = require('immutable');


obj.f = Immutable.Map();
x = obj.f
x.size
x.__altered = 2
x.__altered = true

obj.g = 2
obj.g = {}
