'use client';
import {useEffect, useRef, useState} from 'react';

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

function downloadBlobAsDocx(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ConfirmationPage() {
  const [brand, setBrand] = useState('vanka'); // vanka / duoji
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

  const handleStampPointerDown = (event) => {
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

  async function handleGenerate(e) {
    e.preventDefault();

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
            downloadBlobAsDocx(blob);
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
        downloadBlobAsDocx(blob);
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

  const row = (label, key, type = 'text') => (
    <div style={{display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'center', marginBottom: 12}}>
      <label>{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          style={{width: '100%', fontSize: 14, padding: 8}}
          value={form[key]}
          onChange={e => onChange(key, e.target.value)}
        />
      ) : (
        <input
          style={{width: '100%', fontSize: 14, padding: 8}}
          type={type}
          value={form[key]}
          onChange={e => onChange(key, e.target.value)}
        />
      )}
    </div>
  );

  const previewRow = (label, value) => {
    const display = value == null ? '' : typeof value === 'string' ? value : String(value);
    const content = display.trim() ? display : '—';
    return (
      <div style={{display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 8}}>
        <div style={{color: '#6a737d'}}>{label}</div>
        <div style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{content}</div>
      </div>
    );
  };

  return (
    <main>
      <h1>预定信息确认函</h1>

      <div style={{display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap'}}>
        <div style={{flex: '1 1 360px', minWidth: 320}}>
          <div style={{margin: '12px 0'}}>
            <label>模板品牌：</label>
            <select value={brand} onChange={e => setBrand(e.target.value)}>
              <option value="vanka">万咖</option>
              <option value="duoji">多吉</option>
            </select>
          </div>

          <form onSubmit={handleGenerate}>
            {row('收件人姓名', 'recipientName')}
            {row('确认单编号（项目编号）', 'referenceNo')}
            {row('出具日期', 'issueDate', 'date')}
            {row('定金支付截止日期', 'payByDate', 'date')}
            {row('定金金额（CNY）', 'payAmountCNY')}
            {row('大写金额', 'payAmountUppercase')}
            {row('联系人姓名', 'contactName')}
            {row('联系人电话', 'contactPhone')}
            {row('联系人邮箱', 'contactEmail')}
            {row('行程信息', 'itinerary', 'textarea')}
            {row('限制信息', 'restrictions', 'textarea')}
            {row('其他信息', 'others', 'textarea')}
            {row('备注', 'remark', 'textarea')}

            <div style={{marginTop: 20}}>
              <button type="submit" style={{padding: '10px 16px', fontSize: 16}} disabled={loading}>
                {loading ? '生成中…' : pdfPages.length > 0 ? '重新生成' : '生成预览'}
              </button>
            </div>
          </form>
        </div>

        <aside style={{flex: '1 1 280px', minWidth: 260, background: '#f5f7fa', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0'}}>
          <h2 style={{marginTop: 0, fontSize: 18}}>即时预览</h2>
          <p style={{marginTop: 4, marginBottom: 20, color: '#64748b'}}>左侧填写的内容会实时显示在此，生成前请再次确认。</p>

          <section style={{marginBottom: 20}}>
            <h3 style={{fontSize: 16, marginBottom: 12}}>基础信息</h3>
            {previewRow('收件人姓名', form.recipientName)}
            {previewRow('确认单编号', form.referenceNo)}
            {previewRow('出具日期', form.issueDate)}
            {previewRow('定金支付截止日期', form.payByDate)}
            {previewRow('定金金额（CNY）', form.payAmountCNY)}
            {previewRow('金额大写', form.payAmountUppercase)}
          </section>

          <section style={{marginBottom: 20}}>
            <h3 style={{fontSize: 16, marginBottom: 12}}>联系人</h3>
            {previewRow('姓名', form.contactName)}
            {previewRow('电话', form.contactPhone)}
            {previewRow('邮箱', form.contactEmail)}
          </section>

          <section>
            <h3 style={{fontSize: 16, marginBottom: 12}}>详细信息</h3>
            {previewRow('行程信息', form.itinerary)}
            {previewRow('限制信息', form.restrictions)}
            {previewRow('其他信息', form.others)}
            {previewRow('备注', form.remark)}
            {previewRow('品牌模板', brand === 'vanka' ? '万咖' : '多吉')}
          </section>
        </aside>
      </div>

      {error && (
        <div style={{marginTop: 16, color: '#c00'}}>{error}</div>
      )}

      {pdfPages.length > 0 && (
        <div
          ref={pdfContainerRef}
          style={{
            position: 'relative',
            marginTop: 24,
            border: '1px solid #ddd',
            padding: 12,
            borderRadius: 8,
            background: '#f8f8f8'
          }}
        >
          {pdfPages.map(page => (
            <img
              key={page.pageNumber}
              src={page.dataUrl}
              alt={`PDF 第 ${page.pageNumber} 页`}
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                marginBottom: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
          ))}

          <img
            ref={stampRef}
            src="/stamp.svg"
            alt="印章"
            onPointerDown={handleStampPointerDown}
            draggable={false}
            style={{
              position: 'absolute',
              top: stampPosition.y,
              left: stampPosition.x,
              width: 140,
              cursor: draggingStamp ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none'
            }}
          />
        </div>
      )}
    </main>
  );
}
