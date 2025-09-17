'use client';
import {useState} from 'react';

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

  const onChange = (k, v) => setForm(prev => ({...prev, [k]: v}));

  async function handleGenerate(e) {
    e.preventDefault();

    const data = {
      客戶姓名或公司全稱: form.clientName,
      客戶電話或電郵: form.contactInfo,
      'XXX-YYYYMM-XXX': form.invoiceNo,
      'YYYY-MM-DD': form.dateOfIssue,
      幣別: form.currency,
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
      body: JSON.stringify({ templateKey: 'invoice', data, meta })
    });

    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      alert('生成失败：' + text);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const row = (label, key, type='text') => (
    <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:12, alignItems:'center', marginBottom:12}}>
      <label style={{fontWeight:500}}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={form[key]} onChange={e=>onChange(key, e.target.value)}
          rows={4} style={{width:'100%', fontSize:14, padding:8, borderRadius:6, border:'1px solid #d0d7de'}}
        />
      ) : (
        <input
          type={type} value={form[key]} onChange={e=>onChange(key, e.target.value)}
          style={{width:'100%', fontSize:14, padding:8, borderRadius:6, border:'1px solid #d0d7de'}}
        />
      )}
    </div>
  );

  const previewRow = (label, value) => {
    const display = value == null ? '' : typeof value === 'string' ? value : String(value);
    const content = display.trim() ? display : '—';
    return (
      <div style={{display:'grid', gridTemplateColumns:'120px 1fr', gap:12, marginBottom:12}}>
        <div style={{color:'#6a737d'}}>{label}</div>
        <div style={{whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{content}</div>
      </div>
    );
  };

  const projectLead = [form.projectLead_name, form.projectLead_phone, form.projectLead_email]
    .filter(Boolean)
    .join(' ｜ ');

  return (
    <main style={{paddingBottom:32}}>
      <h1>发票（Invoice）</h1>
      <div style={{display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap'}}>
        <form
          onSubmit={handleGenerate}
          style={{flex:'1 1 360px', minWidth:320, maxWidth:560, background:'#fff', padding:24, borderRadius:12, border:'1px solid #e4e7eb', boxShadow:'0 8px 24px rgba(15,23,42,0.05)'}}
        >
          <h3 style={{marginTop:0}}>基本信息</h3>
          {row('客户姓名/公司', 'clientName')}
          {row('联系方式', 'contactInfo')}
          {row('发票编号（项目编号）', 'invoiceNo')}
          {row('开立日期', 'dateOfIssue', 'date')}
          {row('付款期限', 'paymentDue', 'date')}
          {row('币别（SGD/CNY/USD/EUR）', 'currency')}

          <h3>项目负责人</h3>
          {row('姓名', 'projectLead_name')}
          {row('电话', 'projectLead_phone')}
          {row('邮箱', 'projectLead_email')}

          <h3>项目与金额</h3>
          {row('项目（描述）', 'description', 'textarea')}
          {row('数量', 'qty')}
          {row('单价', 'unitPrice')}
          {row('金额', 'amount')}
          {row('单价合计', 'unitPriceTotal')}
          {row('金额合计', 'amountTotal')}
          {row('行程与服务详情日期', 'serviceDetailDate')}
          {row('费用包含', 'feeInclude', 'textarea')}
          {row('费用不含', 'feeExclude', 'textarea')}
          {row('总计', 'total')}

          <div style={{marginTop:24}}>
            <button
              type="submit"
              style={{padding:'12px 20px', fontSize:16, borderRadius:8, backgroundColor:'#2563eb', color:'#fff', border:'none', cursor:'pointer'}}
            >
              生成 DOCX
            </button>
          </div>
        </form>

        <aside
          style={{flex:'1 1 300px', minWidth:280, background:'#f8fafc', padding:24, borderRadius:12, border:'1px solid #e2e8f0', boxShadow:'inset 0 0 0 1px rgba(148,163,184,0.15)'}}
        >
          <h2 style={{marginTop:0, fontSize:20}}>即时预览</h2>
          <p style={{marginTop:4, marginBottom:24, color:'#64748b'}}>填写内容会实时显示在右侧，方便核对信息。</p>

          <section style={{marginBottom:24}}>
            <h3 style={{fontSize:16, marginBottom:12}}>基本信息</h3>
            {previewRow('客户姓名/公司', form.clientName)}
            {previewRow('联系方式', form.contactInfo)}
            {previewRow('发票编号', form.invoiceNo)}
            {previewRow('开立日期', form.dateOfIssue)}
            {previewRow('付款期限', form.paymentDue)}
            {previewRow('币别', form.currency)}
          </section>

          <section style={{marginBottom:24}}>
            <h3 style={{fontSize:16, marginBottom:12}}>项目负责人</h3>
            {previewRow('姓名', form.projectLead_name)}
            {previewRow('电话', form.projectLead_phone)}
            {previewRow('邮箱', form.projectLead_email)}
            {previewRow('信息汇总', projectLead)}
          </section>

          <section>
            <h3 style={{fontSize:16, marginBottom:12}}>项目与金额</h3>
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
        </aside>
      </div>
    </main>
  );
}
