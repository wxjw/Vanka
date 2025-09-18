// docgen.js
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import JSZip from 'jszip';
import docxTemplates from 'docx-templates';

// ---------- utils ----------

function toSafeString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toSafeString).join('');
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return ''; }
  }
  return String(value);
}

const BRACKET_TOKEN_PATTERN = /\[(#?\/?)([^\]\r\n<]*?)\]/gu;
const IDENTIFIER_SEGMENT_PATTERN = /^[$_\p{ID_Start}][$\u200C\u200D0-9\p{ID_Continue}]*$/u;

function deriveLoopAlias(loopName, activeAliases) {
  let base = loopName.includes('.') ? loopName.split('.').pop() || loopName : loopName;
  if (base.endsWith('ies') && base.length > 3) {
    base = `${base.slice(0, -3)}y`;
  } else if (base.endsWith('ses') && base.length > 3) {
    base = base.slice(0, -2);
  } else if (base.endsWith('s') && base.length > 1) {
    base = base.slice(0, -1);
  }

  base = base.replace(/[^A-Za-z0-9_]/g, '');
  if (!base || !/^[A-Za-z_]/.test(base)) {
    base = 'item';
  }

  let alias = base;
  let suffix = 1;
  while (activeAliases.has(alias)) {
    suffix += 1;
    alias = `${base}${suffix}`;
  }
  activeAliases.add(alias);
  return alias;
}

function releaseLoopAlias(alias, activeAliases) {
  activeAliases.delete(alias);
}

function needsLoopContext(body) {
  return Boolean(body) && !body.includes('.') && !body.includes('-');
}

function accessFromAlias(alias, body) {
  const safeBody = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(body)
    ? `.${body}`
    : `[${JSON.stringify(body)}]`;
  return `$${alias}${safeBody}`;
}

function isIdentifierSegment(value) {
  return IDENTIFIER_SEGMENT_PATTERN.test(value);
}

function toRootExpression(body) {
  if (!body) return body;

  if (!body.includes('.')) {
    return isIdentifierSegment(body) ? body : `this[${JSON.stringify(body)}]`;
  }

  const segments = body.split('.');
  const [head, ...rest] = segments;

  if (!head || !isIdentifierSegment(head)) {
    return `this[${JSON.stringify(body)}]`;
  }

  let expression = head;

  for (const segment of rest) {
    if (!segment) {
      return `this[${JSON.stringify(body)}]`;
    }
    const trimmed = segment.trim();
    if (!trimmed) {
      return `this[${JSON.stringify(body)}]`;
    }
    expression += isIdentifierSegment(trimmed)
      ? `.${trimmed}`
      : `[${JSON.stringify(trimmed)}]`;
  }

  return expression;
}

function rewriteBracketTokens(content) {
  const activeAliases = new Set();
  const loopStack = [];
  let lastIndex = 0;
  let mutated = false;
  let result = '';

  for (const match of content.matchAll(BRACKET_TOKEN_PATTERN)) {
    const [full, prefix, rawBody] = match;
    const index = match.index ?? 0;
    result += content.slice(lastIndex, index);

    const body = rawBody.trim();

    if (!body) {
      result += full;
      lastIndex = index + full.length;
      continue;
    }

    if (prefix === '#') {
      const alias = deriveLoopAlias(body, activeAliases);
      loopStack.push({ name: body, alias });
      result += `{FOR ${alias} IN ${body}}`;
      mutated = true;
    } else if (prefix === '/') {
      const last = loopStack.pop();
      const alias = last?.alias || body;
      if (last) releaseLoopAlias(last.alias, activeAliases);
      result += `{END-FOR ${alias}}`;
      mutated = true;
    } else {
      let replacement;
      if (loopStack.length > 0 && needsLoopContext(body)) {
        const current = loopStack[loopStack.length - 1];
        replacement = `{${accessFromAlias(current.alias, body)}}`;
      } else {
        replacement = `{${toRootExpression(body)}}`;
      }
      result += replacement;
      mutated = true;
    }

    lastIndex = index + full.length;
  }

  if (lastIndex === 0) return { mutated: false, content };

  result += content.slice(lastIndex);
  return { mutated, content: result };
}

async function normalizeDocxDelimiters(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let mutated = false;

  const entries = Object.entries(zip.files);
  for (const [filePath, file] of entries) {
    if (file.dir) continue;
    if (!filePath.toLowerCase().endsWith('.xml')) continue;

    const original = await file.async('string');
    const { mutated: fileMutated, content } = rewriteBracketTokens(original);
    if (fileMutated) {
      zip.file(filePath, content);
      mutated = true;
    }
  }

  if (!mutated) return buffer;

  const normalized = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(normalized);
}

// 兼容 ESM / CJS 的导出形式
const createReport =
  typeof docxTemplates?.createReport === 'function'
    ? docxTemplates.createReport
    : docxTemplates.default;

// ---------- helper + sandbox 安装机制（统一版本） ----------

const helperFunctions = {
  /**
   * 强化版 c：支持默认值与可变尾部拼接
   * 用法：{c foo 'fallback' '-suffix'}
   */
  c(value, fallback = '', ...rest) {
    const base = toSafeString(value == null || value === '' ? fallback : value);
    if (!rest.length) return base;
    const tail = rest.map(toSafeString).join('');
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

/**
 * 为任意目标对象安装 "c" 访问器，并准备 override 存储位
 * - 若原本有自定义的 c 函数，会被保存到 override
 */
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

  const desc = Object.getOwnPropertyDescriptor(target, 'c');
  const needsInstall = !desc || desc.get !== helperGetter;

  if (needsInstall) {
    const existingValue = desc && 'value' in desc ? desc.value : undefined;
    Object.defineProperty(target, 'c', {
      enumerable: true,
      configurable: true,
      get: helperGetter,
      set: helperSetter
    });
    // 若之前存在自定义函数，则作为 override 保存
    if (typeof existingValue === 'function') {
      target[helperOverrideKey] = existingValue;
    } else {
      target[helperOverrideKey] = undefined;
    }
  } else if (typeof target[helperOverrideKey] !== 'function') {
    // 访问器已存在但 override 非函数，则归位为 undefined（使用默认 helper）
    target[helperOverrideKey] = undefined;
  }

  return target;
}

/**
 * 确保目标对象在调用时拥有可用的 c（若 override 不是函数则使用默认）
 */
function reinstateHelper(target) {
  const context = ensureHelper(target);
  if (context && typeof context.c !== 'function') {
    // 通过 override 提供默认实现
    context[helperOverrideKey] = helperFunctions.c;
  }
  return context;
}

function evaluateSandbox({ sandbox, ctx }) {
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
  return ({ sandbox, ctx }) => {
    const { context, result } = evaluateSandbox({ sandbox, ctx });
    const protectedContext = reinstateHelper(context);

    const finalize = () => {
      reinstateHelper(protectedContext);
    };

    const wrapped = Promise.resolve(result)
      .then((v) => { finalize(); return v; }, (e) => { finalize(); throw e; });

    return { modifiedSandbox: protectedContext, result: wrapped };
  };
}

// ---------- 生成 DOCX ----------

export async function generateDocxBuffer({ templatePath, payload }) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);

  // 数据环境：浅克隆后安装/恢复 helper
  const data = reinstateHelper({ ...(payload || {}) });

  // 记录并设置 globalThis 的 c（用于 docx-templates 的 eval 上下文可见性）
  const hadGlobalDesc = Object.prototype.hasOwnProperty.call(globalThis, 'c')
    ? Object.getOwnPropertyDescriptor(globalThis, 'c')
    : undefined;
  const previousOverride = globalThis[helperOverrideKey];

  // 安装访问器版本，保证行为与局部一致（而不是简单赋值 value）
  try {
    ensureHelper(globalThis);
    // 显式指定默认 helper（如有需要用户可在 payload 中自定义覆盖）
    globalThis[helperOverrideKey] = helperFunctions.c;

    const out = await createReport({
      template: normalized,
      data,
      cmdDelimiter: ['{', '}'],
      additionalJsContext: helperFunctions,
      runJs: createJsRuntime()
    });

    return Buffer.from(out);
  } finally {
    // 恢复 globalThis.c
    if (!hadGlobalDesc) {
      // 原先不存在则删除
      try { delete globalThis.c; } catch {}
    } else {
      // 原先存在则按原描述符恢复
      try { Object.defineProperty(globalThis, 'c', hadGlobalDesc); } catch {}
    }

    // 恢复/清理 override 符号位
    if (previousOverride === undefined) {
      try { delete globalThis[helperOverrideKey]; } catch {}
    } else {
      globalThis[helperOverrideKey] = previousOverride;
    }
  }
}

// ---------- 测试需要的内部导出 ----------

export const __sandboxInternals = {
  toSafeString,
  ensureHelper,
  reinstateHelper,
  helperFunctions,
  createJsRuntime,
  rewriteBracketTokens
};
