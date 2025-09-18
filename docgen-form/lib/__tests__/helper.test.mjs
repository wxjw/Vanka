import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import {__sandboxInternals} from '../generator.js';

const {ensureHelper, helperFunctions, createJsRuntime, reinstateHelper} = __sandboxInternals;

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

test('ensureHelper keeps helper callable within same turn', () => {
  const context = {};
  ensureHelper(context);
  context.c = null;
  assert.equal(callHelper(context, 'value'), 'value');
});

test('reinstateHelper injects default helper when missing or invalid', () => {
  const context = {c: 'not callable'};
  const protectedContext = reinstateHelper(context);
  assert.equal(typeof protectedContext.c, 'function');
  assert.equal(callHelper(protectedContext, undefined, 'fallback'), 'fallback');
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

test('vm scripts keep helper usable after reassignment', () => {
  const context = vm.createContext({});
  ensureHelper(context);
  const result = new vm.Script('c = null; c("value")').runInContext(context);
  assert.equal(result, 'value');
});

test('createJsRuntime restores helper between sandbox executions', async () => {
  const runtime = createJsRuntime();
  const first = runtime({sandbox: {__code__: 'c = null; "ok"'}});
  const firstResult = await first.result;
  assert.equal(firstResult, 'ok');
  assert.equal(typeof first.modifiedSandbox.c, 'function');

  const nextSandbox = first.modifiedSandbox;
  nextSandbox.__code__ = 'c(undefined, "fallback")';
  const second = runtime({sandbox: nextSandbox});
  const secondResult = await second.result;
  assert.equal(secondResult, 'fallback');
  assert.equal(typeof second.modifiedSandbox.c, 'function');
});

// guard to ensure helperFunctions.c remains accessible for other modules
test('helperFunctions.c remains callable', () => {
  const result = helperFunctions.c(undefined, 'fallback', ' tail');
  assert.equal(result, 'fallback tail');
});
