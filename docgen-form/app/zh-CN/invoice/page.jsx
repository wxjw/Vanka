'use client';
import {useState} from 'react';
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

  const onChange = (key, value) => setForm(prev => ({...prev, [key]: value}));

  async function handleGenerate(event) {
    event.preventDefault();

    const data = {
      客戶姓名或公司全稱: form.clientName,
      客戶電話或電郵: form.contactInfo,
      'XXX-YYYYMM-XXX': form.invoiceNo,
      'YYYY-MM-DD': form.dateOfIssue,
      幣別: form.currency,
      付款期限: form.paymentDue,
      項目負責人: `${form.projectLead_name}｜${form.projectLead_phone}｜${form.projectLead_email}`,
      填寫項目: form.description,
      數量1: form.qty,
      单价XXXX: form.unitPrice,
      金额xxxxx: form.amount,
      'SGD XX': form.unitPriceTotal,
      'SGD 金额合计': form.amountTotal,
      'MM/DD': form.serviceDetailDate,
      費用包含: form.feeInclude,
      費用不含: form.feeExclude,
      'SGD 0,000.00': form.total
    };

    const meta = {
      projectNo: form.invoiceNo || 'NO',
      issueDate: form.dateOfIssue || 'DATE',
      docTypeLabel: '发票'
    };

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({templateKey: 'invoice', data, meta})
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      alert('生成失败：' + text);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${meta.projectNo || 'invoice'}.docx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
            {renderField('币别（SGD/CNY/USD/EUR）', 'currency')}
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
            {renderField('金额', 'amount', 'text')}
            {renderField('单价合计', 'unitPriceTotal', 'text')}
            {renderField('金额合计', 'amountTotal', 'text')}
            {renderField('行程与服务详情日期', 'serviceDetailDate', 'text', '例如：2024/08/18-2024/08/21')}
            {renderField('费用包含', 'feeInclude', 'textarea')}
            {renderField('费用不含', 'feeExclude', 'textarea')}
            {renderField('总计', 'total', 'text', '例如：SGD 3,000.00')}
          </section>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton}>
              生成 DOCX
            </button>
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
              {previewRow('金额', form.amount)}
              {previewRow('单价合计', form.unitPriceTotal)}
              {previewRow('金额合计', form.amountTotal)}
              {previewRow('服务日期', form.serviceDetailDate)}
              {previewRow('费用包含', form.feeInclude)}
              {previewRow('费用不含', form.feeExclude)}
              {previewRow('总计', form.total)}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
