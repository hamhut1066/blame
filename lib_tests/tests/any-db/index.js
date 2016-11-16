var Coverage = require('blame/coverage');
module.exports = Coverage.wrap(require('any-db'), 'any-db');
