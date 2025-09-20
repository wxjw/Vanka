'use client';
import Link from 'next/link';
import JSZip from 'jszip';
import { useEffect, useMemo, useState } from 'react';
import styles from '../formStyles.module.css';

const CURRENCY_OPTIONS = [
  { code: 'SGD', label: 'SGD - 新加坡元' },
  { code: 'USD', label: 'USD - 美元' },
  { code: 'CNY', label: 'CNY - 人民币' },
  { code: 'HKD', label: 'HKD - 港币' },
  { code: 'EUR', label: 'EUR - 欧元' },
  { code: 'GBP', label: 'GBP - 英镑' },
  { code: 'JPY', label: 'JPY - 日元' },
  { code: 'AUD', label: 'AUD - 澳元' },
  { code: 'MYR', label: 'MYR - 马来西亚林吉特' }
];

const DEFAULT_BLOCK_LABELS = {
  serviceDetailTitle: '行程與服務詳情',
  feeIncludeTitle: '费用包含',
  feeExcludeTitle: '费用不含'
};

const BANK_DATA_SOURCE = '/data/bank-accounts.xlsx';

const getTodayIsoDate = () => {
  const now = new Date();
  const utcMs = now.getTime() - now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs).toISOString().slice(0, 10);
};

const columnLettersToIndex = letters => {
  if (!letters) return -1;
  let total = 0;
  for (let i = 0; i < letters.length; i += 1) {
    total = total * 26 + (letters.charCodeAt(i) - 64);
  }
  return total - 1;
};

const readCellText = cell => {
  if (!cell) return '';
  const inlineString = cell.getElementsByTagName('is')[0];
  if (inlineString) {
    const textNode = inlineString.getElementsByTagName('t')[0];
    return textNode?.textContent ?? '';
  }
  const valueNode = cell.getElementsByTagName('v')[0];
  return valueNode?.textContent ?? '';
};

const buildBlock = (title, fallbackTitle, content) => {
  const normalizedTitle = (title ?? '').trim() || fallbackTitle;
  const normalizedContent = (content ?? '').trim();
  const displayValue = normalizedContent || '—';
  const docValue = `${normalizedTitle}：\n${normalizedContent || '—'}`;
  return { title: normalizedTitle, value: normalizedContent, displayValue, docValue };
};

