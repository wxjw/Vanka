'use client';
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

  const computed = useMemo(() => {
    const qty = toNumber(form.qty);
    const unit = toNumber(form.unitPrice);

    const amountCalc = qty * unit;
    const amount = toNumber(form.amount) || amountCalc;

    const unitPriceTotal = toNumber(form.unitPriceTotal) || amountCalc;
    const amountTotal = toNumber(form.amountTotal) || amount;
    const total = toNumber(form.total) || amountTotal;

    return {
      qty, unit, amount, unitPriceTotal, amountTotal, total,
      f: {
        amount: fmtMoney(amount, form.currency),
        unitPriceTotal: fmtMoney(unitPriceTotal, form.currency),
        amountTotal: fmtMoney(amountTotal, form.currency),
        total: fmtMoney(total, form.currency)
      }
    };
  }, [form.qty, form.unitPrice, form.amount, form.unitPriceTotal, form.amountTotal, form.total, form.currency]);

  async function handleGenerate(event) {
    event.preventDefault();

    // 生成文档所需数据：若表单为空，使用自动计算的兜底格式化数值
    const data = {
      客戶姓名或公司全稱: form.clientName,
      客戶電話或電郵: form.contactInfo,
      'XXX-YYYYMM-XXX': form.invoiceNo,
      'YYYY-MM-DD': form.dateOfIssue,
      幣別: form.currency,
      付款期限: form.paymentDue,
      項目負責人: [form.projectLead_name, form.projectLead_phone, form.projectLead_email].filter(Boolean).join('｜'),
      填寫項目: form.description,
      數量1: form.qty,
      单价XXXX: form.unitPrice,
      金额xxxxx: form.amount || computed.f.amount,
      'SGD XX': form.unitPriceTotal || computed.f.unitPriceTotal,
      'SGD 金额合计': form.amountTotal || computed.f.amountTotal,
      'MM/DD': form.serviceDetailDate,
      費用包含: form.feeInclude,
      費用不含: form.feeExclude,
      'SGD 0,000.00': form.total || computed.f.total
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
      const message = err instanceof Error ? err.message : String(err);
      alert('生成失败：' + message);
    }
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
          onChange={e => onChange(key, e.target.value)}
        />
      ) : (
        <input
          className={styles.textControl}
          type={type}
          placeholder={placeholder}
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
      <div className={styles.previewItem}>
        <div className={styles.previewLabel}>{label}</div>
        <div className={styles.previewValue}>{content}</div>
      </div>
    );
  };

  const projectLead = [form.projectLead_name, form.projectLead_phone, form.projectLead_email]
    .filter(Boolean)
    .join(' ｜ ');

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>发票（Invoice）</h1>

      <div className={styles.layout}>
        <form onSubmit={handleGenerate} className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>填写发票信息</h2>
            <p className={styles.sectionHint}>按顺序补齐客户、负责人及费用明细，右侧实时预览内容。</p>
          </div>

          <section className={styles.fieldGrid}>
            {renderField('客户姓名/公司', 'clientName', 'text', '如：Vanka Travel Pte. Ltd.')}
            {renderField('联系方式', 'contactInfo', 'text', '电话或邮箱')}
            {renderField('发票编号（项目编号）', 'invoiceNo', 'text', '例如：INV-2024-001')}
            {renderField('开立日期', 'dateOfIssue', 'date')}
            {renderField('付款期限', 'paymentDue', 'date')}
            {renderField('币别（SGD/CNY/USD/EUR）', 'currency', 'text', 'SGD')}
          </section>

          <section className={styles.fieldGrid}>
            <h3 className={styles.previewSectionTitle}>项目负责人</h3>
            {renderField('姓名', 'projectLead_name')}
            {renderField('电话', 'projectLead_phone')}
            {renderField('邮箱', 'projectLead_email', 'email')}
          </section>

          <section className={styles.fieldGrid}>
            <h3 className={styles.previewSectionTitle}>项目与金额</h3>
            {renderField('项目（描述）', 'description', 'textarea', '填写服务内容、项目范围等')}
            {renderField('数量', 'qty', 'text', '例如：1')}
            {renderField('单价', 'unitPrice', 'text', '例如：3000')}
            {renderField('金额（可留空自动算）', 'amount', 'text')}
            {renderField('单价合计（可留空自动算）', 'unitPriceTotal', 'text')}
            {renderField('金额合计（可留空自动算）', 'amountTotal', 'text')}
            {renderField('行程与服务详情日期', 'serviceDetailDate', 'text', '例如：2024/08/18-2024/08/21')}
            {renderField('费用包含', 'feeInclude', 'textarea')}
            {renderField('费用不含', 'feeExclude', 'textarea')}
            {renderField('总计（可留空自动算）', 'total', 'text', '例如：SGD 3,000.00')}
          </section>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton}>生成 DOCX</button>
          </div>
        </form>

        <aside className={`${styles.card} ${styles.previewCard}`}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>即时预览</h2>
            <p className={styles.sectionHint}>生成前快速复核重要金额与项目内容。</p>
          </div>

          <div className={styles.previewGroup}>
            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>基本信息</h3>
              {previewRow('客户姓名/公司', form.clientName)}
              {previewRow('联系方式', form.contactInfo)}
              {previewRow('发票编号', form.invoiceNo)}
              {previewRow('开立日期', form.dateOfIssue)}
              {previewRow('付款期限', form.paymentDue)}
              {previewRow('币别', form.currency)}
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>项目负责人</h3>
              {previewRow('姓名', form.projectLead_name)}
              {previewRow('电话', form.projectLead_phone)}
              {previewRow('邮箱', form.projectLead_email)}
              {previewRow('信息汇总', projectLead)}
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>项目与金额</h3>
              {previewRow('项目描述', form.description)}
              {previewRow('数量', form.qty)}
              {previewRow('单价', form.unitPrice)}
              {previewRow('金额', form.amount || computed.f.amount)}
              {previewRow('单价合计', form.unitPriceTotal || computed.f.unitPriceTotal)}
              {previewRow('金额合计', form.amountTotal || computed.f.amountTotal)}
              {previewRow('服务日期', form.serviceDetailDate)}
              {previewRow('费用包含', form.feeInclude)}
              {previewRow('费用不含', form.feeExclude)}
              {previewRow('总计', form.total || computed.f.total)}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
