import {readFile} from 'node:fs/promises';
import {Script, createContext} from 'node:vm';
import JSZip from 'jszip';
import docxTemplates from 'docx-templates';

// ... (toSafeString, convertSquareToCurly, normalizeDocxDelimiters 函数保持不变)

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

// 移除 defaultJsContext

// ... (ensureHelper 和 createJsRuntime 函数保持不变)

export async function generateDocxBuffer({templatePath, payload}) {
  const buf = await readFile(templatePath);
  const normalized = await normalizeDocxDelimiters(buf);

  // 将 c 函数添加到 data payload 中
  const data = {
    ...payload,
    c: (...args) => args.map(printable).join('')
  };

  const out = await createReport({
    template: normalized,
    data: data, // 使用更新后的 data
    // additionalJsContext 不再需要
    runJs: createJsRuntime()
  });
  return Buffer.from(out);
}
