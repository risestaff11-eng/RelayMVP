import { SafeLink as Link } from "@/app/safe-link";
import { subscriptionState, type SubscriptionFields } from "@/lib/subscription-plans";
import { formatDateTimeSeconds } from "@/lib/format-display";

export function SubscriptionBanner({ company }: { company: SubscriptionFields }) {
  const state = subscriptionState(company);
  if (state.legacy || (state.active && !state.trial && (state.daysLeft ?? 0) > 5)) return null;
  return <aside className="subscription-banner" role="status"><span><strong>{state.name}</strong> · {state.active ? <>до {formatDateTimeSeconds(state.endsAt!)}</> : "Срок доступа завершён. Просмотр, экспорт и расчёты по выплатам доступны."}</span><Link href="/dashboard/settings#subscription">{state.active ? "Выбрать тариф" : "Продлить доступ"}</Link></aside>;
}
