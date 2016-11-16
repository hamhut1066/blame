// obj_final.js
module.exports = {
  Length: {
    toCm: function(n) { return n + 'cm'; },
    toIn: function(n) { return n + 'Inches'; },
    Const: {
      one: 1,
      two: 2
    }
  },
  supported: ["cm", "inches"]
}
