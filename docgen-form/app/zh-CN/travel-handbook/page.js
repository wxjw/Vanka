import Link from 'next/link';
import baseStyles from '../formStyles.module.css';
import placeholderStyles from '../placeholder.module.css';

export const metadata = {
  title: '旅行出行手册 | Vanka 文档中心'
};

export default function TravelHandbookPage() {
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
          <h1 className={baseStyles.heading}>旅行出行手册</h1>
          <p className={placeholderStyles.description}>
            出行手册会汇总完整的行程安排、携带建议和紧急联系方式，帮助客户在出发前获取所有关键信息。模板正在设计中，我们会在发布后提供多语言导出能力。
          </p>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>手册将包含</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>日程总览：</strong> 每日行程亮点、交通与集合信息，以及可选体验的提醒。
              </li>
              <li>
                <strong>准备事项：</strong> 打包建议、天气提示、签证/保险状态与注意事项清单。
              </li>
              <li>
                <strong>服务说明：</strong> 领队与当地伙伴联系方式、应急流程以及服务范围界定。
              </li>
              <li>
                <strong>附录资源：</strong> 可插入电子票、地图链接、常用语对照表等附件，便于客户随时查阅。
              </li>
            </ul>
          </section>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>现在可以提前准备</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>整理行程表：</strong> 将每日时间表和活动安排录入到确认函或项目管理工具，后续可一键导入手册。
              </li>
              <li>
                <strong>收集联系方式：</strong> 维护领队、紧急联系人和目的地服务商的通讯方式，确保手册信息准确。
              </li>
              <li>
                <strong>沉淀素材：</strong> 准备目的地图片、餐饮及文化亮点介绍，发布时即可在手册中展示品牌调性。
              </li>
            </ul>
          </section>

          <div className={placeholderStyles.supportCard}>
            <h2 className={placeholderStyles.supportTitle}>临时解决方案</h2>
            <p className={placeholderStyles.supportBody}>
              可将确认函导出的 PDF 作为基础信息，同时附加自定义的行前提醒文档，或在内部知识库维护最新的出行说明链接。
            </p>
            <div className={placeholderStyles.linkRow}>
              <Link href="/zh-CN/confirmation" className={placeholderStyles.linkButton}>
                使用预定确认函
                <span aria-hidden>→</span>
              </Link>
              <Link href="/zh-CN/invoice" className={placeholderStyles.linkButton}>
                管理关联订单
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className={placeholderStyles.note}>
              若你已有手册范本，欢迎反馈给产品团队，我们会在上线版本中提供导入支持。
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
