export function AccessLinkExpiry({ expiresAt, now }: { expiresAt: string; now: number }) {
  const expires = new Date(expiresAt);
  if (!Number.isFinite(expires.getTime())) return null;
  const remaining = expires.getTime() - now;
  const date = expires.toLocaleString("ru-RU", { timeZone: "Asia/Almaty", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return <details className="partner-access-expiry">
    <summary>{remaining <= 0 ? "Срок ссылки истёк" : remaining < 86400000 ? "Ссылка истекает меньше чем через сутки" : <><span>Ссылка доступа действует до</span> <time dateTime={expiresAt}>{date}</time></>}</summary>
    <p><span>Срок этой ссылки:</span> <time dateTime={expiresAt}>{date}</time> <span>(время Казахстана). После окончания срока данные сохранятся.</span></p>
    <a href="/agent-login">Получить новую ссылку через email</a>
  </details>;
}
