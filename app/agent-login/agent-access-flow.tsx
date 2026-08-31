"use client";

import { useState } from "react";

type Stage =
  | "EMAIL"
  | "PHONE"
  | "CODE"
  | "APPLICATION_PROFILE"
  | "APPLICATION_FIT"
  | "DONE";
const industryOptions = [
  "IT и технологии",
  "Услуги для бизнеса",
  "Финансы",
  "Недвижимость",
  "Образование",
  "Маркетинг",
  "Розница",
  "Другое",
];
const taskOptions = [
  "Поиск клиентов",
  "Помощь со сделками",
  "Публикации и рекомендации",
  "Мероприятия и активности",
];

export function AgentAccessFlow() {
  const [stage, setStage] = useState<Stage>("EMAIL");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [network, setNetwork] = useState("");
  const [preferredTypes, setPreferredTypes] = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [comment, setComment] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function requestCode() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/agent/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "REQUEST", email, phone }),
      });
      const data = (await response.json()) as {
        needsApplication?: boolean;
        codeSent?: boolean;
        maskedEmail?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Не удалось проверить данные");
      if (data.needsApplication) {
        setStage("APPLICATION_PROFILE");
        return;
      }
      setMaskedEmail(data.maskedEmail || email);
      setStage("CODE");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось продолжить",
      );
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/agent/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "VERIFY", email, phone, code }),
      });
      const data = (await response.json()) as {
        redirect?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Не удалось войти");
      window.location.href = data.redirect || "/agent";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти");
      setPending(false);
    }
  }

  async function submitApplication() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/agent/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          city,
          industries,
          experience,
          network,
          preferredTypes,
          availability,
          comment,
          acceptedTerms,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || "Не удалось отправить заявку");
      setStage("DONE");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось отправить заявку",
      );
    } finally {
      setPending(false);
    }
  }

  function toggle(
    value: string,
    values: string[],
    update: (next: string[]) => void,
  ) {
    update(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  const step =
    stage === "EMAIL"
      ? 1
      : stage === "PHONE" || stage === "CODE"
        ? 2
        : stage === "APPLICATION_PROFILE"
          ? 1
          : 2;
  return (
    <main className="agent-access-page">
      <section className="agent-access-card">
        <header>
          <a href="https://risestaff.kz/" className="agent-access-brand">
            <i>Y</i>
            <b>Yaler</b>
          </a>
          <span>
            {stage.startsWith("APPLICATION")
              ? `ЗАЯВКА · ШАГ ${step} ИЗ 2`
              : stage === "DONE"
                ? "ЗАЯВКА ПРИНЯТА"
                : `ВХОД АГЕНТА · ШАГ ${step} ИЗ 2`}
          </span>
        </header>
        {stage === "EMAIL" && (
          <div className="agent-access-body">
            <small>ВАШИ ЗАДАНИЯ И НАГРАДЫ</small>
            <h1>Войдите как агент</h1>
            <p>Укажите почту, с которой вы переходили в программы компаний.</p>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <button
              disabled={pending || !email.trim()}
              onClick={() => setStage("PHONE")}
            >
              Продолжить <b>→</b>
            </button>
            <aside>
              Ещё не участвовали в программах? После проверки мы предложим
              подать короткую заявку.
            </aside>
          </div>
        )}
        {stage === "PHONE" && (
          <div className="agent-access-body">
            <button className="agent-back" onClick={() => setStage("EMAIL")}>
              ← Назад
            </button>
            <small>ПРОВЕРКА ПРОФИЛЯ</small>
            <h1>Введите телефон</h1>
            <p>
              Номер должен совпадать с указанным при первом входе в программу.
            </p>
            <label>
              Телефон
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 777 000 00 00"
              />
            </label>
            <button
              disabled={pending || phone.replace(/\D/g, "").length < 10}
              onClick={() => void requestCode()}
            >
              {pending ? "Проверяем…" : "Получить код"}
              <b>→</b>
            </button>
          </div>
        )}
        {stage === "CODE" && (
          <div className="agent-access-body">
            <button className="agent-back" onClick={() => setStage("PHONE")}>
              ← Изменить телефон
            </button>
            <small>ЗАЩИЩЁННЫЙ ВХОД</small>
            <h1>Код отправлен</h1>
            <p>Введите шесть цифр из письма на {maskedEmail}.</p>
            <label>
              Код
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
              />
            </label>
            <button
              disabled={pending || code.length !== 6}
              onClick={() => void verifyCode()}
            >
              {pending ? "Входим…" : "Открыть задания"}
              <b>→</b>
            </button>
            <button
              className="agent-text-button"
              disabled={pending}
              onClick={() => void requestCode()}
            >
              Отправить код ещё раз
            </button>
          </div>
        )}
        {stage === "APPLICATION_PROFILE" && (
          <div className="agent-access-body">
            <small>СТАТЬ АГЕНТОМ</small>
            <h1>Расскажите о себе</h1>
            <p>Так мы поймём, для каких компаний и заданий вы подходите.</p>
            <label>
              Имя
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Телефон
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <button
              disabled={
                !name.trim() ||
                !email.trim() ||
                phone.replace(/\D/g, "").length < 10
              }
              onClick={() => setStage("APPLICATION_FIT")}
            >
              Дальше <b>→</b>
            </button>
          </div>
        )}
        {stage === "APPLICATION_FIT" && (
          <div className="agent-access-body application-fit">
            <button
              className="agent-back"
              onClick={() => setStage("APPLICATION_PROFILE")}
            >
              ← Назад
            </button>
            <small>ГДЕ ВЫ БУДЕТЕ ПОЛЕЗНЫ</small>
            <h1>Ваш опыт и окружение</h1>
            <label>
              Город
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Алматы"
              />
            </label>
            <fieldset>
              <legend>В каких сферах вы разбираетесь?</legend>
              <div className="agent-option-grid">
                {industryOptions.map((item) => (
                  <label
                    key={item}
                    className={industries.includes(item) ? "selected" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={industries.includes(item)}
                      onChange={() => toggle(item, industries, setIndustries)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Кого вы можете рекомендовать?
              <textarea
                rows={3}
                value={network}
                onChange={(event) => setNetwork(event.target.value)}
                placeholder="Например: владельцев малого бизнеса, HR-руководителей…"
              />
            </label>
            <label>
              Опыт продаж или рекомендаций
              <textarea
                rows={2}
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                placeholder="Можно коротко"
              />
            </label>
            <fieldset>
              <legend>Какие задания интересны?</legend>
              <div className="agent-option-grid">
                {taskOptions.map((item) => (
                  <label
                    key={item}
                    className={preferredTypes.includes(item) ? "selected" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={preferredTypes.includes(item)}
                      onChange={() =>
                        toggle(item, preferredTypes, setPreferredTypes)
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Сколько времени готовы уделять?
              <input
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                placeholder="Например: 3–5 часов в неделю"
              />
            </label>
            <label>
              Комментарий
              <textarea
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <label className="agent-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              Согласен с{" "}
              <a href="https://risestaff.kz/legal/privacy" target="_blank" rel="noreferrer">
                политикой конфиденциальности
              </a>
            </label>
            <button
              disabled={
                pending ||
                !city ||
                !industries.length ||
                !network ||
                !acceptedTerms
              }
              onClick={() => void submitApplication()}
            >
              {pending ? "Отправляем…" : "Отправить заявку"}
              <b>→</b>
            </button>
          </div>
        )}
        {stage === "DONE" && (
          <div className="agent-access-body agent-application-done">
            <i>✓</i>
            <small>ГОТОВО</small>
            <h1>Заявка отправлена</h1>
            <p>
              Мы сохранили ваши данные. Когда появится подходящая программа, с
              вами свяжутся по указанным контактам.
            </p>
            <a href="https://risestaff.kz/">Вернуться на главную →</a>
          </div>
        )}
        {error && (
          <p className="agent-access-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
