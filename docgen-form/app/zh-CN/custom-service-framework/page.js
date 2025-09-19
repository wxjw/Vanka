import Link from 'next/link';
import baseStyles from '../formStyles.module.css';
import placeholderStyles from '../placeholder.module.css';

export const metadata = {
  title: '咨询及委托线路定制服务长期框架合同 | Vanka 文档中心'
};

export default function CustomServiceFrameworkContractPage() {
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
          <h1 className={baseStyles.heading}>咨询及委托线路定制服务长期框架合同</h1>
          <p className={placeholderStyles.description}>
            长期合作项目通常需要更灵活的交付节奏与费用结算方式。我们正在构建支持多批次服务安排、年度指标以及对账流程的框架合同模板。
          </p>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>计划上线的模块</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>合作范围规划：</strong> 约定年度或季度的服务目标、里程碑拆分以及双方资源投入方式。
              </li>
              <li>
                <strong>费用与结算机制：</strong> 可配置包干、按单或混合结算方案，并自动同步到内部结算表与发票工具。
              </li>
              <li>
                <strong>变更与追加：</strong> 预留年度额度调整、线路增补及紧急任务的快速确认流程。
              </li>
              <li>
                <strong>绩效与复盘：</strong> 支持记录阶段复盘、满意度调研和续约评估，形成长期合作档案。
              </li>
            </ul>
          </section>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>建议提前准备的材料</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>合作周期规划：</strong> 明确年度指标、服务频次以及是否涉及不同地区或产品线的安排。
              </li>
              <li>
                <strong>财务与法务要求：</strong> 梳理结算流程、开票抬头、专票/普票需求，以及需遵循的行业合规条款。
              </li>
              <li>
                <strong>协作机制：</strong> 指定双方项目负责人、例会节奏、交付验收标准和升级路径。
              </li>
            </ul>
          </section>

          <div className={placeholderStyles.supportCard}>
            <h2 className={placeholderStyles.supportTitle}>在此之前的替代方案</h2>
            <p className={placeholderStyles.supportBody}>
              可先使用单次合同范本或内部框架协议记录合作意向，并配合确认函与手册模板同步每次具体行程。
            </p>
            <div className={placeholderStyles.linkRow}>
              <Link href="/zh-CN/custom-service-single" className={placeholderStyles.linkButton}>
                查看单次合同指引
                <span aria-hidden>→</span>
              </Link>
              <Link href="/zh-CN/confirmation" className={placeholderStyles.linkButton}>
                使用预定确认函
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className={placeholderStyles.note}>
              欢迎在内测登记表中补充你的框架合同需求，我们会据此安排模板设计优先级。
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
