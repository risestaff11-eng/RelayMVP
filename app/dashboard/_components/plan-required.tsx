import { SafeLink as Link } from "@/app/safe-link";
export function PlanRequired() {
  return <section className="dashboard-content panel"><h1>Возможность другого тарифа</h1><p>Посмотрите условия и выберите подходящий доступ в настройках компании.</p><Link className="button button-primary" href="/dashboard/settings#subscription">Посмотреть тарифы</Link><p><a href="/api/company/export" download>Скачать все данные компании</a></p></section>;
}
