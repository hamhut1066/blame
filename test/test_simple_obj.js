var chai = require('chai');
var expect = chai.expect;

var Immutable = require('immutable');
var Coverage = require('../build/coverage.js');
var Infer = require('../build/infer.js');
var obj = Coverage.wrap(require('../data/simple_obj.js'), 'simple_obj');

Coverage.outputTypes(false);

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
    var types = Infer.types(Coverage.object_map, 'simple_obj').get('a').get('type').toJS();
    expect(types).deep.to.eq(['integer']);
  });

  it('union types (sorted)', function() {
    obj.c = 2;
    obj.c = 'hello';
    var types = Infer.types(Coverage.object_map, 'simple_obj').get('c').get('type').toJS();
    expect(types).deep.to.eq(['integer', 'string']);
  });


  it('union base/object', function() {
    obj.d = true;
    obj.d = {};
    obj.d.e = "hello";

    expect(function() {
      var x = Infer.types(Coverage.object_map, 'simple_obj').get('d');
    }).to.not.throw(Error);
  });

  it('union base/object no access', function() {
    obj.d = true;
    obj.d = {};
    obj.d = 'hello';
    obj.d = Immutable.Map({});

    var x;
    expect(function() {
      x = Infer.types(Coverage.object_map, 'simple_obj').get('d');
    }).to.not.throw(Error);

    expect(x.get('object0').toJS())
      .deep.to.eq({});

  });

  it('preserve keys for object types', function() {
    obj.d = Immutable.Map({});
    var size = obj.d.size;

    var x = Infer.types(Coverage.object_map, 'simple_obj').get('d');
    expect(x.get('object0').toJS())
      .deep.to.eq({
        size: {
          type: ['integer']
        }
      });
  });
});
