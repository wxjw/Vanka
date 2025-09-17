'use client';

import {useMemo, useState} from 'react';

// 定义流程的各个阶段
const STAGES = {
  FORM: 'form', // 表单填写阶段
  PREVIEW: 'preview', // 预览阶段
  STAMPED: 'stamped' // 盖章后阶段
};

// 定义表单的所有字段
const FORM_FIELDS = [
  {label: '收件人姓名', key: 'recipientName'},
  {label: '确认单编号（项目编号）', key: 'referenceNo'},
  {label: '出具日期', key: 'issueDate', type: 'date'},
  {label: '定金支付截止日期', key: 'payByDate', type: 'date'},
  {label: '定金金额（CNY）', key: 'payAmountCNY'},
  {label: '大写金额', key: 'payAmountUppercase'},
  {label: '联系人姓名', key: 'contactName'},
  {label: '联系人电话', key: 'contactPhone'},
  {label: '联系人邮箱', key: 'contactEmail'},
  {label: '行程信息', key: 'itinerary', multiline: true},
  {label: '限制信息', key: 'restrictions', multiline: true},
  {label: '其他信息', key: 'others', multiline: true},
  {label: '备注', key: 'remark', multiline: true}
];

// 阶段对应的显示文本
const STAGE_LABELS = {
  [STAGES.FORM]: '填写表单',
  [STAGES.PREVIEW]: 'PDF 预览',
  [STAGES.STAMPED]: '盖章与下载'
};

// 根据字段定义生成一个空的表单初始状态
const DEFAULT_FORM = FORM_FIELDS.reduce((acc, field) => {
  acc[field.key] = '';
  return acc;
}, {});

