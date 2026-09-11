"use client";

import { useRef, useState, type FormEvent } from "react";
import { readMarketingAttribution } from "../marketing-analytics";

const stages = [
  { label: "Новая", title: "Партнёр передал контакт", detail: "Покупатель ищет двухкомнатную квартиру. Контакт и автор рекомендации сохранены.", reward: "Условие: после сделки", note: "Следующий шаг: проверить контакт и связаться с клиентом." },
  { label: "В работе", title: "Менеджер принял клиента", detail: "Контакт проверен. Менеджер уточняет запрос и подбирает подходящие объекты.", reward: "Ожидает результата", note: "Следующий шаг: провести показы и обновить статус." },
  { label: "Выплата", title: "Сделка закрыта", detail: "Агентство получило комиссию. Вознаграждение партнёру начислено по условиям программы.", reward: "50 000 ₸ к выплате", note: "Следующий шаг: перечислить деньги и отметить выплату." },
];

export function BrokerDemo() {
  const [active, setActive] = useState(0);
  const stage = stages[active];
  return <div className="br-demo"><div className="br-demo-header"><b>Рекомендации</b><span>ДЕМО</span></div><div className="br-demo-tabs" role="tablist" aria-label="Этапы рекомендации">{stages.map((s,i)=><button id={`broker-tab-${i}`} aria-controls="broker-panel" key={s.label} type="button" role="tab" aria-selected={i===active} tabIndex={i===active?0:-1} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();const next=(i+(e.key==="ArrowRight"?1:2))%3;setActive(next);document.getElementById(`broker-tab-${next}`)?.focus();}}}><span>{i+1}</span>{s.label}</button>)}</div><div id="broker-panel" role="tabpanel" aria-labelledby={`broker-tab-${active}`} tabIndex={0}><div className="br-demo-client"><span className="br-avatar">Д</span><div><b>Данияр · покупатель</b><span>Рекомендатель: Алия</span></div><span className="br-pill">{stage.label}</span></div><div className="br-demo-body"><span className="br-eyebrow">АЛМАТЫ · ПОКУПКА КВАРТИРЫ</span><h3>{stage.title}</h3><p>{stage.detail}</p><div className="br-demo-reward"><span>Вознаграждение партнёру</span><b>{stage.reward}</b></div><div className="br-demo-next"><span aria-hidden="true">↳</span>{stage.note}</div></div></div><p className="br-demo-caption">Условные имена и сумма для примера. Условия устанавливает агентство.</p></div>;
}

export function BrokerForm() {
  const [state,setState]=useState<"idle"|"pending"|"done">("idle");
  const [error,setError]=useState("");
  const applicationId=useRef("");
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form=event.currentTarget;
    const fields=Object.fromEntries(new FormData(form).entries());
    const phone=String(fields.phone||"").replace(/\D/g,"");
    if(phone.length<10||phone.length>15){setError("Укажите телефон с кодом страны, например +7 700 000 00 00.");return;}
    setState("pending");
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),20000);
    try {
      if(!applicationId.current)applicationId.current=crypto.randomUUID();
      const response=await fetch("/api/marketing/company-application",{method:"POST",headers:{"content-type":"application/json"},signal:controller.signal,body:JSON.stringify({...fields,...readMarketingAttribution(),applicationId:applicationId.current,comment:"Источник: broker.risestaff.kz. Агентство недвижимости. Запрос: демонстрация и запуск партнёрской программы."})});
      const result=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||!result.ok)throw new Error(result.error||"Не удалось отправить заявку. Попробуйте ещё раз.");
      setState("done");form.reset();
    }catch(reason){setState("idle");setError(reason instanceof Error&&reason.name==="AbortError"?"Ответ задерживается. Повторите отправку или напишите нам в WhatsApp.":reason instanceof Error?reason.message:"Не удалось отправить заявку. Попробуйте ещё раз.");}finally{clearTimeout(timeout);}
  }
  if(state==="done")return <div className="br-form br-form-success" role="status"><span className="br-success-icon" aria-hidden="true">✓</span><h3>Заявка получена.</h3><p>Контакты вашего агентства сохранены. Свяжемся с вами, чтобы обсудить запуск и демонстрацию.</p><a className="br-text-link" href="https://wa.me/77765086000?text=Здравствуйте!%20Оставил%20заявку%20на%20broker.risestaff.kz." target="_blank" rel="noopener noreferrer">Продолжить в WhatsApp ↗</a></div>;
  return <form className="br-form" aria-label="Заявка агентства недвижимости" onSubmit={submit}><h3>Покажем RiseStaff на вашей задаче</h3><label>Ваше имя<input name="name" autoComplete="name" placeholder="Как к вам обращаться" maxLength={100} required /></label><label>Агентство недвижимости<input name="company" autoComplete="organization" placeholder="Название агентства" maxLength={140} required /></label><label>Телефон / WhatsApp<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 700 000 00 00" maxLength={25} required aria-describedby={error?"broker-form-error":undefined} /></label><label className="br-honeypot" aria-hidden="true">Сайт<input name="website" autoComplete="off" tabIndex={-1} /></label><label className="br-consent"><input type="checkbox" name="consent" required /><span>Соглашаюсь на обработку данных согласно <a href="https://risestaff.kz/legal/privacy" target="_blank" rel="noopener noreferrer">политике конфиденциальности</a>.</span></label>{error&&<p className="br-form-error" id="broker-form-error" role="alert">{error}</p>}<button type="submit" className="br-button" disabled={state==="pending"}>{state==="pending"?"Отправляем…":"Обсудить запуск"}<span aria-hidden="true">↗</span></button><p className="br-form-note">Обсудим сценарий, условия и стоимость до подключения.</p></form>;
}
