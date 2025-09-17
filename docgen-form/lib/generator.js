import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import createReport from 'docx-templates';

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

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);
  const out = await createReport({
    template: normalized,
    data: payload || {},
    additionalJsContext: defaultJsContext
  });
  return Buffer.from(out);
}
