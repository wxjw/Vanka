'use client';
import Link from 'next/link';
import styles from './home.module.css';

const CARDS = [
  {
    href: '/zh-CN/invoice',
    icon: '🧾',
    title: '发票（Invoice）',
    description: '填写客户、项目与金额信息，自动计算金额并一键导出符合模板的 DOCX 发票。',
    chips: ['DOCX 输出', '自动金额计算', '付款期限提醒'],
    action: '前往填写'
  },
  {
    href: '/zh-CN/confirmation',
    icon: '📄',
    title: '预定信息确认函',
    description: '分步骤完成确认函填写、预览与盖章，实时生成 PDF 预览并支持自定义印章。',
    chips: ['PDF 预览', '多品牌模板', '在线盖章'],
    action: '开始预览'
  }
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.appBar}>
          <span className={styles.brand}>Vanka Docs</span>
          <Link href="#templates" className={styles.appBarAction}>
            查看模板
            <span aria-hidden>↓</span>
          </Link>
        </header>

        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>一站式文档生成中心</h1>
          <p className={styles.heroDescription}>
            遵循 Material Design 3 设计语言，帮助团队快速生成发票与预定确认函。填写表单即可实时预览，自动化输出所需文档。
          </p>
          <Link href="/zh-CN/invoice" className={styles.primaryLink}>
            开始创建发票
            <span aria-hidden>→</span>
          </Link>
        </section>

        <section id="templates" className={styles.cardGrid}>
          {CARDS.map(card => (
            <article key={card.href} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon} aria-hidden>{card.icon}</span>
                <h2 className={styles.cardTitle}>{card.title}</h2>
              </div>
              <p className={styles.cardDescription}>{card.description}</p>
              {card.chips?.length ? (
                <div className={styles.chipRow}>
                  {card.chips.map(chip => (
                    <span key={chip} className={styles.chip}>{chip}</span>
                  ))}
                </div>
              ) : null}
              <Link href={card.href} className={styles.cardAction}>
                {card.action}
                <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
