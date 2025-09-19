import Link from 'next/link';
import baseStyles from '../formStyles.module.css';
import placeholderStyles from '../placeholder.module.css';

export const metadata = {
  title: '退款信息确认函 | Vanka 文档中心'
};

export default function RefundConfirmationPage() {
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
          <h1 className={baseStyles.heading}>退款信息确认函</h1>
          <p className={placeholderStyles.description}>
            退款确认函将用于向客户说明退款原因、金额、到账时间以及付款渠道，便于双方留存凭证并追踪后续进度。目前页面正在完善导出格式与审批流程。
          </p>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>模板重点规划</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>退款概览：</strong> 包含原订单信息、退款项目、币种和对应金额，支持自动换算多币种成本。
              </li>
              <li>
                <strong>到账安排：</strong> 记录退款账户、到账渠道、预计到账日期及跟进联系人。
              </li>
              <li>
                <strong>附件说明：</strong> 可附上客户确认截图、银行水单或内部审批记录，确保审计留痕。
              </li>
              <li>
                <strong>审批签署：</strong> 支持财务与业务负责人电子签名，并同步到内部退款台账。
              </li>
            </ul>
          </section>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>在模板上线前的建议流程</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>整理退款依据：</strong> 通过确认函或合同补充记录退款触发条件，方便在文档中引用原始约定。
              </li>
              <li>
                <strong>同步财务状态：</strong> 与财务确认退款路径、收款人姓名及银行卡/支付宝等关键信息。
              </li>
              <li>
                <strong>留存沟通记录：</strong> 将客户确认邮件或聊天截图整理到共享空间，后续可以直接插入模板附件区。
              </li>
            </ul>
          </section>

          <div className={placeholderStyles.supportCard}>
            <h2 className={placeholderStyles.supportTitle}>当前可用工具</h2>
            <p className={placeholderStyles.supportBody}>
              建议先用预定确认函说明调整内容，随后在发票模块补充负数行或备注退款信息，等待正式模板上线后再输出标准文档。
            </p>
            <div className={placeholderStyles.linkRow}>
              <Link href="/zh-CN/confirmation" className={placeholderStyles.linkButton}>
                查看预定确认函
                <span aria-hidden>→</span>
              </Link>
              <Link href="/zh-CN/invoice" className={placeholderStyles.linkButton}>
                更新发票/对账
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className={placeholderStyles.note}>
              如需加急开通退款模板，请提交业务场景和预计使用时间，我们会主动联系支持。
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
