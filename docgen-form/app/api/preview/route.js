export const runtime = 'nodejs';

import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {generateDocxBuffer} from '../../../lib/generator.js';
import {getTemplateByKey} from '../../../lib/templates.config.js';

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {stdio: 'ignore'});
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });
}

async function convertDocxToPdf(docxBuffer) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'docx-preview-'));
  const docxPath = path.join(tmpDir, `${randomUUID()}.docx`);
  const pdfPath = docxPath.replace(/\.docx$/, '.pdf');
  try {
    await writeFile(docxPath, docxBuffer);

    const commands = ['libreoffice', 'soffice', 'lowriter'];
    let lastError = null;
    for (const cmd of commands) {
      try {
        await rm(pdfPath, {force: true}).catch(() => {});
        await runCommand(cmd, [
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          tmpDir,
          docxPath
        ]);
        const pdfBuffer = await readFile(pdfPath).catch(() => null);
        if (pdfBuffer) {
          return pdfBuffer;
        }
      } catch (err) {
        lastError = err;
        if (err?.code === 'ENOENT') {
          continue;
        }
        break;
      }
    }
    if (lastError) {
      throw new Error(`無法將 DOCX 轉為 PDF：${lastError.message}`);
    }
    throw new Error('無法將 DOCX 轉為 PDF。');
  } finally {
    await rm(tmpDir, {recursive: true, force: true});
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {templateKey, data, meta} = body || {};
    if (!templateKey) {
      return Response.json({ok: false, error: '缺少模板 key'}, {status: 400});
    }

    const tpl = getTemplateByKey(templateKey);
    if (!tpl) {
      return Response.json({ok: false, error: `未知模板：${templateKey}`}, {status: 400});
    }

    const templatePath = path.resolve(process.cwd(), 'templates', tpl.file);
    const docxBuffer = await generateDocxBuffer({templatePath, payload: data || {}});
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    const projectNo = meta?.projectNo || 'NO';
    const docTypeLabel = meta?.docTypeLabel || 'DOC';
    const issueDate = meta?.issueDate || 'DATE';
    const realFileName = `${projectNo}_${docTypeLabel}_${issueDate}.pdf`;

    const asciiFallback = realFileName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');

    const cd = `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(realFileName)}`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': cd,
        'Content-Length': String(pdfBuffer.length)
      }
    });
  } catch (err) {
    return Response.json({ok: false, error: String(err?.message || err)}, {status: 500});
  }
}
