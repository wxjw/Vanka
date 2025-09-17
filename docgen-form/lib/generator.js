import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import createReport from 'docx-templates';

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

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);
  const contextData = {...(payload || {})};

  if (typeof contextData.c !== 'function') {
    contextData.c = helperFunctions.c;
  }

  const out = await createReport({
    template: normalized,
    data: contextData,
    cmdDelimiter: ['{', '}'],
    additionalJsContext: helperFunctions
  });
  return Buffer.from(out);
}
