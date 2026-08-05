import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { PartnerProfileForm } from "../../_components/partner-actions";

export default async function PartnerProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  return <div className="partner-portal-content"><div className="partner-page-heading"><div><span>ПЕРСОНАЛЬНЫЕ РЕКОМЕНДАЦИИ</span><h1>Профиль партнёра</h1><p>Контакты, география и компетенции помогают компании связываться с вами и подбирать подходящие миссии.</p></div></div><div className="partner-profile-layout"><section className="partner-profile-level"><span>ТЕКУЩИЙ УРОВЕНЬ</span><div><b>{portal.profile.level}</b><h2>{portal.profile.level === 1 ? "Навигатор" : "Проверенный партнёр"}</h2></div><p>Серия полезных действий: <strong>{portal.profile.usefulActionStreak}</strong></p><ul><li className="done">✓ Защищённый профиль создан</li><li className={portal.submissions.length ? "done" : ""}>{portal.submissions.length ? "✓" : "○"} Первая рекомендация</li><li className={portal.submissions.some((item) => ["ACCEPTED", "IN_PROGRESS", "DEAL", "REWARDED"].includes(item.status)) ? "done" : ""}>○ Первый принятый лид</li></ul></section><PartnerProfileForm token={token} partner={{ email: portal.partner.email, phone: portal.partner.phone }} profile={portal.profile} /></div></div>;
}
