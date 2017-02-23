const chai = require('chai');
global.expect = chai.expect;
global.sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');

require('sinon-as-promised');

chai.use(chaiAsPromised);
chai.use(sinonChai);

beforeEach(() => global.sinon = require('sinon').sandbox.create());

afterEach(() => global.sinon.restore());
