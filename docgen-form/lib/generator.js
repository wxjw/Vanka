import {readFile} from 'node:fs/promises';
import {Script, createContext} from 'node:vm';
import JSZip from 'jszip';
import docxTemplates from 'docx-templates';

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

function convertSquareToCurly(xml) {
  let s = xml;
  s = s.replace(/\[\s*#\s*([A-Za-z0-9_.]+)\s*\]/g, '{#$1}');
  s = s.replace(/\[\s*\/\s*([A-Za-z0-9_.]+)\s*\]/g, '{/$1}');
  s = s.replace(/\[([A-Za-z0-9_.]+(?:\(.*?\))?)\]/g, '{$1}');
  return s;
}

async function normalizeDocxDelimiters(docxBuffer) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const files = Object.keys(zip.files).filter(p =>
    /^word\/(document|header\d*|footer\d*|endnotes|footnotes)\.xml$/.test(p)
  );
  for (const p of files) {
    const file = zip.file(p);
    if (!file) continue;
    const xml = await file.async('string');
    zip.file(p, convertSquareToCurly(xml));
  }
  return Buffer.from(await zip.generateAsync({type:'nodebuffer'}));
}

const createReport =
  typeof docxTemplates.createReport === 'function'
    ? docxTemplates.createReport
    : docxTemplates.default;

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

function ensureHelper(target) {
  if (!target || typeof target !== 'object') return target;

  if (typeof target.c !== 'function') {
    Object.defineProperty(target, 'c', {
      value: helperFunctions.c,
      writable: true,
      configurable: true,
      enumerable: true
    });
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

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);

  const data = {
    ...(payload || {})
  };

  if (typeof data.c !== 'function') {
    data.c = helperFunctions.c;
  }

  ensureHelper(data);
  const hadGlobalC = Object.prototype.hasOwnProperty.call(globalThis, 'c');
  const previousGlobalC = globalThis.c;

  Object.defineProperty(globalThis, 'c', {
    value: helperFunctions.c,
    configurable: true,
    writable: true,
    enumerable: false
  });

  try {
    const out = await createReport({
      template: normalized,
      data,
      cmdDelimiter: ['{', '}'],
      additionalJsContext: helperFunctions,
      runJs: createJsRuntime()
    });
    return Buffer.from(out);
  } finally {
    if (!hadGlobalC) {
      delete globalThis.c;
    } else if (globalThis.c !== previousGlobalC) {
      Object.defineProperty(globalThis, 'c', {
        value: previousGlobalC,
        configurable: true,
        writable: true,
        enumerable: false
      });
    }
  }
}

export const __sandboxInternals = {ensureHelper, helperFunctions};
