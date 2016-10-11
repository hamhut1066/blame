var chai = require('chai');
var expect = chai.expect;

var Coverage = require('../build/coverage.js');
var Infer = require('../build/infer.js');
var obj = Coverage.wrap(require('../data/simple_obj.js'), 'simple_obj');

// disable printing of outputs
// Coverage.outputTypes(false);

describe('Base', function() {

  beforeEach(function() {
    Coverage.RESET();
  });

  it('get/set no interferance', function() {
    chai.expect(function() {
      var x = obj.a;
      obj.a = 3;
    }).to.not.throw(Error);
  });

  it('no duplication', function() {
    obj.a = 2;
    obj.a = 2;
    var types = Infer.types(Coverage.object_map, 'simple_obj').get('a');
    expect(types).to.eq('integer');
  });

  it('union types (sorted)', function() {
    obj.c = 2;
    obj.c = 'hello';
    var types = Infer.types(Coverage.object_map, 'simple_obj').get('c');
    expect(types).to.eq('integer|string');
  });


  it('union base/object', function() {
    obj.d = true;
    obj.d = {};

    expect(function() {
      Infer.types(Coverage.object_map, 'simple_obj').get('c');
    }).to.throw(Error);
  });

});

describe('Destructive', function() {

  beforeEach(function() {
    Coverage.RESET();
  });

  it('union base/object', function() {
    obj.d = true;
    obj.d = {};

    expect(function() {
      Infer.types(Coverage.object_map, 'simple_obj').get('c');
    }).to.throw(Error);
  });

  it('union types (sorted)', function() {
    obj.c = 2;
    obj.c = 'hello';
    var types = Infer.types(Coverage.object_map, 'simple_obj').get('c');
    expect(types).to.eq('integer|string');
  });
})
