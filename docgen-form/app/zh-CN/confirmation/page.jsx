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

// Kept this helper function from the 'codex' branch for the docx fallback
function downloadBlobAsDocx(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'document.docx'; // It's good practice to provide a default filename
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

  // Kept a single, clean version of onChange
  const onChange = (key, value) => setForm(prev => ({...prev, [key]: value}));

  // Kept a single, clean version of the drag-and-drop effect and handlers
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

  // Merged logic for handleGenerate, preferring the version with the .docx fallback
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
  
  // The rest of your JSX remains the same...
  // ...
}