var Coverage = require('../build/coverage.js');
var obj = Coverage.wrap(require('../data/simple_obj.js'), 'simple_obj');

x = obj.b;
c = x.c;
c = x.d;
x.d = "pizza";
x.d = "pizza";
x.d = true;
x.e.f = 2
obj.a;
obj.a = "something";
obj.a = true;
obj.a = true;
