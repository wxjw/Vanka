import {readFile} from 'node:fs/promises';
import {Script, createContext} from 'node:vm'; // Resolved conflict 1
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
  return Buffer.from(await zip.generateAsync({type: 'nodebuffer'}));
}

// --- Resolved conflict 2: Using the logic from 'main' branch ---
const createReport =
  typeof docxTemplates.createReport === 'function'
    ? docxTemplates.createReport
    : docxTemplates.default;

const printable = value => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  return String(value);
};

const defaultJsContext = {
  c: (...args) => args.map(printable).join('')
};

function ensureHelper({ctx, sandbox}) {
  const helper = defaultJsContext.c;
  if (ctx && ctx.jsSandbox && ctx.jsSandbox.c !== helper) {
    ctx.jsSandbox.c = helper;
  }
  if (sandbox && sandbox.c !== helper) {
    sandbox.c = helper;
  }
}

// --- Resolved conflict 3: Using the async runtime from 'main' ---
function createJsRuntime() {
  return ({sandbox, ctx}) => {
    const code = sandbox.__code__ ?? '';
    const useNoSandbox = Boolean(ctx?.options?.noSandbox);
    const context = useNoSandbox ? sandbox : createContext(sandbox);
    ensureHelper({ctx, sandbox: context});
    const result = (async () => {
      try {
        if (useNoSandbox) {
          const wrapper = new Function('with(this) { return eval(__code__); }');
          return await wrapper.call(context);
        }
        const script = new Script(code);
        return await script.runInContext(context);
      } catch (error) {
        ensureHelper({ctx, sandbox});
        throw error;
      } finally {
        ensureHelper({ctx, sandbox: context});
      }
    })();
    return {modifiedSandbox: context, result};
  };
}

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);

  // --- Resolved conflict 4: Using the createReport options from 'main' ---
  const out = await createReport({
    template: normalized,
    data: payload || {},
    additionalJsContext: defaultJsContext,
    runJs: createJsRuntime()
  });
  return Buffer.from(out);
}