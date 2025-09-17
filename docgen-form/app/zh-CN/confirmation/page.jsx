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
    <div style={{display:'grid', gridTemplateColumns:'140px 1fr', gap:12, alignItems:'center', marginBottom:12}}>
      <label style={{fontWeight:500}}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          style={{width:'100%', fontSize:14, padding:8, borderRadius:6, border:'1px solid #d0d7de'}}
          value={form[key]} onChange={e=>onChange(key, e.target.value)}
        />
      ) : (
        <input
          style={{width:'100%', fontSize:14, padding:8, borderRadius:6, border:'1px solid #d0d7de'}}
          type={type} value={form[key]} onChange={e=>onChange(key, e.target.value)}
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

  return (
    <main style={{paddingBottom:32}}>
      <h1>预定信息确认函</h1>

      <div style={{display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap'}}>
        <form
          onSubmit={handleGenerate}
          style={{flex:'1 1 360px', minWidth:320, maxWidth:560, background:'#fff', padding:24, borderRadius:12, border:'1px solid #e4e7eb', boxShadow:'0 8px 24px rgba(15,23,42,0.05)'}}
        >
          <div style={{margin:'12px 0 24px'}}>
            <label style={{marginRight:8}}>模板品牌：</label>
            <select
              value={brand}
              onChange={e=>setBrand(e.target.value)}
              style={{padding:'6px 10px', borderRadius:6, border:'1px solid #d0d7de'}}
            >
              <option value="vanka">万咖</option>
              <option value="duoji">多吉</option>
            </select>
          </div>

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
          <p style={{marginTop:4, marginBottom:24, color:'#64748b'}}>左侧填写的内容会实时呈现，确认无误后再生成文档。</p>

          <section style={{marginBottom:24}}>
            <h3 style={{fontSize:16, marginBottom:12}}>基础信息</h3>
            {previewRow('收件人姓名', form.recipientName)}
            {previewRow('确认单编号', form.referenceNo)}
            {previewRow('出具日期', form.issueDate)}
            {previewRow('定金支付截止日期', form.payByDate)}
            {previewRow('定金金额（CNY）', form.payAmountCNY)}
            {previewRow('金额大写', form.payAmountUppercase)}
          </section>

          <section style={{marginBottom:24}}>
            <h3 style={{fontSize:16, marginBottom:12}}>联系人</h3>
            {previewRow('姓名', form.contactName)}
            {previewRow('电话', form.contactPhone)}
            {previewRow('邮箱', form.contactEmail)}
          </section>

          <section>
            <h3 style={{fontSize:16, marginBottom:12}}>详细信息</h3>
            {previewRow('行程信息', form.itinerary)}
            {previewRow('限制信息', form.restrictions)}
            {previewRow('其他信息', form.others)}
            {previewRow('备注', form.remark)}
            {previewRow('品牌模板', brand === 'vanka' ? '万咖' : '多吉')}
          </section>
        </aside>
      </div>
    </main>
  );
}
