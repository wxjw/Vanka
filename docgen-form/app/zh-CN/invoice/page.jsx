'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import styles from '../formStyles.module.css';

export default function InvoicePage() {
  const [form, setForm] = useState({
    clientName: '',
    contactInfo: '',
    invoiceNo: '',
    dateOfIssue: '',
    paymentDue: '',
    currency: 'SGD',
    projectLead_name: '',
    projectLead_phone: '',
    projectLead_email: '',
    description: '',
    qty: '',
    unitPrice: '',
    amount: '',
    unitPriceTotal: '',
    amountTotal: '',
    serviceDetailDate: '',
    feeInclude: '',
    feeExclude: '',
    total: ''
  });

  const onChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // —— 金额预览的自动计算（不回写到表单，只用于右侧预览 & 生成时兜底）——
  const toNumber = (v) => {
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const fmtMoney = (n, ccy) => {
    try {
      return new Intl.NumberFormat('en-SG', { style: 'currency', currency: ccy || 'SGD' }).format(n || 0);
    } catch {
      return `${ccy || 'SGD'} ${Number(n || 0).toFixed(2)}`;
    }
  };

  const parseIsoDate = (input) => {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, yearStr, monthStr, dayStr] = match;
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const ms = Date.UTC(year, month, day);
    return Number.isFinite(ms) ? ms : null;
  };

  const computed = useMemo(() => {
    const qty = toNumber(form.qty);
    const unit = toNumber(form.unitPrice);

    const amountCalc = qty * unit;
    const amount = toNumber(form.amount) || amountCalc;

    const unitPriceTotal = toNumber(form.unitPriceTotal) || amountCalc;
    const amountTotal = toNumber(form.amountTotal) || amount;
    const total = toNumber(form.total) || amountTotal;

    const currency = (form.currency || 'SGD').trim().toUpperCase() || 'SGD';

    const issueMs = parseIsoDate(form.dateOfIssue);
    const dueMs = parseIsoDate(form.paymentDue);
    let daysToPay = '';
    if (Number.isFinite(issueMs) && Number.isFinite(dueMs)) {
      const diff = Math.round((dueMs - issueMs) / (24 * 60 * 60 * 1000));
      if (Number.isFinite(diff) && diff >= 0) {
        daysToPay = String(diff);
      }
    }

    return {
      qty,
      unit,
      amount,
      unitPriceTotal,
      amountTotal,
      total,
      currency,
      daysToPay,
      f: {
        amount: fmtMoney(amount, currency),
        unitPriceTotal: fmtMoney(unitPriceTotal, currency),
        amountTotal: fmtMoney(amountTotal, currency),
        total: fmtMoney(total, currency)
      }
    };
  }, [
    form.qty,
    form.unitPrice,
    form.amount,
    form.unitPriceTotal,
    form.amountTotal,
    form.total,
    form.currency,
    form.dateOfIssue,
    form.paymentDue
  ]);

  async function handleGenerate(event) {
    event.preventDefault();

    const currency = computed.currency;
    const normalizedCurrency = currency || 'SGD';

    const qtyDisplay = form.qty?.trim()
      ? form.qty
      : Number.isFinite(computed.qty) && computed.qty !== 0
        ? String(computed.qty)
        : '';
    const unitPriceDisplay = form.unitPrice?.trim()
      ? form.unitPrice
      : Number.isFinite(computed.unit) && computed.unit !== 0
        ? fmtMoney(computed.unit, normalizedCurrency)
        : '';
    const amountDisplay = form.amount?.trim() ? form.amount : computed.f.amount;

    const hasItemValues = [form.description, qtyDisplay, unitPriceDisplay, amountDisplay]
      .map(v => (typeof v === 'string' ? v.trim() : v))
      .some(Boolean);

    const items = hasItemValues
      ? [
          {
            description: form.description || '',
            qty: qtyDisplay,
            unitPrice: unitPriceDisplay,
            amount: amountDisplay
          }
        ]
      : [];

    const unitPriceSubtotal = form.unitPriceTotal?.trim() ? form.unitPriceTotal : computed.f.unitPriceTotal;
    const amountSubtotal = form.amountTotal?.trim() ? form.amountTotal : computed.f.amountTotal;
    const totalAmount = form.total?.trim() ? form.total : computed.f.total;

    // 生成文档所需数据：若表单为空，使用自动计算的兜底格式化数值
    const data = {
      billTo_name: form.clientName || '',
      billTo_contact: form.contactInfo || '',
      invoiceNo: form.invoiceNo || '',
      dateOfIssue: form.dateOfIssue || '',
      paymentDue: form.paymentDue || '',
      currency: normalizedCurrency,
      projectLead: {
        name: form.projectLead_name || '',
        phone: form.projectLead_phone || '',
        email: form.projectLead_email || ''
      },
      items,
      unitPriceSubtotal,
      amountSubtotal,
      serviceDetails: form.serviceDetailDate || '',
      feeInclude: form.feeInclude || '',
      feeExclude: form.feeExclude || '',
      totalAmount,
      X: computed.daysToPay || ''
    };

    const meta = {
      projectNo: form.invoiceNo || 'NO',
      issueDate: form.dateOfIssue || 'DATE',
      docTypeLabel: '发票'
    };

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ templateKey: 'invoice', data, meta })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        alert('生成失败：' + (text || '未知错误'));
        return;
      }

      const blob = await res.blob();
      // 基本校验：返回的不是 JSON（错误页）而是文件
      if (!blob || blob.size === 0) {
        alert('生成失败：返回空文件。');
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(meta.projectNo || 'invoice').replace(/[^\w.-]/g, '_')}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // 给浏览器一点处理时间再 revoke，避免个别浏览器中断下载
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('生成文档时出错:', err);
      const message = err instanceof Error ? err.message : String