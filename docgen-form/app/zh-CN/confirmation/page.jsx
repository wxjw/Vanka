'use client';
import {useEffect, useRef, useState} from 'react';
import styles from '../formStyles.module.css';

let pdfWorkerConfigured = false;

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
  if (typeof window !== 'undefined' && !pdfWorkerConfigured && pdfjsLib?.GlobalWorkerOptions) {
    const version = pdfjsLib?.version || '3.11.174';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
    pdfWorkerConfigured = true;
  }
  return pdfjsLib;
}

function downloadBlobAsDocx(blob, filename = 'document.docx') {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ConfirmationPage() {
  const [brand, setBrand] = useState('vanka');
  const [form, setForm] = useState({
    recipientName: '',
    referenceNo: '',
    issueDate: '',
    payByDate: '',
    payAmountCNY: '',
    payAmountUppercase: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    itinerary: '',
    restrictions: '',
    others: '',
    remark: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfPages, setPdfPages] = useState([]);
  const pdfContainerRef = useRef(null);
  const stampRef = useRef(null);
  const dragOffsetRef = useRef({x: 0, y: 0});
  const [stampPosition, setStampPosition] = useState({x: 32, y: 32});
  const [draggingStamp, setDraggingStamp] = useState(false);

  const onChange = (key, value) => setForm(prev => ({...prev, [key]: value}));

  useEffect(() => {
    if (!draggingStamp) {
      return undefined;
    }

    function handlePointerMove(event) {
      if (!pdfContainerRef.current) return;
      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      const stampEl = stampRef.current;
      const stampWidth = stampEl?.offsetWidth || 0;
      const stampHeight = stampEl?.offsetHeight || 0;
      const nextX = event.clientX - containerRect.left - dragOffsetRef.current.x;
      const nextY = event.clientY - containerRect.top - dragOffsetRef.current.y;

      const clampedX = Math.max(0, Math.min(containerRect.width - stampWidth, nextX));
      const clampedY = Math.max(0, Math.min(containerRect.height - stampHeight, nextY));
      setStampPosition({x: clampedX, y: clampedY});
    }

    function handlePointerUp(event) {
      if (stampRef.current?.releasePointerCapture) {
        try {
          stampRef.current.releasePointerCapture(event.pointerId);
        } catch (err) {
          // ignore release errors
        }
      }
      setDraggingStamp(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingStamp]);

  const handleStampPointerDown = event => {
    if (!pdfContainerRef.current) return;
    const stampRect = event.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - stampRect.left,
      y: event.clientY - stampRect.top
    };
    setDraggingStamp(true);
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore capture errors
      }
    }
    event.preventDefault();
  };

  async function handleGenerate(event) {
    event.preventDefault();

    setLoading(true);
    setError('');
    setPdfPages([]);

    const templateKey = brand === 'vanka' ? 'confirmation_vanka' : 'confirmation_duoji';
    const data = {
      收件人姓名: form.recipientName,
      项目编号: form.referenceNo,
      出具日期: form.issueDate,
      定金支付截止日期: form.payByDate,
      定金金额CNY: form.payAmountCNY,
      大写金额: form.payAmountUppercase,
      联系人姓名: form.contactName,
      联系人电话: form.contactPhone,
      联系人邮箱: form.contactEmail,
      行程信息: form.itinerary,
      限制信息: form.restrictions,
      其他信息: form.others,
      备注: form.remark
    };

    const meta = {
      projectNo: form.referenceNo || 'NO',
      issueDate: form.issueDate || 'DATE',
      docTypeLabel: brand === 'vanka' ? '确认函-万咖' : '确认函-多吉'
    };

    const payload = {templateKey, data, meta};
    let shouldFallbackToDocx = false;

    try {
      let previewRes = null;
      try {
        previewRes = await fetch('/api/preview', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
      } catch (networkErr) {
        shouldFallbackToDocx = true;
      }

      if (previewRes) {
        if (!previewRes.ok) {
          if (previewRes.status === 404) {
            shouldFallbackToDocx = true;
          } else {
            const text = await previewRes.text().catch(() => '');
            throw new Error(text || '生成失败');
          }
        } else {
          const contentType = previewRes.headers.get('content-type') || '';
          const blob = await previewRes.blob();
          if (contentType.includes('pdf')) {
            await renderPdfBlob(blob);
            setStampPosition({x: 32, y: 32});
          } else {
            downloadBlobAsDocx(blob, `${meta.projectNo || '确认函'}.docx`);
          }
          shouldFallbackToDocx = false;
        }
      }

      if (shouldFallbackToDocx) {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || '生成失败');
        }

        const blob = await res.blob();
        downloadBlobAsDocx(blob, `${meta.projectNo || '确认函'}.docx`);
      }
    } catch (err) {
      console.error(err);
      const message = err?.message || '生成失败';
      setError(message);
      alert('生成失败：' + message);
    } finally {
      setLoading(false);
    }
  }

  async function renderPdfBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdfjsLib = await loadPdfjs();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    const pages = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({scale: 1.4});
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({canvasContext: context, viewport}).promise;
      pages.push({
        pageNumber: pageNum,
        width: canvas.width,
        height: canvas.height,
        dataUrl: canvas.toDataURL('image/png')
      });
    }

    setPdfPages(pages);
  }

  const renderField = (label, key, type = 'text', placeholder = '') => (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          className={styles.textControl}
          rows={4}
          placeholder={placeholder}
          value={form[key]}
          onChange={event => onChange(key, event.target.value)}
        />
      ) : (
        <input
          className={styles.textControl}
          type={type}
          placeholder={placeholder}
          value={form[key]}
          onChange={event => onChange(key, event.target.value)}
        />
      )}
    </div>
  );

  const previewRow = (label, value) => {
    const display = value == null ? '' : typeof value === 'string' ? value : String(value);
    const content = display.trim() ? display : '—';
    return (
      <div className={styles.previewItem}>
        <div className={styles.previewLabel}>{label}</div>
        <div className={styles.previewValue}>{content}</div>
      </div>
    );
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>预定信息确认函</h1>

      <div className={styles.layout}>
        <div className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>填写确认函信息</h2>
            <p className={styles.sectionHint}>请根据业务需求完整填写，右侧将即时同步预览效果。</p>
          </div>

          <div className={styles.brandSelector}>
            <span className={styles.fieldLabel}>模板品牌</span>
            <select className={styles.selectControl} value={brand} onChange={event => setBrand(event.target.value)}>
              <option value="vanka">万咖</option>
              <option value="duoji">多吉</option>
            </select>
          </div>

          <form onSubmit={handleGenerate} className={styles.fieldGrid}>
            {renderField('收件人姓名', 'recipientName', 'text', '请输入收件人姓名')}
            {renderField('确认单编号（项目编号）', 'referenceNo', 'text', '如：VK-2024-001')}
            {renderField('出具日期', 'issueDate', 'date')}
            {renderField('定金支付截止日期', 'payByDate', 'date')}
            {renderField('定金金额（CNY）', 'payAmountCNY', 'text', '例如：3000')}
            {renderField('大写金额', 'payAmountUppercase', 'text', '例如：叁仟元整')}
            {renderField('联系人姓名', 'contactName', 'text')}
            {renderField('联系人电话', 'contactPhone', 'text')}
            {renderField('联系人邮箱', 'contactEmail', 'email')}
            {renderField('行程信息', 'itinerary', 'textarea', '示例：2024/08/18-2024/08/21 西藏行程…')}
            {renderField('限制信息', 'restrictions', 'textarea', '例如：机票不可退改、需提前确认…')}
            {renderField('其他信息', 'others', 'textarea', '可填写额外说明')}
            {renderField('备注', 'remark', 'textarea', '填写内部备注或补充信息')}

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.primaryButton} disabled={loading}>
                {loading ? '生成中…' : pdfPages.length > 0 ? '重新生成预览' : '生成预览'}
              </button>
            </div>
          </form>
        </div>

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

            {pdfPages.length === 0 && <p className={styles.emptyPreviewHint}>生成预览后，可拖拽印章到指定位置。</p>}
          </div>
        </aside>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {pdfPages.length > 0 && (
        <div ref={pdfContainerRef} className={styles.pdfPreview}>
          {pdfPages.map(page => (
            <img
              key={page.pageNumber}
              src={page.dataUrl}
              alt={`PDF 第 ${page.pageNumber} 页`}
              className={styles.pdfPage}
            />
          ))}

          <img
            ref={stampRef}
            src="/stamp.svg"
            alt="印章"
            onPointerDown={handleStampPointerDown}
            draggable={false}
            className={styles.stamp}
            style={{top: stampPosition.y, left: stampPosition.x}}
          />
        </div>
      )}
    </main>
  );
}
