// higher_order.js
module.exports = {
  f: function(a) { console.error('outer function'); 
             return a(true)
     }
}
