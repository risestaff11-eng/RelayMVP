"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CompanyRegistrationForm({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/company/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Не удалось создать компанию");
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Что-то пошло не так");
      setPending(false);
    }
  }

  return (
    <form className="company-form" onSubmit={handleSubmit}>
      <div className="field field-wide">
        <label htmlFor="company-name">Название компании</label>
        <input id="company-name" name="name" placeholder="Например, Northstar Studio" minLength={2} maxLength={80} required />
      </div>
      <div className="field field-wide">
        <label htmlFor="website">Сайт компании</label>
        <input id="website" name="website" placeholder="company.com" inputMode="url" required />
        <p className="form-hint">На следующем этапе ИИ использует сайт для подготовки профиля.</p>
      </div>
      <div className="field">
        <label htmlFor="industry">Отрасль</label>
        <select id="industry" name="industry" defaultValue="" required>
          <option value="" disabled>Выберите отрасль</option>
          <option value="IT_AND_AUTOMATION">IT и автоматизация</option>
          <option value="MARKETING">Маркетинг и реклама</option>
          <option value="CONSULTING">Консалтинг</option>
          <option value="RECRUITING">Рекрутинг и HR</option>
          <option value="EDUCATION">Корпоративное обучение</option>
          <option value="OTHER">Другое</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="team-size">Размер команды</label>
        <select id="team-size" name="teamSize" defaultValue="" required>
          <option value="" disabled>Количество сотрудников</option>
          <option value="1_10">1–10</option>
          <option value="11_50">11–50</option>
          <option value="51_200">51–200</option>
          <option value="201_PLUS">201+</option>
        </select>
      </div>
      <div className="field field-wide">
        <label htmlFor="goal">Главная цель</label>
        <select id="goal" name="primaryGoal" defaultValue="LEADS" required>
          <option value="LEADS">Получать больше квалифицированных лидов</option>
          <option value="DEALS">Увеличить продажи через партнёров</option>
          <option value="AMBASSADORS">Развивать сеть амбассадоров</option>
          <option value="MIXED">Все перечисленное</option>
        </select>
      </div>
      <input type="hidden" name="contactEmail" value={email} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="submit-button" type="submit" disabled={pending}>{pending ? "Создаём пространство…" : "Создать компанию и открыть кабинет →"}</button>
    </form>
  );
}
