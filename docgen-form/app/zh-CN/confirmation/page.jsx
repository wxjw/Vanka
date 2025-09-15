'use client';
import {useState} from 'react';

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
  const onChange = (k,v) => setForm(prev=>({...prev,[k]:v}));

  async function handleGenerate(e){
    e.preventDefault();

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

    const res = await fetch('/api/generate', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ templateKey, data, meta })
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
        <textarea rows={4} style={{width:'100%', fontSize:14, padding:8}}
          value={form[key]} onChange={e=>onChange(key, e.target.value)} />
      ) : (
        <input style={{width:'100%', fontSize:14, padding:8}}
          type={type} value={form[key]} onChange={e=>onChange(key, e.target.value)} />
      )}
    </div>
  );

  return (
    <main>
      <h1>预定信息确认函</h1>

      <div style={{margin:'12px 0'}}>
        <label>模板品牌：</label>
        <select value={brand} onChange={e=>setBrand(e.target.value)}>
          <option value="vanka">万咖</option>
          <option value="duoji">多吉</option>
        </select>
      </div>

      <form onSubmit={handleGenerate}>
        {row('收件人姓名','recipientName')}
        {row('确认单编号（项目编号）','referenceNo')}
        {row('出具日期','issueDate','date')}
        {row('定金支付截止日期','payByDate','date')}
        {row('定金金额（CNY）','payAmountCNY')}
        {row('大写金额','payAmountUppercase')}
        {row('联系人姓名','contactName')}
        {row('联系人电话','contactPhone')}
        {row('联系人邮箱','contactEmail')}
        {row('行程信息','itinerary','textarea')}
        {row('限制信息','restrictions','textarea')}
        {row('其他信息','others','textarea')}
        {row('备注','remark','textarea')}

        <div style={{marginTop:20}}>
          <button type="submit" style={{padding:'10px 16px', fontSize:16}}>生成 DOCX</button>
        </div>
      </form>
    </main>
  );
}
