import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {__sandboxInternals} from '../generator.js';

const {ensureHelper, helperFunctions} = __sandboxInternals;

function callHelper(target, ...args) {
  return target.c(...args);
}

test('ensureHelper installs helper when missing', () => {
  const context = {};
  ensureHelper(context);
  assert.equal(typeof context.c, 'function');
  assert.equal(callHelper(context, undefined, 'fallback'), 'fallback');
});

test('ensureHelper restores helper when re-applied after overwrite', () => {
  const context = {};
  ensureHelper(context);
  context.c = null;
  ensureHelper(context);
  assert.equal(typeof context.c, 'function');
  assert.equal(callHelper(context, undefined, 'fallback'), 'fallback');
});

test('ensureHelper allows overriding with custom function', () => {
  const context = {};
  ensureHelper(context);
  const custom = () => 'custom';
  context.c = custom;
  assert.equal(context.c, custom);
  assert.equal(callHelper(context), 'custom');
});

test('ensureHelper works with vm contexts', () => {
  const context = vm.createContext({});
  ensureHelper(context);
  context.c = undefined;
  ensureHelper(context);
  assert.equal(typeof context.c, 'function');
  assert.equal(callHelper(context, 'value'), 'value');
});

// guard to ensure helperFunctions.c remains accessible for other modules
test('helperFunctions.c remains callable', () => {
  const result = helperFunctions.c(undefined, 'fallback', ' tail');
  assert.equal(result, 'fallback tail');
});
