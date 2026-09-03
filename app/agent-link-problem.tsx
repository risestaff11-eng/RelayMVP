export function AgentLinkProblem({ temporary = false, reset }: { temporary?: boolean; reset?: () => void }) {
  return <main className="relay-auth-page"><section className="relay-auth-card">
    <div className="relay-auth-brand"><strong>RiseStaff</strong></div>
    <div className="relay-auth-copy">
      <h1>{temporary ? "Не удалось открыть страницу" : "Ссылка недоступна"}</h1>
      <p>{temporary ? "Возможно, произошёл временный сбой. Попробуйте ещё раз — заново отправлять заявку не нужно." : "Ссылка устарела, введена неверно или программа больше недоступна. Ваши ранее отправленные заявки не удалены."}</p>
      <p>Если вы агент, получите новую ссылку через вход по email. Если вы хотели оставить контакт, попросите у пригласившего вас человека действующую ссылку.</p>
    </div>
    {reset && <button className="relay-auth-primary" type="button" onClick={reset}>Попробовать ещё раз</button>}
    <a className="button button-primary" href="/agent-login">Вход агента по email</a>
  </section></main>;
}
