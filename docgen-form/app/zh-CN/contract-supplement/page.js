import Link from 'next/link';
import baseStyles from '../formStyles.module.css';
import placeholderStyles from '../placeholder.module.css';

export const metadata = {
  title: '合同补充确认函 | Vanka 文档中心'
};

export default function ContractSupplementPage() {
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
          <h1 className={baseStyles.heading}>合同补充确认函</h1>
          <p className={placeholderStyles.description}>
            当项目在执行过程中需要补充条款、更新价格或调整责任边界时，补充确认函可以确保信息同步且具备法律效力。我们正在优化条款模块化配置与版本留存能力。
          </p>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>预计包含的能力</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>变更条款库：</strong> 可选择价格调整、服务扩展、时间顺延等常见条款，并支持自定义补充说明。
              </li>
              <li>
                <strong>版本记录：</strong> 每次补充都会自动生成版本号和生效日期，方便追踪历史记录。
              </li>
              <li>
                <strong>签署指引：</strong> 提供甲乙双方的签署位与盖章提示，可与确认函或合同一同打包导出。
              </li>
              <li>
                <strong>通知留痕：</strong> 生成可发送给客户的摘要邮件或通知文案，确保双方同步。
              </li>
            </ul>
          </section>

          <section className={placeholderStyles.section}>
            <h2 className={placeholderStyles.sectionTitle}>上线前的操作建议</h2>
            <ul className={placeholderStyles.list}>
              <li>
                <strong>梳理原始合同：</strong> 标记需要补充或替换的条款位置，并确认是否涉及价格或付款节点的更新。
              </li>
              <li>
                <strong>准备附件材料：</strong> 若涉及新增服务，请整理行程手册、报价单或确认函，方便在补充文件中引用。
              </li>
              <li>
                <strong>确认审批链路：</strong> 与法务、财务或项目负责人确认审批顺序，减少补充条款往返修改的时间。
              </li>
            </ul>
          </section>

          <div className={placeholderStyles.supportCard}>
            <h2 className={placeholderStyles.supportTitle}>暂时的执行方式</h2>
            <p className={placeholderStyles.supportBody}>
              可以在现有合同中添加补充协议附件，并借助确认函或邮件记录客户确认情况；上线后可将历史内容导入以生成标准版本。
            </p>
            <div className={placeholderStyles.linkRow}>
              <Link href="/zh-CN/confirmation" className={placeholderStyles.linkButton}>
                快速引用确认函
                <span aria-hidden>→</span>
              </Link>
              <Link href="/zh-CN/custom-service-single" className={placeholderStyles.linkButton}>
                查看合同准备事项
                <span aria-hidden>→</span>
              </Link>
            </div>
            <p className={placeholderStyles.note}>
              若补充条款较为复杂，建议先联系法务审核，我们也会在正式版本中提供合规校验提示。
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
