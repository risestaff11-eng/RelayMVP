"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

type GuideProps = {
  hasProfile: boolean;
  hasProgram: boolean;
  hasPublished: boolean;
  partnerCount: number;
  submissionCount: number;
  awaitingReview: number;
  programId?: string;
};

export function FirstRunGuide(props: GuideProps) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const current = !props.hasProfile
    ? { number: "01", title: "Проверьте данные компании", text: "Rela использует продукты, клиентов и преимущества компании, чтобы готовить точные задания.", href: "/dashboard/company-profile", action: "Проверить данные" }
    : !props.hasProgram
      ? { number: "02", title: "Создайте первую программу", text: "Опишите цель, выберите задания и назначьте понятное вознаграждение для агента.", href: "/dashboard/programs/new", action: "Создать программу" }
      : !props.hasPublished
        ? { number: "03", title: "Опубликуйте программу", text: "Проверьте задания и условия. После публикации Relay создаст ссылку для приглашения агентов.", href: `/dashboard/programs/${props.programId}`, action: "Продолжить настройку" }
        : props.partnerCount === 0
          ? { number: "04", title: "Пригласите первого агента", text: "Откройте опубликованную программу, скопируйте ссылку и отправьте её человеку, который может рекомендовать клиентов.", href: `/dashboard/programs/${props.programId}`, action: "Получить ссылку" }
          : props.submissionCount === 0
            ? { number: "05", title: "Помогите агенту передать первый результат", text: "Агент уже подключён. Он выбирает задание, передаёт контакт или подтверждение и видит статус в своём кабинете.", href: "/dashboard/partners", action: "Открыть агентов" }
            : { number: "06", title: "Проверьте новый результат", text: "Откройте карточку, изучите данные и файлы, затем установите статус и оставьте комментарий агенту.", href: "/dashboard/submissions", action: `Проверить результаты${props.awaitingReview ? ` · ${props.awaitingReview}` : ""}` };

  const stages = [
    { label: "Подготовить предложение", text: "Данные компании, программа и задания", done: props.hasPublished },
    { label: "Подключить агентов", text: "Публичная ссылка и регистрация", done: props.partnerCount > 0 },
    { label: "Получать результаты", text: "Проверка, награда и выплата", done: props.submissionCount > 0 },
  ];

  function hide() {
    setHidden(true);
  }

  return (
    <section className="first-run-guide" aria-labelledby="first-run-title">
      <header>
        <div><span>БЫСТРЫЙ СТАРТ</span><h2 id="first-run-title">Relay ведёт вас по одному шагу</h2><p>Не нужно изучать весь кабинет. Выполните действие ниже — следующий шаг появится автоматически.</p></div>
        <button type="button" onClick={hide}>Скрыть подсказку</button>
      </header>
      <div className="first-run-current">
        <span>{current.number}</span>
        <div><small>СЕЙЧАС</small><h3>{current.title}</h3><p>{current.text}</p></div>
        <Link href={current.href}>{current.action}<b>→</b></Link>
      </div>
      <div className="first-run-stages">
        {stages.map((stage, index) => <article className={stage.done ? "done" : ""} key={stage.label}><span>{stage.done ? "✓" : String(index + 1).padStart(2, "0")}</span><div><strong>{stage.label}</strong><small>{stage.text}</small></div></article>)}
      </div>
    </section>
  );
}
