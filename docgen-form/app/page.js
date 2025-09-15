'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{padding:24, maxWidth:980, margin:'0 auto'}}>
      <h1>文档生成器</h1>
      <p>请选择要填写的类型：</p>
      <ul>
        <li><Link href="/zh-CN/invoice">发票（Invoice）</Link></li>
        <li><Link href="/zh-CN/confirmation">预定信息确认函（万咖/多吉）</Link></li>
      </ul>
    </main>
  );
}
