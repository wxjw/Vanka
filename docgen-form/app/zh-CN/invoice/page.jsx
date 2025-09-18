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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

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

  const previewCurrency = computed.currency || 'SGD';
  const previewQtyValue = form.qty?.trim() || (Number.isFinite(computed.qty) && computed.qty !== 0 ? String(computed.qty) : '');
  const previewUnitPriceValue = form.unitPrice?.trim() || (Number.isFinite(computed.unit) && computed.unit !== 0 ? fmtMoney(computed.unit, previewCurrency) : '');
  const previewAmountValue = form.amount?.trim() || computed.f.amount;
  const previewUnitSubtotalValue = form.unitPriceTotal?.trim() || computed.f.unitPriceTotal;
  const previewAmountSubtotalValue = form.amountTotal?.trim() || computed.f.amountTotal;
  const previewTotalValue = form.total?.trim() || computed.f.total;
  const previewItems = (form.description?.trim() || previewQtyValue || previewUnitPriceValue || previewAmountValue)
    ? [
        {
          description: form.description?.trim() || '（未填写）',
          qty: previewQtyValue || '—',
          unitPrice: previewUnitPriceValue || '—',
          amount: previewAmountValue || '—'
        }
      ]
    : [];
  const dueDisplay = form.paymentDue?.trim()
    ? computed.daysToPay
      ? `${form.paymentDue.trim()}（付款期限 ${computed.daysToPay} 天）`
      : form.paymentDue.trim()
    : computed.daysToPay
      ? `付款期限 ${computed.daysToPay} 天`
      : '—';
  const currencyDisplay = (form.currency || computed.currency || 'SGD').trim().toUpperCase() || 'SGD';

  async function handleGenerate(event) {
    event.preventDefault();
    setIsGenerating(true);
    setError('');

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
        const message = text || '未知错误';
        setError(`生成失败：${message}`);
        alert('生成失败：' + message);
        return;
      }

      const blob = await res.blob();
      // 基本校验：返回的不是 JSON（错误页）而是文件
      if (!blob || blob.size === 0) {
        const message = '返回空文件。';
        setError(`生成失败：${message}`);
        alert('生成失败：' + message);
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
      const message = err instanceof Error ? err.message : String(err);
      const displayMessage = message || '未知错误';
      setError(`生成失败：${displayMessage}`);
      alert('生成失败：' + displayMessage);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          <span className={styles.backIcon} aria-hidden>
            ←
          </span>
          返回首页
        </Link>
        <h1 className={styles.heading}>发票生成器</h1>
      </div>

      <div className={styles.layout}>
        <form className={`${styles.card} ${styles.formCard}`} onSubmit={handleGenerate}>
          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>客户信息</h2>
              <p className={styles.sectionHint}>填写发票抬头、联系方式与发票编号。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>客户名称</span>
                <input
                  className={styles.textControl}
                  value={form.clientName}
                  onChange={event => onChange('clientName', event.target.value)}
                  placeholder="如：示例科技有限公司"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>联系方式</span>
                <input
                  className={styles.textControl}
                  value={form.contactInfo}
                  onChange={event => onChange('contactInfo', event.target.value)}
                  placeholder="邮箱或电话"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>发票编号</span>
                <input
                  className={styles.textControl}
                  value={form.invoiceNo}
                  onChange={event => onChange('invoiceNo', event.target.value)}
                  placeholder="如：VK-2024-001"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>开票日期</span>
                <input
                  type="date"
                  className={styles.textControl}
                  value={form.dateOfIssue}
                  onChange={event => onChange('dateOfIssue', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>付款截止日期</span>
                <input
                  type="date"
                  className={styles.textControl}
                  value={form.paymentDue}
                  onChange={event => onChange('paymentDue', event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>币种</span>
                <input
                  className={styles.textControl}
                  value={form.currency}
                  onChange={event => onChange('currency', event.target.value)}
                  placeholder="如：SGD"
                />
              </label>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>项目负责人</h2>
              <p className={styles.sectionHint}>用于发票底部展示的项目负责人信息。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>姓名</span>
                <input
                  className={styles.textControl}
                  value={form.projectLead_name}
                  onChange={event => onChange('projectLead_name', event.target.value)}
                  placeholder="如：张三"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>电话</span>
                <input
                  className={styles.textControl}
                  value={form.projectLead_phone}
                  onChange={event => onChange('projectLead_phone', event.target.value)}
                  placeholder="例如：+65 1234 5678"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>邮箱</span>
                <input
                  type="email"
                  className={styles.textControl}
                  value={form.projectLead_email}
                  onChange={event => onChange('projectLead_email', event.target.value)}
                  placeholder="name@example.com"
                />
              </label>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>服务条目</h2>
              <p className={styles.sectionHint}>至少填写一行以生成发票条目，未填写时会自动忽略。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>服务描述</span>
                <textarea
                  className={styles.textControl}
                  value={form.description}
                  onChange={event => onChange('description', event.target.value)}
                  placeholder="例如：品牌营销顾问服务"
                  rows={3}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>数量</span>
                <input
                  className={styles.textControl}
                  value={form.qty}
                  onChange={event => onChange('qty', event.target.value)}
                  placeholder="如：10"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>单价</span>
                <input
                  className={styles.textControl}
                  value={form.unitPrice}
                  onChange={event => onChange('unitPrice', event.target.value)}
                  placeholder="支持直接填写金额或格式化文本"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>金额</span>
                <input
                  className={styles.textControl}
                  value={form.amount}
                  onChange={event => onChange('amount', event.target.value)}
                  placeholder="未填写则自动计算"
                />
              </label>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>金额汇总</h2>
              <p className={styles.sectionHint}>可填写自定义金额；留空时将根据自动计算结果填充。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>小计（按单价）</span>
                <input
                  className={styles.textControl}
                  value={form.unitPriceTotal}
                  onChange={event => onChange('unitPriceTotal', event.target.value)}
                  placeholder="示例：SGD 12,000.00"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>小计（按金额）</span>
                <input
                  className={styles.textControl}
                  value={form.amountTotal}
                  onChange={event => onChange('amountTotal', event.target.value)}
                  placeholder="示例：SGD 12,000.00"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>费用包含</span>
                <textarea
                  className={styles.textControl}
                  value={form.feeInclude}
                  onChange={event => onChange('feeInclude', event.target.value)}
                  placeholder="例如：方案策划、设计支持等"
                  rows={3}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>费用不含</span>
                <textarea
                  className={styles.textControl}
                  value={form.feeExclude}
                  onChange={event => onChange('feeExclude', event.target.value)}
                  placeholder="例如：第三方采购费用"
                  rows={3}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>总计</span>
                <input
                  className={styles.textControl}
                  value={form.total}
                  onChange={event => onChange('total', event.target.value)}
                  placeholder="示例：SGD 15,000.00"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>服务时间/备注</span>
                <textarea
                  className={styles.textControl}
                  value={form.serviceDetailDate}
                  onChange={event => onChange('serviceDetailDate', event.target.value)}
                  placeholder="例如：服务周期 2024.06 - 2024.08"
                  rows={2}
                />
              </label>
            </div>
          </section>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={isGenerating}>
              {isGenerating ? '正在生成…' : '生成 DOCX 发票'}
            </button>
          </div>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}
        </form>

        <aside className={`${styles.card} ${styles.previewCard}`} aria-live="polite">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>预览</h2>
            <p className={styles.sectionHint}>系统将根据以下信息生成 DOCX 发票文件。</p>
          </div>

          <div className={styles.previewGroup}>
            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>基本信息</h3>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>客户名称</span>
                <span className={styles.previewValue}>{form.clientName?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>联系方式</span>
                <span className={styles.previewValue}>{form.contactInfo?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>发票编号</span>
                <span className={styles.previewValue}>{form.invoiceNo?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>开票日期</span>
                <span className={styles.previewValue}>{form.dateOfIssue?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>付款截止</span>
                <span className={styles.previewValue}>{dueDisplay}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>币种</span>
                <span className={styles.previewValue}>{currencyDisplay}</span>
              </div>
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>项目负责人</h3>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>姓名</span>
                <span className={styles.previewValue}>{form.projectLead_name?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>电话</span>
                <span className={styles.previewValue}>{form.projectLead_phone?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>邮箱</span>
                <span className={styles.previewValue}>{form.projectLead_email?.trim() || '—'}</span>
              </div>
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>服务条目</h3>
              {previewItems.length ? (
                previewItems.map((item, index) => (
                  <div key={index} className={styles.previewItem}>
                    <span className={styles.previewLabel}>条目 {index + 1}</span>
                    <span className={styles.previewValue}>
                      {item.description}
                      {'\n'}数量：{item.qty || '—'}
                      {'\n'}单价：{item.unitPrice || '—'}
                      {'\n'}金额：{item.amount || '—'}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel}>条目</span>
                  <span className={styles.previewValue}>暂未填写服务条目。</span>
                </div>
              )}
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>金额汇总</h3>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>小计（单价）</span>
                <span className={styles.previewValue}>{previewUnitSubtotalValue || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>小计（金额）</span>
                <span className={styles.previewValue}>{previewAmountSubtotalValue || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>费用包含</span>
                <span className={styles.previewValue}>{form.feeInclude?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>费用不含</span>
                <span className={styles.previewValue}>{form.feeExclude?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>总计</span>
                <span className={styles.previewValue}>{previewTotalValue || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>服务时间 / 备注</span>
                <span className={styles.previewValue}>{form.serviceDetailDate?.trim() || '—'}</span>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
