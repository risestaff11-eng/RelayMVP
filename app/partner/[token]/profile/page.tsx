import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { PartnerProfileForm } from "../../_components/partner-actions";

export default async function PartnerProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const acceptedLead = portal.submissions.some((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status));
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ</span><h1>Профиль агента</h1><p>Заполните данные и подтвердите контакты. Без подтверждённых email и WhatsApp второй уровень не откроется.</p></div></div><div className="partner-profile-layout"><section className="partner-profile-level"><span>ТЕКУЩИЙ УРОВЕНЬ</span><div><b>{portal.profile.level}</b><h2>{portal.profile.level === 1 ? "Навигатор" : "Проверенный агент"}</h2></div><p>Серия полезных действий: <strong>{portal.profile.usefulActionStreak}</strong></p><ul><li className={portal.profile.emailVerifiedAt ? "done" : ""}>{portal.profile.emailVerifiedAt ? "✓" : "○"} Email подтверждён</li><li className={portal.profile.whatsappVerifiedAt ? "done" : ""}>{portal.profile.whatsappVerifiedAt ? "✓" : "○"} WhatsApp подтверждён</li><li className={acceptedLead ? "done" : ""}>{acceptedLead ? "✓" : "○"} Первый принятый лид</li></ul><p className="level-gate-note">Уровень 2 откроется только после выполнения всех трёх условий.</p></section><PartnerProfileForm token={token} partner={{ email: portal.partner.email, phone: portal.partner.phone }} profile={portal.profile} /></div></div>;
}
