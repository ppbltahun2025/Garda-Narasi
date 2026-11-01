'use strict';
// Memuat seluruh modul engine ke namespace globalThis.GARDA dan mengekspornya.
require('./lexicon.js'); require('./nlp.js'); require('./evaluate.js'); require('./analytics.js');
module.exports = globalThis.GARDA;
