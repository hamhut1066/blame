var Coverage = require('../build/coverage.js');
var obj = Coverage.wrap(require('../data/simple_obj.js'), 'simple_obj');

x = obj.b;
c = x.c;
c = x.d;
