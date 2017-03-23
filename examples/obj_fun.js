var x = function(a) { return a || true }
x.prop = "hello"
x._secret = 3

module.exports = {x}
