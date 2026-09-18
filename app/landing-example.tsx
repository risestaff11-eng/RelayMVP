"use client";

import { useState } from "react";

const steps = [
  { label: "Контакт", title: "Новая заявка", detail: "Родитель рекомендует учебный центр знакомой семье. Контакт попадает в CRM вместе с именем рекомендателя.", sale: "Ждёт проверки", reward: "После оплаты курса", amount: "25 000 ₸", money: "Сумма по условиям программы" },
  { label: "Сделка", title: "Курс оплачен", detail: "Компания отмечает оплату клиента. В карточке остаются сумма сделки, рекомендатель и основание для вознаграждения.", sale: "Оплачено клиентом", reward: "К выплате", amount: "25 000 ₸", money: "Вознаграждение рекомендателю" },
  { label: "Вознаграждение", title: "Получение подтверждено", detail: "Компания переводит деньги своим способом и отмечает перевод. Рекомендатель отдельно подтверждает получение в кабинете.", sale: "Оплачено клиентом", reward: "Агент подтвердил получение", amount: "25 000 ₸", money: "Получено рекомендателем" },
];

export function LandingExample() {
  const [step, setStep] = useState(0);
  const current = steps[step];
  return <div className="rs-example">
    <div className="rs-example-top"><strong>Одна рекомендация</strong><span>Пример для учебного центра</span></div>
    <div className="rs-example-switch" role="group" aria-label="Посмотреть этап рекомендации">
      {steps.map((item, index) => <button type="button" data-track="hero_secondary" aria-pressed={step === index} key={item.label} onClick={() => setStep(index)}><span aria-hidden="true">0{index + 1}</span>{item.label}</button>)}
    </div>
    <div className="rs-example-card" aria-live="polite" aria-atomic="true">
      <div className="rs-example-card-top"><span>Запись на годовой курс</span><span>CRM</span></div>
      <h3>{current.title}</h3>
      <dl><div><dt>Кто рекомендует</dt><dd>Родитель ученика</dd></div><div><dt>Продажа</dt><dd>{current.sale}</dd></div><div><dt>Вознаграждение</dt><dd>{current.reward}</dd></div></dl>
      <div className="rs-example-money"><span>{current.money}</span><strong>{current.amount}</strong></div>
    </div>
    <p className="rs-example-explanation">{current.detail}</p>
    <p className="rs-example-footnote">Пример не создаёт заявку и не переводит деньги.</p>
  </div>;
}
