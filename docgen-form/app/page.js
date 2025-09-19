'use client';
import Image from 'next/image';
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
  },
  {
    href: '/zh-CN/custom-service-single',
    icon: '🧭',
    title: '咨询及委托线路定制服务单次合同',
    description: '一次性定制线路合同模板，包含服务范围、费用条款与签署信息的完整结构。',
    chips: ['合同生成', '服务条款', '签署指引'],
    action: '创建合同'
  },
  {
    href: '/zh-CN/custom-service-framework',
    icon: '🗂️',
    title: '咨询及委托线路定制服务长期框架合同',
    description: '适用于长期合作的线路定制框架合同，支持分阶段交付与周期性结算约定。',
    chips: ['长期合作', '周期结算', '模板分段'],
    action: '搭建框架'
  },
  {
    href: '/zh-CN/travel-handbook',
    icon: '🧳',
    title: '旅行出行手册',
    description: '集合行程安排、注意事项与紧急联系方式的手册模板，随时导出分享。',
    chips: ['行程概览', '注意事项', '联系方式'],
    action: '整理手册'
  },
  {
    href: '/zh-CN/refund-confirmation',
    icon: '💳',
    title: '退款信息确认函',
    description: '快速整理退款金额、时间与方式，生成标准化的退款确认函并记录凭证。',
    chips: ['金额确认', '凭证记录', '通知客户'],
    action: '填写信息'
  },
  {
    href: '/zh-CN/contract-supplement',
    icon: '🧩',
    title: '合同补充确认函',
    description: '针对既有合同的补充说明或更新条款，一键生成带有版本记录的确认函。',
    chips: ['补充条款', '版本记录', '签署管理'],
    action: '新增补充'
  }
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.appBar}>
          <Link href="/" className={styles.brand} aria-label="Vanka 首页">
            <Image
              src="/branding/vanka-logo.svg"
              alt="Vanka"
              width={132}
              height={28}
              className={styles.brandLogo}
              priority
            />
          </Link>
          <Link href="#templates" className={styles.appBarAction}>
            查看模板
            <span aria-hidden>↓</span>
          </Link>
        </header>

        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>一站式文档生成中心</h1>
          <p className={styles.heroDescription}>
            遵循 Material Design 3 的系统规范并引入扁平磨砂的界面层次，为团队提供发票、确认函、合同与手册等多类型文档的统一生成体验。
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
