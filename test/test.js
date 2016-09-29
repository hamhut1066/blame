var chai = require('chai');
var expect = chai.expect;
var Blame = require('../build/blame');
var Type = require('../build/types');
var Tracking = require('../build/tracking');

// Throw errors
Tracking.enableSilentMode(false);

describe('Polymorphism', function() {
    var X = Type.tyvar("X");
    var Y = Type.tyvar("Y");
    var ID = Type.forall("X",Type.fun([X],[],null,X));
    function foo(x) {
        return x
    }
    foo = Blame.simple_wrap(foo,ID)
    function badFoo(x) {
        x.y
        return x;
    }
    badFoo = Blame.simple_wrap(badFoo,ID)
    it('identity should not fail', function() {
        chai.expect(function() {
            foo(1)})
            .to.not.throw(Error);
    });
    it('inspecting identity should fail', function() {
        chai.expect(function() {
            badFoo({y: true})})
            .to.throw(Error);
    });
    function PairTy(X,Y) {
        return Type.obj({x: X, y: Y});
    }
    var SWAP = Type.forall(
        "X", Type.forall(
            "Y", Type.fun([PairTy(X,Y)],[],null,PairTy(Y,X))));
    function swap(p) {
        return {
            x: p.y,
            y: p.x
        };
    }
    swap = Blame.simple_wrap(swap,SWAP)
    function badSwap(p) {
        return {
            x: p.x,
            y: p.y
        };
    }
    badSwap = Blame.simple_wrap(badSwap,SWAP)
    it('swap should pass', function() {
        chai.expect(function() {
            var p = swap({x: 1, y: true});
            p.x; p.y;
        }).to.not.throw(Error);
    });
    it('badSwap should fail', function() {
        chai.expect(function() {
            var p = badSwap({x: 1, y: true});
            p.x; p.y;
        }).to.throw(Error);
    });
});

describe('Intersection', function() {
    describe('Base Types', function() {
        var T1 = Type.hybrid(Type.Num,Type.Bool);
        var T2 = Type.hybrid(Type.Num,Type.Any);
        var T3 = Type.hybrid(Type.Num,Type.Num);
        var T4 = Type.hybrid(Type.Num,T2);
        it('1 should fail for Num \cap Bool', function() {
            chai.expect(function() {
                Blame.simple_wrap(1,T1)})
                .to.throw(Error);
        });
        it('1 should pass for Num \cap Any', function() {
            chai.expect(function() {
                Blame.simple_wrap(1,T2)})
                .to.not.throw(Error);
        });
        it('1 should pass for Num \cap Num', function() {
            chai.expect(function() {
                Blame.simple_wrap(1,T3)})
                .to.not.throw(Error);
        });
        it('1 should pass for Num \cap (Num \cap Any)', function() {
            chai.expect(function() {
                Blame.simple_wrap(1,T4)})
                .to.not.throw(Error);
        });
    });
    describe('Functions', function() {
        var Num2Num = Type.fun([Type.Num],[],null,Type.Num);
        var Bool2Bool = Type.fun([Type.Bool],[],null,Type.Bool);
        function foo(x) {
            if(typeof x === "number") {
                return x + 1;
            } else {
                return !x;
            }
        }
        function badFoo(x) {
            if(typeof x === "number") {
                return true;
            } else {
                return 0;
            }
        }
        foo = Blame.simple_wrap(foo,Type.hybrid(Num2Num,Bool2Bool));
        badFoo = Blame.simple_wrap(badFoo,Type.hybrid(Num2Num,Bool2Bool));
        it('foo should fail for string input', function() {
            chai.expect(function() {
                foo("foo") })
                .to.throw(Error);
        });
        it('foo should pass for num input', function() {
            chai.expect(function() {
                foo(1) })
                .to.not.throw(Error);
        });
        it('foo should pass for bool input', function() {
            chai.expect(function() {
                foo(true) })
                .to.not.throw(Error);
        });
        
        it('badFoo should fail for string input', function() {
            chai.expect(function() {
                badFoo("foo") })
                .to.throw(Error);
        });
        it('badFoo should fail for num input', function() {
            chai.expect(function() {
                badFoo(1) })
                .to.throw(Error);
        });
        it('badFoo should fail for bool input', function() {
            chai.expect(function() {
                badFoo(true) })
                .to.throw(Error);
        });
    });        
});
