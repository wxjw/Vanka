'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import styles from '../formStyles.module.css';

/** =========================
 *  常量 & 类型
 *  ========================= */
const STAGES = {
  FORM: 'form',
  PREVIEW: 'preview',
  STAMPED: 'stamped'
} as const;

const FORM_FIELDS = [
  {label: '收件人姓名', key: 'recipientName', placeholder: '请输入收件人姓名'},
  {label: '确认单编号（项目编号）', key: 'referenceNo', placeholder: '如：VK-2024-001'},
  {label: '出具日期', key: 'issueDate', type: 'date'},
  {label: '定金支付截止日期', key: 'payByDate', type: 'date'},
  {label: '定金金额（CNY）', key: 'payAmountCNY', placeholder: '例如：3000'},
  {label: '大写金额', key: 'payAmountUppercase', placeholder: '例如：叁仟元整'},
  {label: '联系人姓名', key: 'contactName'},
  {label: '联系人电话', key: 'contactPhone'},
  {label: '联系人邮箱', key: 'contactEmail', type: 'email'},
  {label: '行程信息', key: 'itinerary', multiline: true, placeholder: '示例：2024/08/18-2024/08/21 西藏行程…'},
  {label: '限制信息', key: 'restrictions', multiline: true, placeholder: '例如：机票不可退改、需提前确认…'},
  {label: '其他信息', key: 'others', multiline: true, placeholder: '可填写额外说明'},
  {label: '备注', key: 'remark', multiline: true, placeholder: '填写内部备注或补充信息'}
] as const;

const STAGE_LABELS: Record<(typeof STAGES)[keyof typeof STAGES], string> = {
  [STAGES.FORM]: '填写表单',
  [STAGES.PREVIEW]: 'PDF 预览',
  [STAGES.STAMPED]: '盖章与下载'
};

const DEFAULT_FORM = FORM_FIELDS.reduce((acc, f) => (acc[f.key] = '', acc), {} as Record<string, string>);

// 预览显示宽度（像素）；高度以 A4 比例适配
const PREVIEW_MAX_WIDTH = 900;
// 画布像素（A4 近似像素）
const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 1754;

// 章大小（预览层，以 px 表示）——PDF 会按比例严格匹配
const STAMP_SIZE_MIN = 80;
const STAMP_SIZE_MAX = 240;
const STAMP_SIZE_DEFAULT = 160;

// 旋转角度（度数）
const ROTATE_MIN = -90;
const ROTATE_MAX = 90;
const ROTATE_DEFAULT = 0;

type StampImageMeta = {
  url: string;           // objectURL 或同源路径
  naturalW: number;
  naturalH: number;
};

/** =========================
 *  页面组件
 *  ========================= */
