import {readFile} from 'node:fs/promises';
import {Script, createContext} from 'node:vm';
import JSZip from 'jszip';
import docxTemplates from 'docx-templates';

// 1. 清理重复，只保留一套核心函数

function toSafeString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toSafeString).join('');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return '';
    }
  }
  return String(value);
}

// 模拟的函数，确保它存在
async function normalizeDocxDelimiters(buffer) {
    console.warn('normalizeDocxDelimiters is a stub and does not perform any action.');
    return buffer;
}

const createReport =
  typeof docxTemplates.createReport === 'function'
    ? docxTemplates.createReport
    : docxTemplates.default;

// 2. 清理重复，只保留一套 Helper 和 Sandbox 的实现

const helperFunctions = {
  /**
   * 功能更强大的 c 函数，支持默认值
   */
  c(value, fallback = '', ...rest) {
    const base = toSafeString(
      value == null || value === '' ? fallback : value
    );
    if (!rest.length) return base;
    const tail = rest.map(part => toSafeString(part)).join('');
    return `${base}${tail}`;
  }
};

const helperOverrideKey = Symbol('docgen.helper.c');

function helperGetter() {
  const override = this?.[helperOverrideKey];
  return typeof override === 'function' ? override : helperFunctions.c;
}

function helperSetter(value) {
  if (this && typeof this === 'object') {
    this[helperOverrideKey] = value;
  }
}

function ensureHelper(target) {
  if (!target || typeof target !== 'object') return target;
  if (!Object.prototype.hasOwnProperty.call(target, helperOverrideKey)) {
    Object.defineProperty(target, helperOverrideKey, {
      value: undefined,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
  const descriptor = Object.getOwnPropertyDescriptor(target, 'c');
  const needsInstall = !descriptor || descriptor.get !== helperGetter;
  if (needsInstall) {
    Object.defineProperty(target, 'c', {
      enumerable: true,
      configurable: true,
      get: helperGetter,
      set: helperSetter
    });
  } else if (typeof target[helperOverrideKey] !== 'function') {
    target[helperOverrideKey] = undefined;
  }
  return target;
}

function evaluateSandbox({sandbox, ctx}) {
  if (ctx?.options?.noSandbox) {
    const context = ensureHelper(sandbox);
    const wrapper = new Function('with(this) { return eval(__code__); }');
    return { context, result: wrapper.call(context) };
  }
  const source = typeof sandbox.__code__ === 'string' ? sandbox.__code__ : '';
  const script = new Script(source);
  const context = createContext(ensureHelper(sandbox));
  return { context, result: script.runInContext(context) };
}

function createJsRuntime() {
  return ({sandbox, ctx}) => {
    const {context, result} = evaluateSandbox({sandbox, ctx});
    ensureHelper(context);
    const wrapped = Promise.resolve(result).finally(() => {
      ensureHelper(context);
    });
    return {modifiedSandbox: context, result: wrapped};
  };
}

// 3. 实现了最佳合并策略的核心函数

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);

  // 合并策略：使用安全的 payload 展开，并直接注入功能更强大的 c 函数
  const data = {
    ...(payload || {}),
    c: helperFunctions.c
  };

  const out = await createReport({
    template: normalized,
    data,
    // 保留 cmdDelimiter 配置
    cmdDelimiter: ['{', '}'],
    // 使用简洁的调用方式，无需 additionalJsContext
    runJs: createJsRuntime()
  });
  return Buffer.from(out);
}

// 导出内部函数用于测试
export const __sandboxInternals = {ensureHelper, helperFunctions};