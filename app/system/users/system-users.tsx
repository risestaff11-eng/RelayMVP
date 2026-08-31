"use client";

import { useMemo, useState } from "react";
import { countRu, formatDateTimeSeconds, formatInteger } from "@/lib/format-display";

type Row = {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  status: string;
  emailVerifiedAt: string | null;
  tokenBalance: number | null;
  tokensUsed: number | null;
  programCount: number;
  activeProgramCount: number;
  agentCount: number;
  activeAgentCount: number;
  submissionCount: number;
  pendingSubmissionCount: number;
  paidRewardsCount: number;
  paidRewardsAmount: number;
  dueRewardsAmount: number;
  lastAgentActivityAt: string | null;
  lastSubmissionAt: string | null;
};

type DeletedRow = {
  id: string;
  originalUserId: string;
  originalCompanyId: string | null;
  companyName: string;
  emailMasked: string;
  emailDomain: string;
  programsCount: number;
  agentsCount: number;
  submissionsCount: number;
  paidRewardsCount: number;
  paidRewardsAmount: number;
  storageCleanupStatus: string;
  deletedAt: string;
};

type AgentApplication = {
  id: string; name: string; email: string; phone: string; city: string; industries: string[]; experience: string;
  network: string; preferredTypes: string[]; availability: string; comment: string; status: string; reviewedAt: string | null; createdAt: string;
};

const statusNames: Record<string, string> = {
  active: "Активен",
  pending: "Ожидает активации",
  blocked: "Заблокирован",
};

function timestamp(value: string | null) {
  if (!value) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const result = new Date(normalized).getTime();
  return Number.isFinite(result) ? result : 0;
}

function newest(...values: Array<string | null>) {
  return (
    values
      .filter(Boolean)
      .sort((left, right) => timestamp(right) - timestamp(left))[0] ?? null
  );
}

