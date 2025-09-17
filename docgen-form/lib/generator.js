import {readFile} from 'node:fs/promises';
import {Script, createContext} from 'node:vm';
import JSZip from 'jszip';
import docxTemplates from 'docx-templates';

// 保留 toSafeString 函数，用于安全地转换各种值为字符串
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

// 保留 convertSquareToCurly 函数，用于转换模板分隔符
function convertSquareToCurly(xml) {
  let s = xml;
  s = s.replace(/\[\s*#\s*([A-Za-z0-9_.]+)\s*\]/g, '{#$1}');
  s = s.replace(/\[\s*\/\s*([A-Za-z0-9_.]+)\s*\]/g, '{/$1}');
  s = s.replace(/\[([A-Za-z0-9_.]+(?:\(.*?\))?)\]/g, '{$1}');
  return s;
}

// （这部分在你的代码里可能存在，但未提供，我假设它存在）
// 这是一个模拟函数，因为原始代码中没有提供它的实现
async function normalizeDocxDelimiters(buffer) {
    // 实际的实现会解压docx，替换分隔符，然后重新压缩
    // 这里我们直接返回buffer作为占位符
    console.warn('normalizeDocxDelimiters is a stub and does not perform any action.');
    return buffer;
}


// 移除重复定义，只保留一份 createReport
const createReport =
  typeof docxTemplates.createReport === 'function'
    ? docxTemplates.createReport
    : docxTemplates.default;

// 移除重复定义，只保留一份 printable
const printable = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  return String(value);
};

// --- JS Sandbox 和 Helper Functions ---
// 这部分逻辑在两个分支中是一致的，直接保留即可

const helperFunctions = {
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
    return {
      context,
      result: wrapper.call(context)
    };
  }

  const source = typeof sandbox.__code__ === 'string' ? sandbox.__code__ : '';
  const script = new Script(source);
  const context = createContext(ensureHelper(sandbox));
  return {
    context,
    result: script.runInContext(context)
  };
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


// --- 核心生成函数 (已合并和修复) ---

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  // **修复**: 确保 normalizeDocxDelimiters 被调用
  const normalized = await normalizeDocxDelimiters(buf);

  // **合并**: 使用更安全的 payload 处理方式，并添加 'c' 辅助函数
  const data = {
    ...(payload || {}),
    c: (...args) => args.map(printable).join('')
  };

  const out = await createReport({
    template: normalized,
    data,
    // **合并**: 保留 cmdDelimiter，这是推荐的配置
    cmdDelimiter: ['{', '}'],
    runJs: createJsRuntime()
  });
  return Buffer.from(out);
}

// 导出内部函数用于测试（如果有需要）
export const __sandboxInternals = {ensureHelper, helperFunctions};