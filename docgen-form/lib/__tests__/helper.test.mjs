import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { __sandboxInternals } from '../generator.js';

const internals = __sandboxInternals ?? {};
const {
  ensureHelper,
  helperFunctions,
  createJsRuntime,
  reinstateHelper,
} = internals;

function callHelper(target, ...args) {
  return target.c(...args);
}

/* ---------- 基础能力（所有版本都应通过） ---------- */

test('ensureHelper installs helper when missing', () => {
  const context = {};
  ensureHelper(context);
  assert.equal(typeof context.c, 'function');
  assert.equal(callHelper(context, undefined, 'fallback'), 'fallback');
});

test('ensureHelper restores helper when re-applied after overwrite', () => {
  const context = {};
  ensureHelper(context);
  // 模拟被意外覆盖
  context.c = null;
  // 再次 ensure 应该恢复
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

test('ensureHelper works with vm contexts (re-ensure after unset)', () => {
  const context = vm.createContext({});
  ensureHelper(context);
  // 被清掉后，重新 ensure 恢复
  context.c = undefined;
  ensureHelper(context);
  assert.equal(typeof context.c, 'function');
  assert.equal(callHelper(context, 'value'), 'value');
});

// guard: 其他模块可直接用 helperFunctions.c
test('helperFunctions.c remains callable', { skip: !helperFunctions?.c }, () => {
  const result = helperFunctions.c(undefined, 'fallback', ' tail');
  assert.equal(result, 'fallback tail');
});

/* ---------- 高级能力（存在才测） ---------- */

// 若实现了“同一轮可恢复/保护”语义（通常伴随 reinstateHelper）
test('ensureHelper keeps helper callable within same turn (if supported)', {
  skip: !reinstateHelper,
}, () => {
  const context = {};
  ensureHelper(context);
  // 覆盖为 null，但仍应可调用（新实现的弹性行为）
  context.c = null;
  assert.equal(callHelper(context, 'value'), 'value');
});

test('reinstateHelper injects default helper when missing or invalid', {
  skip: !reinstateHelper,
}, () => {
  const context = { c: 'not callable' };
  const protectedContext = reinstateHelper(context);
  assert.equal(typeof protectedContext.c, 'function');
  assert.equal(callHelper(protectedContext, undefined, 'fallback'), 'fallback');
});

test('vm scripts keep helper usable after reassignment (if supported)', {
  skip: !reinstateHelper,
}, () => {
  const context = vm.createContext({});
  ensureHelper(context);
  // 在 VM 中把 c 置空再调用，新实现应仍可返回
  const result = new vm.Script('c = null; c("value")').runInContext(context);
  assert.equal(result, 'value');
});

test('createJsRuntime restores helper between sandbox executions', {
  skip: !createJsRuntime,
}, async () => {
  const runtime = createJsRuntime();

  const first = runtime({ sandbox: { __code__: 'c = null; "ok"' } });
  const firstResult = await first.result;
  assert.equal(firstResult, 'ok');
  assert.equal(typeof first.modifiedSandbox.c, 'function');

  const nextSandbox = first.modifiedSandbox;
  nextSandbox.__code__ = 'c(undefined, "fallback")';
  const second = runtime({ sandbox: nextSandbox });
  const secondResult = await second.result;
  assert.equal(secondResult, 'fallback');
  assert.equal(typeof second.modifiedSandbox.c, 'function');
});