// 主页面组件
export default function ConfirmationPage() {
  const [brand, setBrand] = useState('vanka'); // 品牌状态
  const [form, setForm] = useState(DEFAULT_FORM); // 表单数据状态
  const [stage, setStage] = useState(STAGES.FORM); // 当前阶段状态
  const [previewPdf, setPreviewPdf] = useState(null); // 预览PDF文件状态
  const [stampedPdf, setStampedPdf] = useState(null); // 盖章后PDF文件状态
  const [isGenerating, setIsGenerating] = useState(false); // 是否正在生成中
  const [error, setError] = useState(''); // 错误信息

  // 步骤条的顺序
  const stageOrder = useMemo(() => [STAGES.FORM, STAGES.PREVIEW, STAGES.STAMPED], []);

  // 更新表单字段
  const onChange = (key, value) => {
    setForm(prev => ({...prev, [key]: value}));
  };

  // 更新预览PDF，并管理Blob URL的创建和销毁
  const updatePreviewPdf = blob => {
    setPreviewPdf(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url); // 销毁旧的URL以防内存泄漏
      if (!blob) return null;
      return {blob, url: URL.createObjectURL(blob)};
    });
  };

  // 更新盖章后PDF，逻辑同上
  const updateStampedPdf = blob => {
    setStampedPdf(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      if (!blob) return null;
      return {blob, url: URL.createObjectURL(blob)};
    });
  };

  // 处理生成预览的事件
  const handlePreview = async e => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    try {
      const blob = await Promise.resolve(
        generateConfirmationPdf({form, brand, withStamp: false})
      );
      updatePreviewPdf(blob);
      updateStampedPdf(null); // 清空旧的盖章文件
      setStage(STAGES.PREVIEW); // 进入预览阶段
    } catch (err) {
      console.error(err);
      setError('生成 PDF 预览失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理盖章的事件
  const handleStamp = async () => {
    if (!previewPdf?.blob) return;
    setIsGenerating(true);
    setError('');
    try {
      const blob = await Promise.resolve(
        generateConfirmationPdf({form, brand, withStamp: true})
      );
      updateStampedPdf(blob);
      setStage(STAGES.STAMPED); // 进入盖章阶段
    } catch (err) {
      console.error(err);
      setError('盖章失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 处理下载的事件
  const handleDownload = () => {
    if (!stampedPdf?.url) {
      setError('请先完成盖章生成 PDF。');
      return;
    }
    const link = document.createElement('a');
    link.href = stampedPdf.url;
    const docTypeLabel = brand === 'vanka' ? '确认函-万咖' : '确认函-多吉';
    const issueDate = form.issueDate || new Date().toISOString().slice(0, 10);
    const baseName = form.referenceNo?.trim() || 'confirmation';
    link.download = `${baseName}_${docTypeLabel}_${issueDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // 根据当前阶段决定显示哪个PDF的URL
  const activePdfUrl = stage === STAGES.STAMPED ? stampedPdf?.url : previewPdf?.url;

  return (
    <main>
      <h1>预定信息确认函</h1>

      <section style={{margin: '16px 0 24px'}}>
        <StepIndicator stageOrder={stageOrder} currentStage={stage} />
      </section>

      <div style={{margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center'}}>
        <label htmlFor="brand-select" style={{fontWeight: 600}}>模板品牌：</label>
        <select
          id="brand-select"
          value={brand}
          onChange={e => {
            setBrand(e.target.value);
            // 如果切换品牌，则重置回表单填写阶段
            if (stage !== STAGES.FORM) {
              setStage(STAGES.FORM);
              updatePreviewPdf(null);
              updateStampedPdf(null);
            }
          }}
          style={{padding: '8px 12px', fontSize: 16}}
        >
          <option value="vanka">万咖</option>
          <option value="duoji">多吉</option>
        </select>
      </div>

      <ErrorBanner message={error} />

      {stage === STAGES.FORM && (
        <form onSubmit={handlePreview} style={{maxWidth: 960}}>
          {FORM_FIELDS.map(field => (
            <FieldRow
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={onChange}
            />
          ))}

          <div style={{marginTop: 24, display: 'flex', gap: 12}}>
            <button
              type="submit"
              style={{padding: '12px 20px', fontSize: 16}}
              disabled={isGenerating}
            >
              {isGenerating ? '生成中…' : '生成 PDF 预览'}
            </button>
          </div>
        </form>
      )}

      {stage !== STAGES.FORM && (
        <section style={{marginTop: 32}}>
          <div style={{marginBottom: 16, color: '#444'}}>
            {stage === STAGES.PREVIEW ? '请确认预览（尚未盖章）' : '以下为已盖章的正式 PDF'}
          </div>

          <div style={{border: '1px solid #d0d7de', borderRadius: 6, overflow: 'hidden', background: '#fafafa'}}>
            {activePdfUrl ? (
              <iframe
                title="confirmation-preview"
                src={activePdfUrl}
                style={{width: '100%', minHeight: 720, border: 'none'}}
              />
            ) : (
              <div style={{padding: '48px 24px', textAlign: 'center', color: '#666'}}>
                暂无预览内容
              </div>
            )}
          </div>

          <div style={{marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
            <button
              type="button"
              onClick={() => {
                setStage(STAGES.FORM);
                setError('');
              }}
              style={{padding: '10px 18px', fontSize: 15}}
              disabled={isGenerating}
            >
              返回表单编辑
            </button>

            {stage === STAGES.PREVIEW && (
              <button
                type="button"
                onClick={handleStamp}
                style={{padding: '10px 18px', fontSize: 15}}
                disabled={isGenerating}
              >
                {isGenerating ? '盖章中…' : '盖章'}
              </button>
            )}

            {stage === STAGES.STAMPED && (
              <button
                type="button"
                onClick={handleDownload}
                style={{padding: '10px 18px', fontSize: 15}}
                disabled={isGenerating}
              >
                下载 PDF
              </button>
            )}

            {stage === STAGES.STAMPED && (
              <button
                type="button"
                onClick={() => {
                  setStage(STAGES.PREVIEW);
                  setError('');
                }}
                style={{padding: '10px 18px', fontSize: 15}}
                disabled={isGenerating}
              >
                返回预览
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

// 表单行组件
function FieldRow({field, value, onChange}) {
  const isTextarea = Boolean(field.multiline);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 12,
        alignItems: isTextarea ? 'start' : 'center',
        marginBottom: 14
      }}
    >
      <label style={{fontWeight: 600}} htmlFor={`field-${field.key}`}>
        {field.label}
      </label>
      {isTextarea ? (
        <textarea
          id={`field-${field.key}`}
          rows={5}
          style={{width: '100%', fontSize: 14, padding: 8, resize: 'vertical'}}
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
        />
      ) : (
        <input
          id={`field-${field.key}`}
          type={field.type || 'text'}
          style={{width: '100%', fontSize: 14, padding: 8}}
          value={value}
          onChange={e => onChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
}

// 错误提示条组件
function ErrorBanner({message}) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        margin: '16px 0',
        padding: '12px 16px',
        border: '1px solid #f5c2c7',
        background: '#f8d7da',
        color: '#842029',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12
      }}
    >
      <span style={{fontWeight: 700}}>提示</span>
      <span>{message}</span>
    </div>
  );
}

// 步骤指示器组件
function StepIndicator({stageOrder, currentStage}) {
  return (
    <ol
      style={{
        listStyle: 'none',
        display: 'flex',
        gap: 20,
        padding: 0,
        margin: 0,
        flexWrap: 'wrap'
      }}
    >
      {stageOrder.map((stage, index) => {
        const active = stage === currentStage;
        return (
          <li key={stage} style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active ? '#2563eb' : '#e2e8f0',
                color: active ? '#fff' : '#1f2937',
                fontWeight: 600
              }}
            >
              {index + 1}
            </span>
            <span style={{fontWeight: active ? 700 : 500, color: active ? '#1d4ed8' : '#475569'}}>
              {STAGE_LABELS[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- PDF 生成核心逻辑 ---

// 在浏览器端生成PDF的核心函数
function generateConfirmationPdf({form, brand, withStamp}) {
  if (typeof document === 'undefined') {
    throw new Error('PDF 生成仅在浏览器中可用');
  }
  // 1. 创建Canvas并绘制内容
  const {canvas} = createConfirmationCanvas({form, brand, withStamp});
  // 2. 将Canvas转换为JPEG格式的Data URL
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  // 3. 将Data URL转换为Uint8Array
  const jpegBytes = dataUrlToUint8Array(dataUrl);
  // 4. 将JPEG数据嵌入到一个PDF结构中
  const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  // 5. 返回一个PDF的Blob对象
  return new Blob([pdfBytes], {type: 'application/pdf'});
}

// 创建并绘制包含确认函内容的Canvas
function createConfirmationCanvas({form, brand, withStamp}) {
  const width = 1240; // A4 尺寸像素近似值
  const height = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 绘制背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.textBaseline = 'top';
  
  // 绘制标题
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 54px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText('预定信息确认函', 100, 90);

  // 绘制头部信息
  ctx.font = '26px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`品牌：${brand === 'vanka' ? '万咖' : '多吉'}`, 100, 168);
  const issueDate = form.issueDate || new Date().toISOString().slice(0, 10);
  ctx.fillText(`出具日期：${issueDate}`, 100, 206);
  ctx.fillText(`定金截止：${form.payByDate || '待填写'}`, 100, 244);

  let cursorY = 300; // Y轴绘制指针
  const labelX = 100;
  const valueX = 440;
  const valueWidth = width - valueX - 120;
  const lineHeight = 42;

  // 遍历表单字段并绘制到Canvas上
  FORM_FIELDS.forEach(field => {
    const displayLabel = field.label;
    const rawValue = form[field.key]?.trim() || '';
    const safeValue = rawValue || '—';

    ctx.font = 'bold 28px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(displayLabel, labelX, cursorY);

    ctx.font = '28px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#111827';
    const lines = wrapMultilineText(ctx, safeValue, valueWidth); // 处理自动换行
    const linesToDraw = lines.length === 0 ? ['—'] : lines;

    linesToDraw.forEach((line, idx) => {
      ctx.fillText(line, valueX, cursorY + idx * lineHeight);
    });

    const consumedLines = Math.max(linesToDraw.length, 1);
    cursorY += consumedLines * lineHeight + (field.multiline ? 28 : 18);

    // 绘制分隔线
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(labelX, cursorY - 10);
    ctx.lineTo(width - 100, cursorY - 10);
    ctx.stroke();
  });

  // 绘制页脚
  ctx.font = '24px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('确认函生成于系统，盖章后生效。', 100, height - 200);

  ctx.restore();

  // 如果需要，绘制印章
  if (withStamp) {
    drawStamp(ctx, width, height, brand);
  }

  return {canvas};
}

// 在Canvas上绘制印章
function drawStamp(ctx, width, height, brand) {
  const centerX = width - 280;
  const centerY = height - 320;
  const radius = 150;

  ctx.save();
  ctx.strokeStyle = '#d32f2f';
  ctx.fillStyle = '#d32f2f';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); // 绘制圆形
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 52px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(brand === 'vanka' ? '万咖旅行' : '多吉旅行', centerX, centerY - 18);
  ctx.font = '32px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText('确认专用章', centerX, centerY + 46);
  ctx.textAlign = 'left';
  ctx.restore();
}

// 文本自动换行辅助函数
function wrapMultilineText(ctx, text, maxWidth) {
  const sanitized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = sanitized.split('\n');
  const lines = [];

  paragraphs.forEach(para => {
    if (para === '') {
      lines.push('');
      return;
    }
    let current = '';
    for (const char of Array.from(para)) {
      const next = current + char;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }
  });

  return lines;
}

// Data URL 转 Uint8Array
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// 从JPEG数据构建一个简单的PDF文件
function buildPdfFromJpeg(jpegBytes, widthPx, heightPx) {
  const encoder = new TextEncoder();
  const pdfWidth = 595.28; // A4 页面宽度 (pt)
  const pdfHeight = (pdfWidth * heightPx) / widthPx;

  const chunks = [];
  let offset = 0;
  const offsets = [0];

  const push = chunk => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    offset += bytes.length;
  };

  const writeObject = (id, parts) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n`);
    parts.forEach(push);
    push('endobj\n');
  };

  push('%PDF-1.3\n');
  writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>\n']);
  writeObject(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n']);

  const pageDict = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth.toFixed(2)} ${pdfHeight.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> >>\n`;
  writeObject(3, [pageDict]);

  const contentStream = `q\n${pdfWidth.toFixed(2)} 0 0 ${pdfHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  writeObject(4, [
    `<< /Length ${contentBytes.length} >>\nstream\n`,
    contentBytes,
    '\nendstream\n'
  ]);

  writeObject(5, [
    `<< /Type /XObject /Subtype /Image /Name /Im0 /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    jpegBytes,
    '\nendstream\n'
  ]);

  const xrefOffset = offset;
  const totalObjects = 5;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i += 1) {
    push(`${offsets[i].toString().padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pdfBytes = new Uint8Array(totalLength);
  let pointer = 0;
  chunks.forEach(chunk => {
    pdfBytes.set(chunk, pointer);
    pointer += chunk.length;
  });

  return pdfBytes;
}