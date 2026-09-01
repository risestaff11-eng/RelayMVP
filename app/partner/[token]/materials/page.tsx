import { notFound } from "next/navigation";
import { getPartnerPortal } from "../../../../db/partner";
import { CopyTextButton } from "../../_components/partner-actions";

const kindNames: Record<string, string> = {
  OFFER: "ЧТО МЫ ПРЕДЛАГАЕМ", ICP: "КОГО ИСКАТЬ", SCRIPT: "ПЕРВЫЙ КОНТАКТ", DISCOVERY: "КВАЛИФИКАЦИЯ",
  OBJECTION: "РАБОТА С ВОЗРАЖЕНИЯМИ", PROCESS: "СЦЕНАРИЙ ПРОДАЖИ", FOLLOW_UP: "ПОВТОРНЫЙ КОНТАКТ", FAQ: "ВОПРОСЫ И ОТВЕТЫ",
  CASE: "КЕЙС", CHECKLIST: "ПОЛЕВОЙ ЧЕК-ЛИСТ", COMPLIANCE: "ВАЖНЫЕ ОГРАНИЧЕНИЯ", LINK: "ПОЛЕЗНАЯ ССЫЛКА", FILE: "ФАЙЛ",
};
const stageNames: Record<string, string> = { PREPARE: "Подготовка", OUTREACH: "Первый контакт", QUALIFY: "Квалификация", PRESENT: "Презентация", FOLLOW_UP: "Повторный контакт", CLOSE: "Передача результата" };
const channelNames: Record<string, string> = { ALL: "Все каналы", WHATSAPP: "WhatsApp", CALL: "Звонок", MEETING: "Встреча", EMAIL: "Email", SOCIAL: "Соцсети" };
const stageOrder = ["PREPARE", "OUTREACH", "QUALIFY", "PRESENT", "FOLLOW_UP", "CLOSE"];

export default async function MaterialsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getPartnerPortal(token);
  if (!portal) notFound();
  const instagram = portal.company.contactInstagram.replace(/^@/, "");
  const whatsappDigits = portal.company.contactWhatsapp.replace(/\D/g, "");
  const grouped = stageOrder.map((stage) => ({ stage, items: portal.knowledgeItems.filter((item) => item.salesStage === stage) })).filter((group) => group.items.length);

  return <div className="partner-portal-content knowledge-base-page">
    <div className="partner-page-heading"><div><span>ПОЛЕВАЯ БАЗА</span><h1>Подготовьтесь к разговору о {portal.company.name}</h1><p>Идите по порядку: разберитесь в продукте, найдите подходящего клиента, проведите разговор и передайте результат.</p></div></div>

    <section className="agent-company-overview"><div><small>ВЫ ПРЕДСТАВЛЯЕТЕ</small><h2>{portal.company.name}</h2><p>{portal.companyProfile?.businessDescription || portal.program.description || "Описание компании пока не добавлено."}</p></div><nav><a href={portal.company.website} target="_blank" rel="noreferrer">Сайт компании <span>↗</span></a>{instagram ? <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer">Instagram @{instagram} <span>↗</span></a> : <span>Instagram не указан компанией</span>}{whatsappDigits ? <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Здравствуйте! Я агент компании ${portal.company.name} в RiseStaff.`)}`} target="_blank" rel="noreferrer">WhatsApp компании <span>↗</span></a> : <span>WhatsApp не указан компанией</span>}</nav></section>

    {portal.knowledgeItems.length ? <>
      <section className="agent-field-route"><div><small>ВАШ МАРШРУТ</small><h2>От подготовки до результата</h2></div><nav>{grouped.map((group, index) => <a href={`#knowledge-${group.stage.toLowerCase()}`} key={group.stage}><b>{String(index + 1).padStart(2, "0")}</b><span>{stageNames[group.stage]}</span><small>{group.items.length} материалов</small></a>)}</nav></section>
      {grouped.map((group) => <section className="agent-knowledge-stage" id={`knowledge-${group.stage.toLowerCase()}`} key={group.stage}><header><span>{stageNames[group.stage]}</span><p>{group.stage === "PREPARE" ? "Сначала поймите продукт и границы обещаний." : group.stage === "OUTREACH" ? "Начните разговор без давления и получите разрешение продолжить." : group.stage === "QUALIFY" ? "Проверьте, подходит ли клиент, прежде чем передавать контакт." : group.stage === "PRESENT" ? "Свяжите потребность клиента с подтверждённой ценностью." : group.stage === "FOLLOW_UP" ? "Вернитесь к разговору с понятной причиной и следующим шагом." : "Зафиксируйте договорённость и корректно передайте результат."}</p></header><div className="company-knowledge-grid">{group.items.map((item) => <article key={item.id}>
          <div className="agent-knowledge-meta"><span>{kindNames[item.kind] || "МАТЕРИАЛ"}</span><small>{channelNames[item.channel] || "Все каналы"}</small></div>
          <h2>{item.title}</h2>{item.summary && <p className="agent-knowledge-summary">{item.summary}</p>}{item.audience && <div className="agent-knowledge-audience"><small>ДЛЯ КОГО</small><strong>{item.audience}</strong></div>}{item.content && <p>{item.content}</p>}{item.agentAction && <div className="agent-next-action"><small>СЛЕДУЮЩЕЕ ДЕЙСТВИЕ</small><strong>{item.agentAction}</strong></div>}
          <div>{item.content && <CopyTextButton text={item.content} label="Скопировать" />}{item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer">Открыть ссылку ↗</a>}{item.objectKey && <a href={`/api/partner/knowledge/${item.id}?token=${token}`}>Скачать {item.fileName || "файл"} ↓</a>}</div>
        </article>)}</div></section>)}
    </> : <section className="partner-large-empty"><span>▤</span><h2>Компания ещё готовит полевую базу</h2><p>Пока используйте условия заданий и контакты компании выше.</p></section>}

    <section className="materials-grid"><header className="agent-task-playbooks"><span>ПОД ВАШИ ЗАДАНИЯ</span><h2>Быстрый старт разговора</h2><p>Готовые сообщения и критерии по каждому доступному заданию.</p></header>{portal.missions.map((mission) => { const intro = `Здравствуйте! Хочу познакомить вас с компанией ${portal.company.name}. Возможно, вам будет полезно: «${mission.title.toLowerCase()}». Если актуально, организую короткое знакомство без обязательств.`; return <article key={mission.id}><span>{mission.programName}</span><h2>{mission.title}</h2><div className="knowledge-reward"><small>МОЖНО ЗАРАБОТАТЬ</small><strong>{mission.rewardLabel}</strong></div><blockquote>{intro}</blockquote><CopyTextButton text={intro} label="Скопировать сообщение" /><div><strong>Кого искать</strong><p>{mission.description}</p></div><div><strong>Что уточнить</strong>{mission.instructions.length ? <ul>{mission.instructions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Следуйте условиям задания.</p>}</div></article>; })}</section>
  </div>;
}
