// present_test.js
var Coverage = require('../build/coverage');
var lib = Coverage.wrap(
	    require('./present'),
	    'present');

// generic access
var x = lib.b
var y = lib.a + 2
var z = x.c
x.c = 0 // set lib.b.c to false incorrectly

// add new attribute
lib.msg = 'hello'