export default function ConfirmationPage() {
  const [brand, setBrand] = useState<'vanka' | 'duoji'>('vanka');
  const [form, setForm] = useState<Record<string, string>>(DEFAULT_FORM);
  const [stage, setStage] = useState<string>(STAGES.FORM);
  const [previewPdf, setPreviewPdf] = useState<{blob: Blob; url: string} | null>(null);
  const [stampedPdf, setStampedPdf] = useState<{blob: Blob; url: string} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  // 预览图（无章）
  const [previewImgUrl, setPreviewImgUrl] = useState<string>('');
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const [previewBoxSize, setPreviewBoxSize] = useState<{w: number; h: number}>({w: 0, h: 0});

  // 外部章图（可选）
  const [stampImg, setStampImg] = useState<StampImageMeta | null>(null);

  // 印章中心点归一化坐标（0~1）
  const [stampNorm, setStampNorm] = useState<{x: number; y: number}>({x: 0.78, y: 0.82});
  // 章大小（预览层）
  const [stampSize, setStampSize] = useState<number>(STAMP_SIZE_DEFAULT);
  // 旋转角度（度）
  const [stampRotateDeg, setStampRotateDeg] = useState<number>(ROTATE_DEFAULT);

  // 拖拽状态
  const draggingRef = useRef(false);
  const pointerOffsetRef = useRef<{dx: number; dy: number}>({dx: 0, dy: 0});

  const stageOrder = useMemo(() => [STAGES.FORM, STAGES.PREVIEW, STAGES.STAMPED], []);

  // 监听预览容器尺寸（自适应宽度）
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const resize = () => {
      const w = Math.min(el.clientWidth, PREVIEW_MAX_WIDTH);
      const ratio = CANVAS_HEIGHT / CANVAS_WIDTH;
      setPreviewBoxSize({w, h: Math.round(w * ratio)});
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // 卸载清理 objectURL
  useEffect(() => {
    return () => {
      revokeUrl(previewPdf);
      revokeUrl(stampedPdf);
      if (previewImgUrl?.startsWith('blob:')) URL.revokeObjectURL(previewImgUrl);
      if (stampImg?.url?.startsWith('blob:')) URL.revokeObjectURL(stampImg.url);
    };
  }, [previewPdf, stampedPdf, previewImgUrl, stampImg]);

  const onChange = (key: string, value: string) => setForm(prev => ({...prev, [key]: value}));

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBrand(e.target.value as 'vanka' | 'duoji');
    if (stage !== STAGES.FORM) {
      setStage(STAGES.FORM);
      setError('');
      revokeUrl(previewPdf);
      revokeUrl(stampedPdf);
      setPreviewPdf(null);
      setStampedPdf(null);
      cleanupPreviewImage();
    }
  };

  // 章图上传（SVG/PNG/JPG/WebP）
  const onPickStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const meta = await loadImageMeta(url);
      if (stampImg?.url?.startsWith('blob:')) URL.revokeObjectURL(stampImg.url);
      setStampImg({url, naturalW: meta.naturalW, naturalH: meta.naturalH});
    } catch (err) {
      console.error(err);
      URL.revokeObjectURL(url);
      setError('章图加载失败，请换一张（需同源或开启 CORS）。');
    } finally {
      e.target.value = ''; // 允许重复选择同一文件
    }
  };

  const cleanupPreviewImage = () => {
    if (previewImgUrl && previewImgUrl.startsWith('blob:')) URL.revokeObjectURL(previewImgUrl);
    setPreviewImgUrl('');
  };

  const updatePreviewPdf = (blob: Blob | null) => {
    revokeUrl(previewPdf);
    if (!blob) return setPreviewPdf(null);
    setPreviewPdf({blob, url: URL.createObjectURL(blob)});
  };

  const updateStampedPdf = (blob: Blob | null) => {
    revokeUrl(stampedPdf);
    if (!blob) return setStampedPdf(null);
    setStampedPdf({blob, url: URL.createObjectURL(blob)});
  };

  // 生成无章的预览图片 + 无章 PDF
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');

    try {
      const {canvas} = createConfirmationCanvas({form, brand, withStamp: false});
      const url = canvas.toDataURL('image/png', 0.92);
      cleanupPreviewImage();
      setPreviewImgUrl(url);

      const pdfBlob = generateConfirmationPdf({form, brand, withStamp: false});
      updatePreviewPdf(pdfBlob);
      setStage(STAGES.PREVIEW);
    } catch (err) {
      console.error(err);
      setError('生成 PDF 预览失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 盖章：按预览→画布比例烘焙（位置、大小、旋转完全匹配）
  const handleStamp = async () => {
    if (!previewImgUrl) return;
    setIsGenerating(true);
    setError('');

    try {
      const scale = CANVAS_WIDTH / Math.max(1, previewBoxSize.w);
      const centerCanvasX = stampNorm.x * CANVAS_WIDTH;
      const centerCanvasY = stampNorm.y * CANVAS_HEIGHT;

      const pdfBlob = generateConfirmationPdf({
        form,
        brand,
        withStamp: true,
        stampCenter: {x: centerCanvasX, y: centerCanvasY},
        previewToCanvasScale: scale,
        stampImg,
        previewStampSize: stampSize,
        stampRotateDeg
      });
      updateStampedPdf(pdfBlob);
      setStage(STAGES.STAMPED);
    } catch (err) {
      console.error(err);
      setError('盖章失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    const file = stampedPdf ?? previewPdf;
    if (!file?.url) {
      setError('请先完成生成或盖章。');
      return;
    }
    const docTypeLabel = brand === 'vanka' ? '确认函-万咖' : '确认函-多吉';
    const issueDate = form.issueDate || new Date().toISOString().slice(0, 10);
    const baseName = (form.referenceNo || 'confirmation').trim();
    const a = document.createElement('a');
    a.href = file.url;
    a.download = `${baseName}_${docTypeLabel}_${issueDate}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const resetStamp = () => setStampNorm({x: 0.78, y: 0.82});

  // 拖拽
  const onStampPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = previewBoxRef.current;
    if (!box) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const rect = box.getBoundingClientRect();
    const {left: curLeft, top: curTop} = stampLeftTopFromNorm(stampNorm, previewBoxSize, stampSize);
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    pointerOffsetRef.current = {dx: px - curLeft, dy: py - curTop};
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const box = previewBoxRef.current;
    if (!box) return;

    const rect = box.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    let left = px - pointerOffsetRef.current.dx;
    let top = py - pointerOffsetRef.current.dy;
    const maxLeft = Math.max(0, previewBoxSize.w - stampSize);
    const maxTop = Math.max(0, previewBoxSize.h - stampSize);
    left = clamp(left, 0, maxLeft);
    top = clamp(top, 0, maxTop);

    const centerX = left + stampSize / 2;
    const centerY = top + stampSize / 2;
    setStampNorm({x: centerX / previewBoxSize.w, y: centerY / previewBoxSize.h});
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const activePdfUrl = stage === STAGES.STAMPED ? stampedPdf?.url : previewPdf?.url;
  const hasPreview = Boolean(previewPdf);
  const {left, top} = stampLeftTopFromNorm(stampNorm, previewBoxSize, stampSize);

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>预定信息确认函</h1>

      <section style={{margin: '16px 0 24px'}}>
        <StepIndicator stageOrder={stageOrder} currentStage={stage} />
      </section>

      {/* 工具条：品牌、章图、章大小、旋转角度 */}
      <div
        className={styles.brandSelector}
        style={{marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap'}}
      >
        <span className={styles.fieldLabel}>模板品牌</span>
        <select className={styles.selectControl} value={brand} onChange={handleBrandChange}>
          <option value="vanka">万咖</option>
          <option value="duoji">多吉</option>
        </select>

        {/* 章图上传（可选） */}
        <label className={styles.fieldLabel} style={{marginLeft: 12}}>章图（SVG/PNG/JPG）</label>
        <input
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          onChange={onPickStamp}
          className={styles.textControl}
          style={{maxWidth: 280}}
        />
        {stampImg && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (stampImg.url.startsWith('blob:')) URL.revokeObjectURL(stampImg.url);
              setStampImg(null);
            }}
          >
            清除章图
          </button>
        )}

        {/* 章大小滑杆 */}
        <label className={styles.fieldLabel} style={{marginLeft: 12}}>章大小</label>
        <input
          type="range"
          min={STAMP_SIZE_MIN}
          max={STAMP_SIZE_MAX}
          value={stampSize}
          onChange={e => setStampSize(Number(e.target.value))}
        />
        <span style={{fontSize: 12, color: '#64748b'}}>{stampSize}px</span>

        {/* 旋转角度滑杆 */}
        <label className={styles.fieldLabel} style={{marginLeft: 12}}>旋转角度</label>
        <input
          type="range"
          min={ROTATE_MIN}
          max={ROTATE_MAX}
          value={stampRotateDeg}
          onChange={e => setStampRotateDeg(Number(e.target.value))}
        />
        <span style={{fontSize: 12, color: '#64748b'}}>{stampRotateDeg}°</span>
      </div>

      {error && <ErrorBanner message={error} />}

      {stage === STAGES.FORM ? (
        <div className={styles.layout}>
          {/* 左侧表单 */}
          <form onSubmit={handlePreview} className={`${styles.card} ${styles.formCard}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>填写确认函信息</h2>
              <p className={styles.sectionHint}>请根据业务需求完整填写，右侧将即时同步预览效果。</p>
            </div>

            <section className={styles.fieldGrid}>
              {FORM_FIELDS.map(field => (
                <FormField
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  onChange={onChange}
                />
              ))}
            </section>

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.primaryButton} disabled={isGenerating}>
                {isGenerating ? '生成中…' : hasPreview ? '重新生成 PDF 预览' : '生成 PDF 预览'}
              </button>
            </div>
          </form>

          {/* 右侧即时预览（文字预览） */}
          <aside className={`${styles.card} ${styles.previewCard}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>即时预览</h2>
              <p className={styles.sectionHint}>实时核对填写内容，确认无误后生成文档。</p>
            </div>

            <div className={styles.previewGroup}>
              <section className={styles.previewSection}>
                <h3 className={styles.previewSectionTitle}>基础信息</h3>
                {previewRow('收件人姓名', form.recipientName)}
                {previewRow('确认单编号', form.referenceNo)}
                {previewRow('出具日期', form.issueDate)}
                {previewRow('定金支付截止日期', form.payByDate)}
                {previewRow('定金金额（CNY）', form.payAmountCNY)}
                {previewRow('金额大写', form.payAmountUppercase)}
              </section>

              <section className={styles.previewSection}>
                <h3 className={styles.previewSectionTitle}>联系人</h3>
                {previewRow('姓名', form.contactName)}
                {previewRow('电话', form.contactPhone)}
                {previewRow('邮箱', form.contactEmail)}
              </section>

              <section className={styles.previewSection}>
                <h3 className={styles.previewSectionTitle}>详细信息</h3>
                {previewRow('行程信息', form.itinerary)}
                {previewRow('限制信息', form.restrictions)}
                {previewRow('其他信息', form.others)}
                {previewRow('备注', form.remark)}
                {previewRow('品牌模板', brand === 'vanka' ? '万咖' : '多吉')}
              </section>
            </div>
          </aside>
        </div>
      ) : (
        <section className={`${styles.card} ${styles.formCard}`} style={{marginTop: 24}}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {stage === STAGES.PREVIEW ? '拖拽盖章位置并预览' : '盖章与下载'}
            </h2>
            <p className={styles.sectionHint}>
              {stage === STAGES.PREVIEW
                ? '在预览图上拖拽印章到合适位置（可调大小与角度），然后点击“盖章”生成正式 PDF。'
                : '已完成盖章，可下载正式 PDF，或返回修改。'}
            </p>
          </div>

          {stage === STAGES.PREVIEW ? (
            <>
              <div
                ref={previewBoxRef}
                style={{
                  border: '1px solid #d0d7de',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#f8fafc',
                  marginBottom: 12,
                  position: 'relative',
                  width: '100%',
                  maxWidth: PREVIEW_MAX_WIDTH,
                  height: previewBoxSize.h
                }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {previewImgUrl ? (
                  <>
                    <img
                      src={previewImgUrl}
                      alt="预览"
                      style={{
                        display: 'block',
                        width: '100%',
                        maxWidth: PREVIEW_MAX_WIDTH,
                        height: '100%',
                        objectFit: 'contain',
                        userSelect: 'none',
                        pointerEvents: 'none'
                      }}
                      draggable={false}
                    />

                    {/* 外层：定位与拖拽命中，不旋转 */}
                    <div
                      role="button"
                      aria-label="Drag stamp"
                      onPointerDown={onStampPointerDown}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: stampSize,
                        height: stampSize,
                        cursor: 'grab',
                        touchAction: 'none',
                        userSelect: 'none'
                      }}
                    >
                      {/* 内层：真正显示章内容并旋转 */}
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          background: stampImg
                            ? '#fff'
                            : 'radial-gradient(transparent 55%, rgba(211,47,47,0.08) 56%, rgba(211,47,47,0.12) 60%), #fff',
                          border: '8px solid #d32f2f',
                          color: '#d32f2f',
                          fontWeight: 800,
                          fontSize: 16,
                          letterSpacing: 2,
                          textAlign: 'center',
                          lineHeight: 1.2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: `rotate(${stampRotateDeg}deg)`,
                          transformOrigin: '50% 50%'
                        }}
                      >
                        {stampImg ? (
                          <img
                            src={stampImg.url}
                            alt="章图"
                            style={{width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none'}}
                            draggable={false}
                          />
                        ) : (
                          <>
                            {brand === 'vanka' ? '万咖旅行' : '多吉旅行'}
                            <br />
                            确认专用章
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{padding: 48, textAlign: 'center', color: '#64748b'}}>暂无预览内容</div>
                )}
              </div>

              <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                <button type="button" className={styles.primaryButton} style={{padding: '12px 22px'}} onClick={resetStamp} disabled={isGenerating}>
                  复位印章
                </button>
                <button type="button" className={styles.primaryButton} style={{padding: '12px 22px'}} onClick={handleStamp} disabled={isGenerating}>
                  {isGenerating ? '盖章中…' : '盖章'}
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  style={{padding: '12px 22px'}}
                  onClick={() => {
                    setStage(STAGES.FORM);
                    setError('');
                  }}
                  disabled={isGenerating}
                >
                  返回表单编辑
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{border: '1px solid #d0d7de', borderRadius: 12, overflow: 'hidden', background: '#f8fafc'}}>
                {activePdfUrl ? (
                  <iframe title="confirmation-preview" src={activePdfUrl} style={{width: '100%', minHeight: 720, border: 'none'}} />
                ) : (
                  <div style={{padding: '48px 24px', textAlign: 'center', color: '#64748b'}}>暂无预览内容</div>
                )}
              </div>

              <div style={{marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                <button type="button" className={styles.primaryButton} style={{padding: '12px 22px'}} onClick={handleDownload} disabled={isGenerating}>
                  下载 PDF
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  style={{padding: '12px 22px'}}
                  onClick={() => {
                    setStage(STAGES.PREVIEW);
                    setError('');
                  }}
                  disabled={isGenerating}
                >
                  返回预览
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}

/** =========================
 *  子组件
 *  ========================= */
function FormField({field, value, onChange}: any) {
  const inputProps = {
    className: styles.textControl,
    placeholder: field.placeholder || '',
    value: value || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(field.key, e.target.value)
  };

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={`field-${field.key}`}>
        {field.label}
      </label>
      {field.multiline ? (
        <textarea {...(inputProps as any)} id={`field-${field.key}`} rows={4} />
      ) : (
        <input {...(inputProps as any)} id={`field-${field.key}`} type={field.type || 'text'} />
      )}
    </div>
  );
}

function previewRow(label: string, value: any) {
  const display = value == null ? '' : typeof value === 'string' ? value : String(value);
  const content = display.trim() ? display : '—';
  return (
    <div className={styles.previewItem}>
      <div className={styles.previewLabel}>{label}</div>
      <div className={styles.previewValue}>{content}</div>
    </div>
  );
}

function ErrorBanner({message}: {message: string}) {
  if (!message) return null;
  return (
    <div role="alert" aria-live="assertive" className={styles.errorBanner}>
      <strong style={{marginRight: 8}}>提示</strong>
      <span>{message}</span>
    </div>
  );
}

function StepIndicator({stageOrder, currentStage}: {stageOrder: string[]; currentStage: string}) {
  return (
    <ol style={{listStyle: 'none', display: 'flex', gap: 20, padding: 0, margin: 0, flexWrap: 'wrap'}}>
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
            <span style={{fontWeight: active ? 700 : 500, color: active ? '#1d4ed8' : '#475569'}}>{STAGE_LABELS[stage]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** =========================
 *  PDF 生成核心逻辑（前端纯生成）
 *  ========================= */
function generateConfirmationPdf({
  form,
  brand,
  withStamp,
  stampCenter,
  previewToCanvasScale = 1,
  stampImg,
  previewStampSize,
  stampRotateDeg = 0
}: {
  form: Record<string, string>;
  brand: 'vanka' | 'duoji';
  withStamp: boolean;
  stampCenter?: {x: number; y: number}; // 画布坐标（像素，中心点）
  previewToCanvasScale?: number;        // 预览→画布比例
  stampImg?: StampImageMeta | null;     // 外部章图
  previewStampSize?: number;            // 预览层的章大小（px）
  stampRotateDeg?: number;              // 旋转角度（deg）
}) {
  if (typeof document === 'undefined') throw new Error('PDF 生成仅在浏览器中可用');
  const {canvas} = createConfirmationCanvas({
    form, brand, withStamp, stampCenter, previewToCanvasScale, stampImg, previewStampSize, stampRotateDeg
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBytes = dataUrlToUint8Array(dataUrl);
  const pdfBytes = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  return new Blob([pdfBytes], {type: 'application/pdf'});
}

function createConfirmationCanvas({
  form,
  brand,
  withStamp,
  stampCenter,
  previewToCanvasScale = 1,
  stampImg,
  previewStampSize = STAMP_SIZE_DEFAULT,
  stampRotateDeg = 0
}: {
  form: Record<string, string>;
  brand: 'vanka' | 'duoji';
  withStamp: boolean;
  stampCenter?: {x: number; y: number};
  previewToCanvasScale?: number;
  stampImg?: StampImageMeta | null;
  previewStampSize?: number;
  stampRotateDeg?: number;
}) {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.textBaseline = 'top';

  // 标题
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 54px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
  ctx.fillText('预定信息确认函', 100, 90);

  // 头部信息
  ctx.font = '26px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
  ctx.fillStyle = '#334155';
  const issueDate = form.issueDate || new Date().toISOString().slice(0, 10);
  ctx.fillText(`品牌：${brand === 'vanka' ? '万咖' : '多吉'}`, 100, 168);
  ctx.fillText(`出具日期：${issueDate}`, 100, 206);
  ctx.fillText(`定金截止：${form.payByDate || '待填写'}`, 100, 244);

  let cursorY = 300;
  const labelX = 100;
  const valueX = 440;
  const valueWidth = width - valueX - 120;
  const lineHeight = 42;

  FORM_FIELDS.forEach(field => {
    const displayLabel = field.label;
    const rawValue = (form[field.key] || '').trim();
    const safeValue = rawValue || '—';

    ctx.font = 'bold 28px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(displayLabel, labelX, cursorY);

    ctx.font = '28px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
    ctx.fillStyle = '#111827';
    const lines = wrapMultilineText(ctx, safeValue, valueWidth);
    (lines.length ? lines : ['—']).forEach((line, idx) => {
      ctx.fillText(line, valueX, cursorY + idx * lineHeight);
    });

    const consumedLines = Math.max(lines.length, 1);
    cursorY += consumedLines * lineHeight + (field.multiline ? 28 : 18);

    // 分隔线
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(labelX, cursorY - 10);
    ctx.lineTo(width - 100, cursorY - 10);
    ctx.stroke();
  });

  // 页脚
  ctx.font = '24px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('确认函生成于系统，盖章后生效。', 100, height - 200);

  ctx.restore();

  // 绘制印章（可选）
  if (withStamp) {
    const center = stampCenter ?? {x: width - 280, y: height - 320};
    const targetBoxSize = (previewStampSize ?? STAMP_SIZE_DEFAULT) * previewToCanvasScale;
    const rad = (stampRotateDeg * Math.PI) / 180;

    if (stampImg) {
      // 图片章：等比 contain 到 targetBoxSize
      const ar = stampImg.naturalW / stampImg.naturalH || 1;
      let drawW = targetBoxSize;
      let drawH = targetBoxSize;
      if (ar >= 1) {
        drawH = targetBoxSize / ar;
      } else {
        drawW = targetBoxSize * ar;
      }

      const img = new Image();
      img.src = stampImg.url;
      try {
        ctx.save();
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(center.x, center.y);
        ctx.rotate(rad);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      } catch {
        drawFallbackStamp(ctx, center.x, center.y, targetBoxSize, brand, rad);
      }
    } else {
      drawFallbackStamp(ctx, center.x, center.y, targetBoxSize, brand, rad);
    }
  }

  return {canvas};
}

/** 文字章兜底（支持旋转；以 targetBoxSize 做等比设计） */
function drawFallbackStamp(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  targetBoxSize: number,
  brand: 'vanka' | 'duoji',
  rad: number = 0
) {
  const radius = targetBoxSize * 0.47;
  const lineWidth = Math.max(2, Math.round(targetBoxSize * 0.05));

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rad);

  ctx.strokeStyle = '#d32f2f';
  ctx.fillStyle = '#d32f2f';
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(targetBoxSize * 0.32)}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
  ctx.fillText(brand === 'vanka' ? '万咖旅行' : '多吉旅行', 0, -targetBoxSize * 0.11);
  ctx.font = `${Math.round(targetBoxSize * 0.20)}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
  ctx.fillText('确认专用章', 0, targetBoxSize * 0.14);

  ctx.restore();
}

/** =========================
 *  工具函数
 *  ========================= */
function wrapMultilineText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const sanitized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = sanitized.split('\n');
  const lines: string[] = [];

  paragraphs.forEach(para => {
    if (para === '') {
      lines.push('');
      return;
    }
    let current = '';
    for (const ch of Array.from(para)) {
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  });

  return lines;
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildPdfFromJpeg(jpegBytes: Uint8Array, widthPx: number, heightPx: number) {
  const encoder = new TextEncoder();
  const pdfWidth = 595.28; // A4 宽 (pt)
  const pdfHeight = (pdfWidth * heightPx) / widthPx;

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [0];

  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    chunks.push(bytes);
    offset += bytes.length;
  };

  const writeObject = (id: number, parts: (string | Uint8Array)[]) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n`);
    parts.forEach(push);
    push('endobj\n');
  };

  push('%PDF-1.3\n');
  writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>\n']);
  writeObject(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n']);

  const pageDict = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth.toFixed(2)} ${pdfHeight.toFixed(
    2
  )}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> >>\n`;
  writeObject(3, [pageDict]);

  const contentStream = `q\n${pdfWidth.toFixed(2)} 0 0 ${pdfHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  writeObject(4, [`<< /Length ${contentBytes.length} >>\nstream\n`, contentBytes, '\nendstream\n']);

  writeObject(5, [
    `<< /Type /XObject /Subtype /Image /Name /Im0 /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    jpegBytes,
    '\nendstream\n'
  ]);

  const xrefOffset = offset;
  const totalObjects = 5;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i++) {
    push(`${offsets[i].toString().padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const pdfBytes = new Uint8Array(totalLength);
  let p = 0;
  chunks.forEach(c => {
    pdfBytes.set(c, p);
    p += c.length;
  });

  return pdfBytes;
}

function revokeUrl(obj: {url: string} | null) {
  if (obj?.url) URL.revokeObjectURL(obj.url);
}

// 根据归一化坐标计算印章左上角（预览容器坐标系）
function stampLeftTopFromNorm(
  norm: {x: number; y: number},
  box: {w: number; h: number},
  stampSize: number
): {left: number; top: number} {
  const centerX = clamp(norm.x, 0, 1) * box.w;
  const centerY = clamp(norm.y, 0, 1) * box.h;
  return {
    left: clamp(centerX - stampSize / 2, 0, Math.max(0, box.w - stampSize)),
    top: clamp(centerY - stampSize / 2, 0, Math.max(0, box.h - stampSize))
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// 加载图片自然尺寸（支持 SVG/PNG/JPG/WebP）
function loadImageMeta(url: string): Promise<{naturalW: number; naturalH: number}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 同源或 objectURL 最稳；跨域需 CORS
    img.onload = () => {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      if (!naturalW || !naturalH) return reject(new Error('无法获取图片尺寸'));
      resolve({naturalW, naturalH});
    };
    img.onerror = reject;
    img.src = url;
  });
}