export default function InvoicePage() {
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const [form, setForm] = useState(() => ({
    clientName: '',
    contactInfo: '',
    invoiceNo: '',
    dateOfIssue: todayIso,
    paymentDue: '',
    currency: 'SGD',
    total: '',
    priceItems: [
      { description: '', qty: '', unitPrice: '', amount: '' }
    ],
    serviceDetailTitle: DEFAULT_BLOCK_LABELS.serviceDetailTitle,
    serviceDetail: '',
    feeIncludeTitle: DEFAULT_BLOCK_LABELS.feeIncludeTitle,
    feeInclude: '',
    feeExcludeTitle: DEFAULT_BLOCK_LABELS.feeExcludeTitle,
    feeExclude: ''
  }));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [bankOptions, setBankOptions] = useState([]);
  const [bankError, setBankError] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedBankCurrency, setSelectedBankCurrency] = useState('');

  const onChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const updatePriceItem = (index, key, value) => {
    setForm(prev => {
      const items = Array.isArray(prev.priceItems) ? prev.priceItems : [];
      const nextItems = items.map((item, idx) => (idx === index ? { ...item, [key]: value } : item));
      return { ...prev, priceItems: nextItems };
    });
  };

  const addPriceItem = () => {
    setForm(prev => {
      const items = Array.isArray(prev.priceItems) ? prev.priceItems : [];
      return {
        ...prev,
        priceItems: [...items, { description: '', qty: '', unitPrice: '', amount: '' }]
      };
    });
  };

  const removePriceItem = index => {
    setForm(prev => {
      const items = Array.isArray(prev.priceItems) ? prev.priceItems : [];
      if (items.length <= 1) return prev;
      const nextItems = items.filter((_, idx) => idx !== index);
      return { ...prev, priceItems: nextItems };
    });
  };

  useEffect(() => {
    let canceled = false;
    async function loadBankData() {
      try {
        const response = await fetch(BANK_DATA_SOURCE, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('无法读取银行配置文件。');
        }
        const buffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const sheetFile = zip.file('xl/worksheets/sheet1.xml');
        if (!sheetFile) {
          throw new Error('未在 Excel 中找到 sheet1 工作表。');
        }
        const sheetXml = await sheetFile.async('text');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(sheetXml, 'application/xml');
        const rowNodes = Array.from(xmlDoc.getElementsByTagName('row'));
        if (rowNodes.length === 0) {
          throw new Error('银行配置表为空。');
        }
        const headerCells = Array.from(rowNodes[0].getElementsByTagName('c'));
        const headers = headerCells.map(readCellText).map(text => text.trim());
        const bankMap = new Map();
        for (const row of rowNodes.slice(1)) {
          const cells = Array.from(row.getElementsByTagName('c'));
          if (!cells.length) continue;
          const rowData = {};
          for (const cell of cells) {
            const ref = cell.getAttribute('r') || '';
            const columnLetters = ref.replace(/\d+/g, '');
            const columnIndex = columnLettersToIndex(columnLetters);
            const header = headers[columnIndex];
            if (!header) continue;
            rowData[header] = readCellText(cell).trim();
          }
          const bankKey = rowData['Bank Key'] || rowData['Bank Name'];
          const currencyCode = (rowData['Currency'] || '').toUpperCase();
          if (!bankKey || !currencyCode) continue;
          const normalizedKey = bankKey.trim();
          if (!bankMap.has(normalizedKey)) {
            bankMap.set(normalizedKey, {
              id: normalizedKey,
              label: rowData['Bank Name']?.trim() || normalizedKey,
              currencies: []
            });
          }
          const bankEntry = bankMap.get(normalizedKey);
          bankEntry.currencies.push({
            code: currencyCode,
            bankKey: normalizedKey,
            bankName: rowData['Bank Name']?.trim() || normalizedKey,
            accountName: rowData['Account Name']?.trim() || '',
            accountNumber: rowData['Account Number']?.trim() || '',
            bankAddress: rowData['Bank Address']?.trim() || '',
            swiftCode: rowData['Swift Code']?.trim() || '',
            remarks: rowData['Remarks']?.trim() || ''
          });
        }
        const banks = Array.from(bankMap.values())
          .map(entry => ({
            ...entry,
            currencies: entry.currencies.sort((a, b) => a.code.localeCompare(b.code))
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans'));
        if (canceled) return;
        if (!banks.length) {
          throw new Error('未解析到有效的银行信息。');
        }
        setBankOptions(banks);
        const firstBank = banks[0];
        setSelectedBankId(firstBank.id);
        const firstCurrency = firstBank.currencies[0]?.code || '';
        setSelectedBankCurrency(firstCurrency);
        if (firstCurrency) {
          onChange('currency', firstCurrency);
        }
        setBankError('');
      } catch (err) {
        console.error('加载银行信息失败', err);
        if (canceled) return;
        setBankOptions([]);
        setBankError(
          err instanceof Error
            ? `${err.message} 请在 public/data/bank-accounts.xlsx 中维护信息。`
            : '加载银行信息失败，请检查 Excel 配置。'
        );
      }
    }
    loadBankData();
    return () => {
      canceled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBank = bankOptions.find(option => option.id === selectedBankId) || null;
  const selectedBankCurrencyEntry = selectedBank?.currencies.find(item => item.code === selectedBankCurrency) || null;

  const computed = useMemo(() => {
    const toNumber = value => {
      if (value == null) return 0;
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }
      const cleaned = String(value)
        .replace(/\s+/g, ' ')
        .replace(/[^0-9.,-]/g, '')
        .replace(/,/g, '');
      if (!cleaned) return 0;
      const numeric = parseFloat(cleaned);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const fmtMoney = (number, ccy) => {
      try {
        return new Intl.NumberFormat('en-SG', { style: 'currency', currency: ccy || 'SGD' }).format(number || 0);
      } catch {
        return `${ccy || 'SGD'} ${Number(number || 0).toFixed(2)}`;
      }
    };

    const parseIsoDate = input => {
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

    const currency = (form.currency || 'SGD').trim().toUpperCase() || 'SGD';

    const priceItemsSource = Array.isArray(form.priceItems) ? form.priceItems : [];
    const normalizedItems = priceItemsSource.map(item => {
      const description = typeof item?.description === 'string' ? item.description : '';
      const qtyInput = typeof item?.qty === 'string' ? item.qty : '';
      const unitPriceInput = typeof item?.unitPrice === 'string' ? item.unitPrice : '';
      const amountInput = typeof item?.amount === 'string' ? item.amount : '';

      const qtyDisplay = qtyInput.trim();
      const unitPriceDisplay = unitPriceInput.trim();
      const amountDisplay = amountInput.trim();

      const qtyNumber = toNumber(qtyInput);
      const unitPriceNumber = toNumber(unitPriceInput);
      const hasManualAmount = amountDisplay.length > 0;
      const hasQtyOrUnit = qtyDisplay.length > 0 || unitPriceDisplay.length > 0;
      const calculatedAmount = Number.isFinite(qtyNumber) && Number.isFinite(unitPriceNumber)
        ? qtyNumber * unitPriceNumber
        : 0;
      const normalizedAmountNumber = hasManualAmount
        ? toNumber(amountInput)
        : hasQtyOrUnit
          ? calculatedAmount
          : 0;

      const docQty = qtyDisplay || (Number.isFinite(qtyNumber) && qtyNumber !== 0 ? String(qtyNumber) : '');
      const docUnitPrice = unitPriceDisplay
        || (Number.isFinite(unitPriceNumber) && unitPriceNumber !== 0 ? fmtMoney(unitPriceNumber, currency) : '');
      const docAmount = amountDisplay
        || (hasQtyOrUnit ? fmtMoney(calculatedAmount, currency) : '');

      const previewQty = docQty || '—';
      const previewUnitPrice = docUnitPrice || '—';
      const previewAmount = docAmount || '—';

      const hasContent = [description, docQty, docUnitPrice, docAmount]
        .map(value => (typeof value === 'string' ? value.trim() : value))
        .some(Boolean);

      return {
        hasContent,
        amountNumber: Number.isFinite(normalizedAmountNumber) ? normalizedAmountNumber : 0,
        doc: {
          description: description || '',
          qty: docQty,
          unitPrice: docUnitPrice,
          amount: docAmount
        },
        preview: {
          description: description.trim() || '（未填写）',
          qty: previewQty,
          unitPrice: previewUnitPrice,
          amount: previewAmount
        }
      };
    });

    const docItems = normalizedItems.filter(item => item.hasContent).map(item => item.doc);
    const previewItems = normalizedItems.filter(item => item.hasContent).map(item => item.preview);
    const subtotalNumber = normalizedItems.reduce(
      (sum, item) => sum + (Number.isFinite(item.amountNumber) ? item.amountNumber : 0),
      0
    );
    const subtotalDisplay = fmtMoney(subtotalNumber, currency);

    const manualTotalInput = typeof form.total === 'string' ? form.total.trim() : '';
    const fallbackTotalDisplay = fmtMoney(subtotalNumber, currency);
    const totalDisplay = manualTotalInput || fallbackTotalDisplay;

    const issueMs = parseIsoDate(form.dateOfIssue);
    const dueMs = parseIsoDate(form.paymentDue);
    let daysToPay = '';
    if (Number.isFinite(issueMs) && Number.isFinite(dueMs)) {
      const diff = Math.round((dueMs - issueMs) / (24 * 60 * 60 * 1000));
      if (Number.isFinite(diff) && diff >= 0) {
        daysToPay = String(diff);
      }
    }

    const serviceBlock = buildBlock(
      form.serviceDetailTitle,
      DEFAULT_BLOCK_LABELS.serviceDetailTitle,
      form.serviceDetail
    );
    const feeIncludeBlock = buildBlock(
      form.feeIncludeTitle,
      DEFAULT_BLOCK_LABELS.feeIncludeTitle,
      form.feeInclude
    );
    const feeExcludeBlock = buildBlock(
      form.feeExcludeTitle,
      DEFAULT_BLOCK_LABELS.feeExcludeTitle,
      form.feeExclude
    );

    return {
      currency,
      daysToPay,
      projectBlocks: [serviceBlock, feeIncludeBlock, feeExcludeBlock],
      docText: {
        serviceDetails: serviceBlock.docValue,
        feeInclude: feeIncludeBlock.docValue,
        feeExclude: feeExcludeBlock.docValue
      },
      price: {
        docItems,
        previewItems,
        hasItems: docItems.length > 0,
        subtotalDisplay,
        totalDisplay,
        fallbackTotalDisplay,
        manualTotalInput
      }
    };
  }, [
    form.priceItems,
    form.total,
    form.currency,
    form.dateOfIssue,
    form.paymentDue,
    form.serviceDetailTitle,
    form.serviceDetail,
    form.feeIncludeTitle,
    form.feeInclude,
    form.feeExcludeTitle,
    form.feeExclude
  ]);

  const previewItems = computed.price.previewItems;
  const dueDisplay = form.paymentDue?.trim()
    ? computed.daysToPay
      ? `${form.paymentDue.trim()}（付款期限 ${computed.daysToPay} 天）`
      : form.paymentDue.trim()
    : computed.daysToPay
      ? `付款期限 ${computed.daysToPay} 天`
      : '—';
  const currencyDisplay = (form.currency || computed.currency || 'SGD').trim().toUpperCase() || 'SGD';
  const contactInfoDisplay = form.contactInfo?.trim() || 'N/A';

  const bankPreview = selectedBankCurrencyEntry
    ? {
        bankName: selectedBankCurrencyEntry.bankName,
        currency: selectedBankCurrencyEntry.code,
        accountName: selectedBankCurrencyEntry.accountName || '—',
        accountNumber: selectedBankCurrencyEntry.accountNumber || '—',
        swiftCode: selectedBankCurrencyEntry.swiftCode || '—',
        bankAddress: selectedBankCurrencyEntry.bankAddress || '—',
        remarks: selectedBankCurrencyEntry.remarks || '—'
      }
    : null;

  async function handleGenerate(event) {
    event.preventDefault();
    setIsGenerating(true);
    setError('');

    const currency = computed.currency;
    const normalizedCurrency = currency || 'SGD';

    const items = computed.price.docItems;
    const unitPriceSubtotal = computed.price.subtotalDisplay;
    const amountSubtotal = computed.price.subtotalDisplay;
    const totalAmount = computed.price.totalDisplay;

    const bankDoc = selectedBankCurrencyEntry
      ? {
          name: [selectedBankCurrencyEntry.bankName, selectedBankCurrencyEntry.code ? `(${selectedBankCurrencyEntry.code})` : '']
            .filter(Boolean)
            .join(' '),
          accountNumber: selectedBankCurrencyEntry.accountNumber
            ? `Account No: ${selectedBankCurrencyEntry.accountNumber}`
            : '',
          extras: [
            selectedBankCurrencyEntry.accountName ? `Account Name: ${selectedBankCurrencyEntry.accountName}` : '',
            selectedBankCurrencyEntry.swiftCode ? `SWIFT: ${selectedBankCurrencyEntry.swiftCode}` : '',
            selectedBankCurrencyEntry.bankAddress ? `Address: ${selectedBankCurrencyEntry.bankAddress}` : '',
            selectedBankCurrencyEntry.remarks ? `Notes: ${selectedBankCurrencyEntry.remarks}` : ''
          ]
            .filter(Boolean)
            .join(' / ')
        }
      : { name: '', accountNumber: '', extras: '' };

    const data = {
      billTo_name: form.clientName || '',
      billTo_contact: contactInfoDisplay,
      invoiceNo: form.invoiceNo || '',
      dateOfIssue: form.dateOfIssue || '',
      paymentDue: form.paymentDue || '',
      currency: normalizedCurrency,
      projectLead: {
        name: bankDoc.name,
        phone: bankDoc.accountNumber,
        email: bankDoc.extras
      },
      items,
      unitPriceSubtotal,
      amountSubtotal,
      serviceDetails: computed.docText.serviceDetails,
      feeInclude: computed.docText.feeInclude,
      feeExclude: computed.docText.feeExclude,
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
              <h2 className={styles.sectionTitle}>开票至（Bill To）</h2>
              <p className={styles.sectionHint}>填写客户抬头与联系信息。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>客户姓名/公司 (Client Name/Company)</span>
                <input
                  className={styles.textControl}
                  value={form.clientName}
                  onChange={event => onChange('clientName', event.target.value)}
                  placeholder="如：示例科技有限公司"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>联络方式 (Contact Info)</span>
                <input
                  className={styles.textControl}
                  value={form.contactInfo}
                  onChange={event => onChange('contactInfo', event.target.value)}
                  placeholder="邮箱或电话"
                />
              </label>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>发票与账期信息</h2>
              <p className={styles.sectionHint}>发票编号请填写飞书的项目编号。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>发票编号</span>
                <input
                  className={styles.textControl}
                  value={form.invoiceNo}
                  onChange={event => onChange('invoiceNo', event.target.value)}
                  placeholder="例如：FS-PRJ-2024-001"
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
                <select
                  className={styles.selectControl}
                  value={form.currency}
                  onChange={event => {
                    const nextCurrency = event.target.value;
                    onChange('currency', nextCurrency);
                    if (selectedBank?.currencies.some(item => item.code === nextCurrency)) {
                      setSelectedBankCurrency(nextCurrency);
                    }
                  }}
                >
                  {CURRENCY_OPTIONS.map(option => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>收款信息</h2>
              <p className={styles.sectionHint}>选择银行和币种后会自动带出收款账户详情。</p>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>收款银行</span>
                <select
                  className={styles.selectControl}
                  value={selectedBankId}
                  onChange={event => {
                    const nextBankId = event.target.value;
                    setSelectedBankId(nextBankId);
                    const bank = bankOptions.find(option => option.id === nextBankId);
                    const firstCurrency = bank?.currencies[0]?.code || '';
                    setSelectedBankCurrency(firstCurrency);
                    if (firstCurrency) {
                      onChange('currency', firstCurrency);
                    }
                  }}
                >
                  {bankOptions.length ? null : <option value="">未找到银行信息</option>}
                  {bankOptions.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>收款币种</span>
                <select
                  className={styles.selectControl}
                  value={selectedBankCurrency}
                  onChange={event => {
                    const nextCurrency = event.target.value;
                    setSelectedBankCurrency(nextCurrency);
                    if (nextCurrency) {
                      onChange('currency', nextCurrency);
                    }
                  }}
                  disabled={!selectedBank?.currencies.length}
                >
                  {selectedBank?.currencies.length
                    ? selectedBank.currencies.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.code}
                        </option>
                      ))
                    : <option value="">无可选币种</option>}
                </select>
              </label>
            </div>
            {bankError ? <div className={styles.errorBanner}>{bankError}</div> : null}
            {bankPreview ? (
              <dl className={styles.detailList}>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>银行名称</dt>
                  <dd className={styles.detailValue}>{`${bankPreview.bankName}（${bankPreview.currency}）`}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>账户名称</dt>
                  <dd className={styles.detailValue}>{bankPreview.accountName}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>账户号码</dt>
                  <dd className={styles.detailValue}>{bankPreview.accountNumber}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>SWIFT/BIC</dt>
                  <dd className={styles.detailValue}>{bankPreview.swiftCode}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>银行地址</dt>
                  <dd className={styles.detailValue}>{bankPreview.bankAddress}</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt className={styles.detailTerm}>备注</dt>
                  <dd className={styles.detailValue}>{bankPreview.remarks}</dd>
                </div>
              </dl>
            ) : (
              <p className={styles.sectionHint}>请选择银行与币种，或更新 public/data/bank-accounts.xlsx。</p>
            )}
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>项目内容</h2>
              <p className={styles.sectionHint}>可修改各模块标题，内容支持多行填写。</p>
            </div>
            <div className={styles.projectContentGrid}>
              <div className={styles.projectModule}>
                <div className={styles.projectTitleInput}>
                  <input
                    className={styles.textControl}
                    value={form.serviceDetailTitle}
                    onChange={event => onChange('serviceDetailTitle', event.target.value)}
                    placeholder="行程與服務詳情"
                    aria-label="项目内容模块标题"
                  />
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{form.serviceDetailTitle || DEFAULT_BLOCK_LABELS.serviceDetailTitle}</span>
                  <textarea
                    className={styles.textControl}
                    value={form.serviceDetail}
                    onChange={event => onChange('serviceDetail', event.target.value)}
                    placeholder="请描述行程安排、交付内容等关键信息"
                    rows={6}
                  />
                </label>
              </div>
              <div className={styles.projectModule}>
                <div className={styles.projectTitleInput}>
                  <input
                    className={styles.textControl}
                    value={form.feeIncludeTitle}
                    onChange={event => onChange('feeIncludeTitle', event.target.value)}
                    placeholder="费用包含"
                    aria-label="项目内容模块标题"
                  />
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{form.feeIncludeTitle || DEFAULT_BLOCK_LABELS.feeIncludeTitle}</span>
                  <textarea
                    className={styles.textControl}
                    value={form.feeInclude}
                    onChange={event => onChange('feeInclude', event.target.value)}
                    placeholder="列出包含的服务、交通、用餐等"
                    rows={6}
                  />
                </label>
              </div>
              <div className={styles.projectModule}>
                <div className={styles.projectTitleInput}>
                  <input
                    className={styles.textControl}
                    value={form.feeExcludeTitle}
                    onChange={event => onChange('feeExcludeTitle', event.target.value)}
                    placeholder="费用不含"
                    aria-label="项目内容模块标题"
                  />
                </div>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{form.feeExcludeTitle || DEFAULT_BLOCK_LABELS.feeExcludeTitle}</span>
                  <textarea
                    className={styles.textControl}
                    value={form.feeExclude}
                    onChange={event => onChange('feeExclude', event.target.value)}
                    placeholder="列出需客户自理的费用"
                    rows={5}
                  />
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>项目价格</h2>
              <p className={styles.sectionHint}>填写单项数量、单价与金额，系统会生成汇总。</p>
            </div>
            <div className={styles.priceItemsList}>
              {form.priceItems.map((item, index) => (
                <div key={index} className={styles.priceItemCard}>
                  <div className={styles.priceItemHeader}>
                    <span className={styles.priceItemTitle}>费用项目 {index + 1}</span>
                    <div className={styles.priceItemActions}>
                      {form.priceItems.length > 1 ? (
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={() => removePriceItem(index)}
                          aria-label={`删除费用项目 ${index + 1}`}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.priceItemGrid}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>名称</span>
                      <input
                        className={styles.textControl}
                        value={item.description}
                        onChange={event => updatePriceItem(index, 'description', event.target.value)}
                        placeholder="如：顾问服务费用"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>数量</span>
                      <input
                        className={styles.textControl}
                        value={item.qty}
                        onChange={event => updatePriceItem(index, 'qty', event.target.value)}
                        placeholder="如：10"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>单价</span>
                      <input
                        className={styles.textControl}
                        value={item.unitPrice}
                        onChange={event => updatePriceItem(index, 'unitPrice', event.target.value)}
                        placeholder="支持输入金额或格式化文本"
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>合计</span>
                      <input
                        className={styles.textControl}
                        value={item.amount}
                        onChange={event => updatePriceItem(index, 'amount', event.target.value)}
                        placeholder="未填写则自动计算"
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" className={styles.secondaryButton} onClick={addPriceItem}>
                + 添加费用项目
              </button>
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>总计金额</span>
              <input
                className={styles.textControl}
                value={form.total}
                onChange={event => onChange('total', event.target.value)}
                placeholder={`未填写则默认 ${computed.price.fallbackTotalDisplay}`}
              />
              <span className={styles.fieldHint}>系统会根据以上项目自动合计：{computed.price.fallbackTotalDisplay}</span>
            </label>
          </section>

          <div className={styles.buttonRow}>
            <button type="submit" className={styles.primaryButton} disabled={isGenerating}>
              {isGenerating ? '正在生…' : '生成 DOCX 发票'}
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
              <h3 className={styles.previewSectionTitle}>开票信息</h3>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>客户名称</span>
                <span className={styles.previewValue}>{form.clientName?.trim() || '—'}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>联络方式</span>
                <span className={styles.previewValue}>{contactInfoDisplay}</span>
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
              <h3 className={styles.previewSectionTitle}>收款信息</h3>
              {bankPreview ? (
                <>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>银行</span>
                    <span className={styles.previewValue}>{`${bankPreview.bankName}（${bankPreview.currency}）`}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>账户名称</span>
                    <span className={styles.previewValue}>{bankPreview.accountName}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>账户号码</span>
                    <span className={styles.previewValue}>{bankPreview.accountNumber}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>SWIFT/BIC</span>
                    <span className={styles.previewValue}>{bankPreview.swiftCode}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>银行地址</span>
                    <span className={styles.previewValue}>{bankPreview.bankAddress}</span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>备注</span>
                    <span className={styles.previewValue}>{bankPreview.remarks}</span>
                  </div>
                </>
              ) : (
                <div className={styles.previewItem}>
                  <span className={styles.previewLabel}>银行</span>
                  <span className={styles.previewValue}>待选择</span>
                </div>
              )}
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>项目内容</h3>
              {computed.projectBlocks.map((block, index) => (
                <div key={index} className={styles.previewItem}>
                  <span className={styles.previewLabel}>{block.title}</span>
                  <span className={styles.previewValue}>{block.displayValue}</span>
                </div>
              ))}
            </section>

            <section className={styles.previewSection}>
              <h3 className={styles.previewSectionTitle}>项目价格</h3>
              {computed.price.hasItems ? (
                <div className={styles.previewPriceList}>
                  {previewItems.map((item, index) => (
                    <div key={index} className={styles.previewPriceItem}>
                      <div className={styles.previewPriceHeader}>
                        <span className={styles.previewPriceName}>{item.description}</span>
                        <span className={styles.previewPriceAmount}>{item.amount}</span>
                      </div>
                      <div className={styles.previewPriceMeta}>
                        <span>数量：{item.qty}</span>
                        <span>单价：{item.unitPrice}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyPreviewHint}>暂未添加费用项目。</p>
              )}
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>总计</span>
                <span className={styles.previewValue}>{computed.price.totalDisplay || '—'}</span>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
