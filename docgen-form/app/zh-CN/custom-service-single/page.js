import Link from 'next/link';
import baseStyles from '../formStyles.module.css';
import placeholderStyles from '../placeholder.module.css';

export const metadata = {
  title: '咨询及委托线路定制服务单次合同 | Vanka 文档中心'
};

export default function CustomServiceSingleContractPage() {
  return (
    <div className={baseStyles.page}>
      <div className={placeholderStyles.wrapper}>
        <div className={baseStyles.topBar}>
          <Link href="/" className={baseStyles.backLink}>
            <span className={baseStyles.backIcon} aria-hidden>
              ←
            </span>
            返回首页
          </Link>
          <span className={placeholderStyles.statusBadge}>
            <span className={placeholderStyles.statusDot} aria-hidden />
            建设中
          </span>
        </div>

        <main className={placeholderStyles.main}>
          <h1 className={baseStyles.heading}>咨询及委托线路定制服务单次合同</h1>
          <p className={placeholderStyles.description}>
            我们正在为一次性线路定制项目打磨结构化的合同模板，帮助团队快速说明服务范围、里程碑与费用节奏，并在生成文档时保留签署方的核心信息。
          </p>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>即将提供的内容</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>核心条款：</strong> 规范服务范围、交付物、服务期限与质量标准，确保各方对交付边界达成一致。
              </li>
              <li>
                <strong>费用与支付：</strong> 支持设定定金、阶段款和尾款等付款节点，可一键同步到确认函或发票模块。
              </li>
              <li>
                <strong>双方义务：</strong> 明确委托方提供资料的时限与方式，以及服务团队的沟通、变更与保密义务。
              </li>
              <li>
                <strong>违约与取消：</strong> 预置违约责任、变更处理及退款说明，方便在项目发生调整时快速引用。
              </li>
            </ul>
          </section>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>上线前的准备建议</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>确认客户信息：</strong> 收集公司/个人名称、统一社会信用代码或证件信息，以及合同签署联系人。
              </li>
              <li>
                <strong>整理服务需求：</strong> 归纳线路的主要站点、服务日期、包含/不包含项目，便于后续生成附件或手册。
              </li>
              <li>
                <strong>规划付款节点：</strong> 提前与财务确认定金比例、到账方式与开票要求，减少合同签署后的往返沟通。
              </li>
            </ul>
          </section>

          <div className={placeholderStyles.supportCard}>
            <h2 className={placeholderStyles.supportTitle}>现在可以怎么做？</h2>
            <p className={placeholderStyles.supportBody}>
              在模板发布之前，可使用确认函与发票工具记录项目基础信息，并将整理好的需求文档附加到现有合同范本中。
            </p>
            <div className={placeholderStyles.linkRow}>
              <Link href="/zh-CN/confirmation" className={placeholderStyles.linkButton}>
                前往预定信息确认函
                <span aria-hidden>→</span>
              </Link>
              <Link href="/zh-CN/invoice" className={placeholderStyles.linkButton}>
                快速生成发票
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className={placeholderStyles.note}>
              需要优先体验该合同？请在团队协作平台反馈需求，产品团队会第一时间同步进度。
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
