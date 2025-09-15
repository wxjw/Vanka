export const runtime = 'nodejs';

import path from 'node:path';
import {generateDocxBuffer} from '../../../lib/generator.js';
import {getTemplateByKey} from '../../../lib/templates.config.js';

export async function POST(req) {
  try {
    const body = await req.json().catch(()=> ({}));
    const {templateKey, data, meta} = body || {};
    if (!templateKey) {
      return Response.json({ok:false, error:'缺少模板 key'}, {status:400});
    }

    const tpl = getTemplateByKey(templateKey);
    if (!tpl) {
      return Response.json({ok:false, error:`未知模板：${templateKey}`}, {status:400});
    }

    const templatePath = path.resolve(process.cwd(), 'templates', tpl.file);
    const buffer = await generateDocxBuffer({templatePath, payload: data || {}});

    const projectNo = meta?.projectNo || 'NO';
    const docTypeLabel = meta?.docTypeLabel || 'DOC';
    const issueDate = meta?.issueDate || 'DATE';
    const realFileName = `${projectNo}_${docTypeLabel}_${issueDate}.docx`;

    const asciiFallback = realFileName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');

    const cd = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(realFileName)}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': cd,
        'Content-Length': String(buffer.length)
      }
    });
  } catch (err) {
    return Response.json({ok:false, error: String(err?.message || err)}, {status:500});
  }
}