function activityLabel(value: string | null, now: number) {
  if (!value) return "Входов ещё не было";
  const days = Math.floor((now - timestamp(value)) / 86_400_000);
  if (days <= 0) return "Входил сегодня";
  if (days === 1) return "Входил вчера";
  if (days < 7) return `Входил ${countRu(days, "день", "дня", "дней")} назад`;
  return `Не входил ${countRu(days, "день", "дня", "дней")}`;
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function SystemUsers({
  authorized,
  initialRows,
  initialDeletedRows,
  initialApplications,
  generatedAt,
}: {
  authorized: boolean;
  initialRows: Row[];
  initialDeletedRows: DeletedRow[];
  initialApplications: AgentApplication[];
  generatedAt: string;
}) {
  const [ready] = useState(authorized);
  const [rows, setRows] = useState(initialRows);
  const [deletedRows, setDeletedRows] = useState(initialDeletedRows);
  const [applications, setApplications] = useState(initialApplications);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activity, setActivity] = useState("ALL");
  const [registered, setRegistered] = useState("ALL");
  const [sort, setSort] = useState("LAST_LOGIN");
  const [showDeleted, setShowDeleted] = useState(true);
  const generatedAtTimestamp = timestamp(generatedAt);

  const filteredRows = useMemo(() => {
    const preparedQuery = query.trim().toLowerCase();
    const now = generatedAtTimestamp;
    const output = rows.filter((row) => {
      const matchesQuery =
        !preparedQuery ||
        [row.name, row.email, row.phone, row.company, row.website].some(
          (value) =>
            String(value ?? "")
              .toLowerCase()
              .includes(preparedQuery),
        );
      if (!matchesQuery || (status !== "ALL" && row.status !== status))
        return false;
      if (activity === "NEVER" && row.lastLoginAt) return false;
      if (activity !== "ALL" && activity !== "NEVER") {
        if (
          !row.lastLoginAt ||
          now - timestamp(row.lastLoginAt) > Number(activity) * 86_400_000
        )
          return false;
      }
      if (
        registered !== "ALL" &&
        now - timestamp(row.createdAt) > Number(registered) * 86_400_000
      )
        return false;
      return true;
    });
    return output.sort((left, right) => {
      if (sort === "NEWEST")
        return timestamp(right.createdAt) - timestamp(left.createdAt);
      if (sort === "PROGRAMS") return right.programCount - left.programCount;
      if (sort === "AGENTS") return right.agentCount - left.agentCount;
      if (sort === "RESULTS")
        return right.submissionCount - left.submissionCount;
      if (sort === "PAID")
        return right.paidRewardsAmount - left.paidRewardsAmount;
      return timestamp(right.lastLoginAt) - timestamp(left.lastLoginAt);
    });
  }, [activity, generatedAtTimestamp, query, registered, rows, sort, status]);

  const summary = useMemo(() => {
    const active30 = rows.filter(
      (row) =>
        row.lastLoginAt &&
        generatedAtTimestamp - timestamp(row.lastLoginAt) <= 30 * 86_400_000,
    ).length;
    return {
      companies: rows.length,
      active: rows.filter((row) => row.status === "active").length,
      active30,
      programs: rows.reduce((total, row) => total + row.programCount, 0),
      agents: rows.reduce((total, row) => total + row.agentCount, 0),
      results: rows.reduce((total, row) => total + row.submissionCount, 0),
      paid:
        rows.reduce((total, row) => total + row.paidRewardsAmount, 0) +
        deletedRows.reduce((total, row) => total + row.paidRewardsAmount, 0),
    };
  }, [deletedRows, generatedAtTimestamp, rows]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    const response = await fetch("/api/system/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return setError(data.error || "Доступ запрещён");
    window.location.reload();
  }

  async function addTokens(id: string) {
    const tokenAmount = Math.round(Number(tokenAmounts[id]));
    if (!tokenAmount || tokenAmount < 1)
      return setError("Введите количество AI-кредитов больше нуля");
    setBusy(id);
    setError("");
    setNotice("");
    const response = await fetch(`/api/system/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenAmount }),
    });
    const data = (await response.json()) as {
      error?: string;
      tokenBalance?: number;
    };
    if (response.ok && typeof data.tokenBalance === "number") {
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, tokenBalance: data.tokenBalance! } : row,
        ),
      );
      setTokenAmounts((current) => ({ ...current, [id]: "" }));
      setNotice("AI-кредиты начислены");
    } else setError(data.error || "Не удалось начислить AI-кредиты");
    setBusy("");
  }

  async function update(id: string, nextStatus: string) {
    setBusy(id);
    setError("");
    setNotice("");
    const response = await fetch(`/api/system/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (response.ok) {
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: nextStatus } : row,
        ),
      );
      setNotice(
        nextStatus === "active"
          ? "Кабинет активирован"
          : "Доступ к кабинету ограничен",
      );
    } else setError(data.error || "Не удалось изменить статус");
    setBusy("");
  }

  async function remove(row: Row) {
    const confirmation = window.prompt(
      `Будут удалены кабинет «${row.company || row.name}», ${countRu(row.programCount, "программа", "программы", "программ")}, ${countRu(row.agentCount, "агент", "агента", "агентов")} и ${countRu(row.submissionCount, "результат", "результата", "результатов")}.\n\nДля подтверждения введите УДАЛИТЬ`,
    );
    if (confirmation !== "УДАЛИТЬ") return;
    setBusy(row.id);
    setError("");
    setNotice("");
    const response = await fetch(`/api/system/users/${row.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE_COMPANY" }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      deletedAccount?: DeletedRow;
    };
    if (response.ok && data.deletedAccount) {
      setRows((current) => current.filter((item) => item.id !== row.id));
      setDeletedRows((current) => [data.deletedAccount!, ...current]);
      setNotice(
        "Кабинет и связанные данные удалены. Этот email можно зарегистрировать повторно.",
      );
    } else setError(data.error || "Не удалось удалить кабинет");
    setBusy("");
  }

  async function openSupport(row: Row) {
    if (!row.companyId) return setError("Сначала создайте кабинет компании");
    setBusy(row.id); setError("");
    const response = await fetch("/api/system/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: row.companyId, reason: "Оперативная техподдержка" }) });
    const data = await response.json() as { redirect?: string; error?: string };
    if (!response.ok) { setError(data.error || "Не удалось открыть кабинет"); setBusy(""); return; }
    window.location.href = data.redirect || "/dashboard";
  }

  async function updateApplication(id: string, nextStatus: string) {
    setBusy(id); setError("");
    const response = await fetch(`/api/system/agent-applications/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    const data = await response.json() as { status?: string; reviewedAt?: string | null; error?: string };
    if (response.ok) setApplications((current) => current.map((item) => item.id === id ? { ...item, status: data.status || nextStatus, reviewedAt: data.reviewedAt ?? null } : item));
    else setError(data.error || "Не удалось обновить заявку");
    setBusy("");
  }

  function downloadCsv() {
    const header = [
      "Тип",
      "Компания",
      "Владелец",
      "Email",
      "Телефон",
      "Статус",
      "Регистрация (Астана)",
      "Последний вход (Астана)",
      "Входов",
      "Программ",
      "Активных программ",
      "Агентов",
      "Активных агентов",
      "Результатов",
      "Ждут проверки",
      "Выплачено, KZT",
      "К выплате, KZT",
      "AI-кредиты",
      "AI использовано",
    ];
    const current = filteredRows.map((row) => [
      "Текущий кабинет",
      row.company || row.name,
      row.name,
      row.email,
      row.phone,
      statusNames[row.status] ?? row.status,
      formatDateTimeSeconds(row.createdAt),
      row.lastLoginAt ? formatDateTimeSeconds(row.lastLoginAt) : "Не входил",
      row.loginCount,
      row.programCount,
      row.activeProgramCount,
      row.agentCount,
      row.activeAgentCount,
      row.submissionCount,
      row.pendingSubmissionCount,
      row.paidRewardsAmount,
      row.dueRewardsAmount,
      row.tokenBalance ?? 0,
      row.tokensUsed ?? 0,
    ]);
    const deleted = showDeleted
      ? deletedRows.map((row) => [
          "Удалённый кабинет",
          row.companyName,
          "—",
          row.emailMasked,
          "—",
          "Удалён",
          formatDateTimeSeconds(row.deletedAt),
          "—",
          0,
          row.programsCount,
          0,
          row.agentsCount,
          0,
          row.submissionsCount,
          0,
          row.paidRewardsAmount,
          0,
          0,
          0,
        ])
      : [];
    const csv = [header, ...current, ...deleted]
      .map((line) => line.map(csvCell).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `relay-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready)
    return (
      <main className="system-gate">
        <form onSubmit={login}>
          <h1>Yaler · управление</h1>
          <label>
            Секретный пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p>{error}</p>}
          <button type="submit">Открыть админку</button>
        </form>
      </main>
    );

  return (
    <main className="system-users system-admin-v2">
      <header className="system-admin-header">
        <div>
          <span>YALER · SYSTEM</span>
          <h1>Состояние проекта</h1>
          <p>Компании, активность и деньги. Дата и время указаны по Астане.</p>
        </div>
        <button type="button" onClick={downloadCsv}>
          ↓ Скачать сводку CSV
        </button>
      </header>

      {error && (
        <p className="system-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="system-success" role="status">
          {notice}
        </p>
      )}

      <section className="system-summary" aria-label="Ключевые показатели">
        <article>
          <small>КАБИНЕТОВ</small>
          <strong>{formatInteger(summary.companies)}</strong>
          <span>{summary.active} активны</span>
        </article>
        <article>
          <small>ВХОДИЛИ ЗА 30 ДНЕЙ</small>
          <strong>{formatInteger(summary.active30)}</strong>
          <span>
            {rows.length
              ? Math.round((summary.active30 / rows.length) * 100)
              : 0}
            % базы
          </span>
        </article>
        <article>
          <small>ПРОГРАММ</small>
          <strong>{formatInteger(summary.programs)}</strong>
          <span>во всех кабинетах</span>
        </article>
        <article>
          <small>АГЕНТОВ</small>
          <strong>{formatInteger(summary.agents)}</strong>
          <span>в агентских сетях</span>
        </article>
        <article>
          <small>РЕЗУЛЬТАТОВ</small>
          <strong>{formatInteger(summary.results)}</strong>
          <span>за всё время</span>
        </article>
        <article className="accent">
          <small>ВЫПЛАЧЕНО АГЕНТАМ</small>
          <strong>{formatInteger(summary.paid)} ₸</strong>
          <span>включая удалённые кабинеты</span>
        </article>
      </section>

      <section className="system-controls" aria-label="Фильтры кабинетов">
        <label className="system-search">
          <span>Поиск</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Компания, владелец, email, телефон"
          />
        </label>
        <label>
          <span>Статус</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Все статусы</option>
            <option value="active">Активные</option>
            <option value="pending">Ожидают активации</option>
            <option value="blocked">Заблокированные</option>
          </select>
        </label>
        <label>
          <span>Последний вход</span>
          <select
            value={activity}
            onChange={(event) => setActivity(event.target.value)}
          >
            <option value="ALL">За всё время</option>
            <option value="7">За 7 дней</option>
            <option value="30">За 30 дней</option>
            <option value="90">За 90 дней</option>
            <option value="NEVER">Ни разу не входили</option>
          </select>
        </label>
        <label>
          <span>Регистрация</span>
          <select
            value={registered}
            onChange={(event) => setRegistered(event.target.value)}
          >
            <option value="ALL">За всё время</option>
            <option value="7">За 7 дней</option>
            <option value="30">За 30 дней</option>
            <option value="90">За 90 дней</option>
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="LAST_LOGIN">Недавний вход</option>
            <option value="NEWEST">Новые регистрации</option>
            <option value="PROGRAMS">Больше программ</option>
            <option value="AGENTS">Больше агентов</option>
            <option value="RESULTS">Больше результатов</option>
            <option value="PAID">Больше выплат</option>
          </select>
        </label>
      </section>

      <div className="system-list-heading">
        <div>
          <h2>Кабинеты компаний</h2>
          <p>
            {filteredRows.length} из {rows.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatus("ALL");
            setActivity("ALL");
            setRegistered("ALL");
            setSort("LAST_LOGIN");
          }}
        >
          Сбросить фильтры
        </button>
      </div>

      <section className="system-account-list">
        {filteredRows.map((row) => {
          const latestActivity = newest(
            row.lastLoginAt,
            row.lastAgentActivityAt,
            row.lastSubmissionAt,
          );
          return (
            <details
              className={`system-account status-${row.status}`}
              key={row.id}
            >
              <summary>
                <div className="system-account-company">
                  <span className="system-company-avatar">
                    {(row.company || row.name || "R").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{row.company || "Компания ещё не создана"}</strong>
                    <small>
                      {row.name} · {row.email}
                    </small>
                  </div>
                </div>
                <div className="system-account-login">
                  <small>ПОСЛЕДНИЙ ВХОД</small>
                  <strong>
                    {row.lastLoginAt
                      ? formatDateTimeSeconds(row.lastLoginAt)
                      : "Не входил"}
                  </strong>
                  <span>
                    {activityLabel(row.lastLoginAt, generatedAtTimestamp)}
                  </span>
                </div>
                <div className="system-account-kpi">
                  <span>
                    <b>{row.programCount}</b> программ
                  </span>
                  <span>
                    <b>{row.agentCount}</b> агентов
                  </span>
                  <span>
                    <b>{row.submissionCount}</b> результатов
                  </span>
                </div>
                <b className={`system-status status-${row.status}`}>
                  {statusNames[row.status] ?? row.status}
                </b>
                <span className="system-expand-icon" aria-hidden="true">
                  ⌄
                </span>
              </summary>

              <div className="system-account-body">
                <section className="system-account-facts">
                  <div>
                    <small>Регистрация</small>
                    <strong>{formatDateTimeSeconds(row.createdAt)}</strong>
                  </div>
                  <div>
                    <small>Всего входов</small>
                    <strong>{formatInteger(row.loginCount)}</strong>
                  </div>
                  <div>
                    <small>Последняя активность</small>
                    <strong>
                      {latestActivity
                        ? formatDateTimeSeconds(latestActivity)
                        : "Нет активности"}
                    </strong>
                  </div>
                  <div>
                    <small>Email</small>
                    <strong>
                      {row.emailVerifiedAt ? "Подтверждён" : "Не подтверждён"}
                    </strong>
                  </div>
                  <div>
                    <small>Телефон</small>
                    <strong>{row.phone || "Не указан"}</strong>
                  </div>
                  <div>
                    <small>Сайт</small>
                    {row.website ? (
                      <a href={row.website} target="_blank" rel="noreferrer">
                        {row.website.replace(/^https?:\/\//, "")} ↗
                      </a>
                    ) : (
                      <strong>Не указан</strong>
                    )}
                  </div>
                </section>

                <section className="system-account-metrics">
                  <article>
                    <small>ПРОГРАММЫ</small>
                    <strong>
                      {row.activeProgramCount} / {row.programCount}
                    </strong>
                    <span>активных / всего</span>
                  </article>
                  <article>
                    <small>АГЕНТЫ</small>
                    <strong>
                      {row.activeAgentCount} / {row.agentCount}
                    </strong>
                    <span>активных / всего</span>
                  </article>
                  <article>
                    <small>РЕЗУЛЬТАТЫ</small>
                    <strong>{formatInteger(row.submissionCount)}</strong>
                    <span>{row.pendingSubmissionCount} ждут проверки</span>
                  </article>
                  <article>
                    <small>ВЫПЛАЧЕНО</small>
                    <strong>{formatInteger(row.paidRewardsAmount)} ₸</strong>
                    <span>{countRu(row.paidRewardsCount, "выплата", "выплаты", "выплат")}</span>
                  </article>
                  <article>
                    <small>К ВЫПЛАТЕ</small>
                    <strong>{formatInteger(row.dueRewardsAmount)} ₸</strong>
                    <span>подтверждённые награды</span>
                  </article>
                  <article>
                    <small>AI-КРЕДИТЫ</small>
                    <strong>{formatInteger(row.tokenBalance ?? 0)}</strong>
                    <span>
                      использовано {formatInteger(row.tokensUsed ?? 0)}
                    </span>
                  </article>
                </section>

                <footer className="system-account-actions">
                  <div className="system-token-control">
                    <input
                      type="number"
                      min="1"
                      max="10000000"
                      placeholder="Добавить AI-кредиты"
                      value={tokenAmounts[row.id] ?? ""}
                      onChange={(event) =>
                        setTokenAmounts((current) => ({
                          ...current,
                          [row.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void addTokens(row.id)}
                    >
                      Начислить
                    </button>
                  </div>
                  <div>
                    <button className="support-login" type="button" disabled={busy === row.id || !row.companyId || row.status === "blocked"} onClick={() => void openSupport(row)}>Открыть для поддержки ↗</button>
                    <button
                      className={
                        row.status === "active"
                          ? "is-active"
                          : "needs-activation"
                      }
                      type="button"
                      disabled={busy === row.id || row.status === "active"}
                      onClick={() => void update(row.id, "active")}
                    >
                      {row.status === "active" ? "Активирован" : "Активировать"}
                    </button>
                    <button
                      className={row.status === "blocked" ? "is-blocked" : ""}
                      type="button"
                      disabled={busy === row.id || row.status === "blocked"}
                      onClick={() => void update(row.id, "blocked")}
                    >
                      {row.status === "blocked"
                        ? "Заблокирован"
                        : "Заблокировать"}
                    </button>
                    <button
                      className="danger"
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void remove(row)}
                    >
                      Удалить кабинет
                    </button>
                  </div>
                </footer>
              </div>
            </details>
          );
        })}
        {!filteredRows.length && (
          <div className="system-empty">
            <strong>Кабинеты не найдены</strong>
            <span>Измените фильтры или поисковый запрос.</span>
          </div>
        )}
      </section>

      <section className="system-agent-applications">
        <header><div><span>НОВЫЕ АГЕНТЫ</span><h2>Заявки на участие</h2><p>Люди, которые вошли с главной страницы, но пока не состоят в программах компаний.</p></div><strong>{applications.filter((item) => item.status === "NEW").length} новых</strong></header>
        <div className="system-application-list">{applications.map((application) => <details key={application.id} className={`system-application status-${application.status.toLowerCase()}`}><summary><div><b>{application.name.slice(0,1).toUpperCase()}</b><span><strong>{application.name}</strong><small>{application.city} · {application.email} · +{application.phone}</small></span></div><span>{application.industries.join(" · ") || "Сфера не указана"}</span><time>{formatDateTimeSeconds(application.createdAt)}</time><em>{application.status === "NEW" ? "Новая" : application.status === "ACCEPTED" ? "Принята" : application.status === "REJECTED" ? "Отклонена" : "Просмотрена"}</em></summary><div><dl><dt>Кого может рекомендовать</dt><dd>{application.network || "—"}</dd><dt>Опыт</dt><dd>{application.experience || "—"}</dd><dt>Интересующие задания</dt><dd>{application.preferredTypes.join(", ") || "—"}</dd><dt>Доступность</dt><dd>{application.availability || "—"}</dd><dt>Комментарий</dt><dd>{application.comment || "—"}</dd></dl><footer><a href={`https://wa.me/${application.phone}`} target="_blank" rel="noreferrer">Написать в WhatsApp ↗</a><button onClick={() => void updateApplication(application.id, "REVIEWED")}>Просмотрена</button><button onClick={() => void updateApplication(application.id, "ACCEPTED")}>Принять</button><button onClick={() => void updateApplication(application.id, "REJECTED")}>Отклонить</button></footer></div></details>)}</div>
        {!applications.length && <p className="system-empty">Новых заявок агентов пока нет.</p>}
      </section>

      <section className="system-deleted-section">
        <header>
          <div>
            <span>ЖУРНАЛ УДАЛЕНИЙ</span>
            <h2>Удалённые кабинеты</h2>
            <p>
              Здесь остаётся только обезличенная запись. Исходный email снова
              доступен для регистрации.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleted((value) => !value)}
          >
            {showDeleted ? "Скрыть" : `Показать · ${deletedRows.length}`}
          </button>
        </header>
        {showDeleted && (
          <div className="system-deleted-list">
            {deletedRows.map((row) => (
              <article key={row.id}>
                <div>
                  <b>×</b>
                  <span>
                    <strong>{row.companyName}</strong>
                    <small>
                      {row.emailMasked} · {row.emailDomain}
                    </small>
                  </span>
                </div>
                <span>
                  <small>Удалён</small>
                  <strong>{formatDateTimeSeconds(row.deletedAt)}</strong>
                </span>
                <span>
                  <small>История до удаления</small>
                  <strong>
                    {countRu(row.programsCount, "программа", "программы", "программ")} · {countRu(row.agentsCount, "агент", "агента", "агентов")} ·{" "}
                    {row.submissionsCount} результатов
                  </strong>
                </span>
                <span>
                  <small>Файлы</small>
                  <strong
                    className={
                      row.storageCleanupStatus === "COMPLETE"
                        ? "cleanup-ok"
                        : "cleanup-warning"
                    }
                  >
                    {row.storageCleanupStatus === "COMPLETE"
                      ? "Удалены"
                      : "Требуют проверки"}
                  </strong>
                </span>
              </article>
            ))}
          </div>
        )}
        {showDeleted && !deletedRows.length && (
          <p className="system-empty">Удалённых кабинетов пока нет.</p>
        )}
      </section>
    </main>
  );
}
