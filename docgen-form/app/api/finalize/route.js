export const runtime = 'nodejs';

import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';

const DEFAULT_PREVIEW_DIR = process.env.PREVIEW_DIR
  ? path.resolve(process.cwd(), process.env.PREVIEW_DIR)
  : path.resolve(process.cwd(), 'previews');

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return Response.json(
        {ok: false, error: '必须使用 multipart/form-data 上传 PDF 与印章数据'},
        {status: 415}
      );
    }

    const form = await req.formData();

    const placementsRaw =
      form.get('placements') ?? form.get('stampCoords') ?? form.get('coordinates');
    const placements = parsePlacements(placementsRaw);
    if (placements.length === 0) {
      return Response.json(
        {ok: false, error: '缺少印章坐标（placements）信息'},
        {status: 400}
      );
    }

    const stampFile = form.get('stamp') ?? form.get('seal') ?? form.get('image');
    const stampBuffer = await fileToBuffer(stampFile);
    if (!stampBuffer || stampBuffer.length === 0) {
      return Response.json(
        {ok: false, error: '缺少印章图片（PNG/JPG）'},
        {status: 400}
      );
    }

    const previewIdInput = typeof form.get('previewId') === 'string' ? form.get('previewId').trim() : '';
    let pdfBuffer = null;

    if (previewIdInput) {
      if (!/^[A-Za-z0-9_-]+$/.test(previewIdInput)) {
        return Response.json(
          {ok: false, error: 'previewId 只能包含字母、数字、连字符或下划线'},
          {status: 400}
        );
      }
      const previewPath = path.join(DEFAULT_PREVIEW_DIR, `${previewIdInput}.pdf`);
      try {
        pdfBuffer = await readFile(previewPath);
      } catch (err) {
        return Response.json(
          {ok: false, error: `找不到对应的预览文件（${previewIdInput}）`},
          {status: 404}
        );
      }
    }

    if (!pdfBuffer) {
      const pdfFile = form.get('pdf');
      pdfBuffer = await fileToBuffer(pdfFile);
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return Response.json(
        {ok: false, error: '缺少用于加章的 PDF 文件'},
        {status: 400}
      );
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const imageType = detectImageType(stampBuffer);
    const stampImage =
      imageType === 'png'
        ? await pdfDoc.embedPng(stampBuffer)
        : await pdfDoc.embedJpg(stampBuffer);

    const stampBaseDims = stampImage.scale(1);
    const pageCount = pdfDoc.getPageCount();

    placements.forEach((placement, idx) => {
      const pageIndex = resolvePageIndex(placement, pageCount);
      const page = pdfDoc.getPage(pageIndex);
      const dims = resolveDimensions(placement, stampBaseDims);
      if (!Number.isFinite(dims.width) || !Number.isFinite(dims.height) || dims.width <= 0 || dims.height <= 0) {
        throw new Error(`第 ${idx + 1} 组印章尺寸无效`);
      }
      const position = resolvePosition(placement, page, dims);
      page.drawImage(stampImage, {
        x: position.x,
        y: position.y,
        width: dims.width,
        height: dims.height
      });
    });

    const outputBuffer = Buffer.from(await pdfDoc.save());

    const filenameInput = typeof form.get('filename') === 'string' ? form.get('filename').trim() : '';
    const realFileName = ensurePdfExtension(filenameInput || 'sealed.pdf');
    const asciiFallback = createAsciiFallback(realFileName);
    const contentDisposition =
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(realFileName)}`;

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition,
        'Content-Length': String(outputBuffer.length),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Finalize PDF failed', error);
    return Response.json(
      {ok: false, error: error?.message || '处理 PDF 时发生未知错误'},
      {status: 500}
    );
  }
}

function parsePlacements(raw) {
  if (raw == null) return [];
  let value = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
    } catch (err) {
      throw new Error('无法解析印章坐标 JSON');
    }
  }
  const list = Array.isArray(value) ? value : [value];
  return list.filter(item => item && typeof item === 'object');
}

async function fileToBuffer(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  const arr = await file.arrayBuffer();
  return Buffer.from(arr);
}

function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return 'jpg';
  }
  throw new Error('仅支持 PNG 或 JPG 印章图片');
}

function resolvePageIndex(placement, pageCount) {
  const fromIndex = toNumber(
    placement.page ?? placement.pageIndex ?? placement.pageNo ?? placement.page_id ?? placement.pageIdx
  );
  const fromNumber = toNumber(placement.pageNumber ?? placement.pageNoHuman);

  let index = Number.isFinite(fromIndex)
    ? Math.trunc(fromIndex)
    : Number.isFinite(fromNumber)
      ? Math.trunc(fromNumber - 1)
      : 0;

  if (!Number.isInteger(index)) index = 0;

  if (index < 0 || index >= pageCount) {
    throw new Error(`指定的页码超出范围（共有 ${pageCount} 页）`);
  }
  return index;
}

function resolveDimensions(placement, baseDims) {
  const baseWidth = baseDims.width;
  const baseHeight = baseDims.height;

  let width = toNumber(placement.width ?? placement.w);
  let height = toNumber(placement.height ?? placement.h);
  const scale = toNumber(placement.scale);

  if (Number.isFinite(width) && !Number.isFinite(height)) {
    height = baseHeight * (width / baseWidth);
  } else if (!Number.isFinite(width) && Number.isFinite(height)) {
    width = baseWidth * (height / baseHeight);
  } else if (!Number.isFinite(width) && !Number.isFinite(height)) {
    width = baseWidth;
    height = baseHeight;
  }

  if (Number.isFinite(scale) && scale > 0) {
    width *= scale;
    height *= scale;
  }

  return {width, height};
}

function resolvePosition(placement, page, dims) {
  const origin = typeof placement.origin === 'string' ? placement.origin.toLowerCase() : '';

  const xValue = firstNumber(placement.x, placement.left, placement.l, placement.posX);
  let x = Number.isFinite(xValue) ? xValue : NaN;
  if (!Number.isFinite(x)) {
    const centerX = toNumber(placement.centerX ?? placement.cx);
    if (Number.isFinite(centerX)) {
      x = centerX - dims.width / 2;
    }
  }
  if (!Number.isFinite(x)) {
    throw new Error('印章坐标缺少 x 值');
  }

  const bottomValue = firstNumber(placement.y, placement.bottom, placement.b, placement.posY);
  const topValue = toNumber(placement.top ?? placement.t);
  let y = NaN;

  if (Number.isFinite(bottomValue)) {
    if (origin === 'top-left') {
      y = page.getHeight() - bottomValue - dims.height;
    } else {
      y = bottomValue;
    }
  }

  if (!Number.isFinite(y) && Number.isFinite(topValue)) {
    y = page.getHeight() - topValue - dims.height;
  }

  if (!Number.isFinite(y)) {
    const centerY = toNumber(placement.centerY ?? placement.cy);
    if (Number.isFinite(centerY)) {
      y = centerY - dims.height / 2;
    }
  }

  if (!Number.isFinite(y)) {
    throw new Error('印章坐标缺少 y 值');
  }

  return {x, y};
}

function firstNumber(...values) {
  for (const v of values) {
    const num = toNumber(v);
    if (Number.isFinite(num)) return num;
  }
  return NaN;
}

function toNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }
  return NaN;
}

function ensurePdfExtension(name) {
  const sanitized = sanitizeFileName(name || '');
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    return `${sanitized}.pdf`;
  }
  return sanitized || 'sealed.pdf';
}

function sanitizeFileName(name) {
  if (!name) return 'sealed.pdf';
  const replaced = name.replace(/[\\/:*?"<>|]/g, '_');
  return replaced.trim() || 'sealed.pdf';
}

function createAsciiFallback(name) {
  return name
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}
