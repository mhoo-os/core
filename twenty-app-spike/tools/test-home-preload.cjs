'use strict';

const os = require('node:os');
const path = require('node:path');

const requestedHome = process.env.MHOO_TWENTY_TEST_HOME;

if (typeof requestedHome !== 'string' || requestedHome.length === 0) {
  throw new Error('MHOO_TWENTY_TEST_HOME is required for disposable tests');
}

const resolvedHome = path.resolve(requestedHome);

if (!path.isAbsolute(requestedHome) || resolvedHome === path.parse(resolvedHome).root) {
  throw new Error('MHOO_TWENTY_TEST_HOME must be a bounded absolute directory');
}

os.homedir = () => resolvedHome;
