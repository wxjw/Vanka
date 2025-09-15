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
    <div style={{display:'grid', gridTemplateColumns:'220px 1fr', gap:12, alignItems:'center', marginBottom:12}}>
      <label>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={form[key]} onChange={e=>onChange(key, e.target.value)}
          rows={4} style={{width:'100%', fontSize:14, padding:8}}
        />
      ) : (
        <input
          type={type} value={form[key]} onChange={e=>onChange(key, e.target.value)}
          style={{width:'100%', fontSize:14, padding:8}}
        />
      )}
    </div>
  );

  return (
    <main>
      <h1>发票（Invoice）</h1>
      <form onSubmit={handleGenerate}>
        <h3>基本信息</h3>
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

        <div style={{marginTop:20}}>
          <button type="submit" style={{padding:'10px 16px', fontSize:16}}>生成 DOCX</button>
        </div>
      </form>
    </main>
  );
}
