import { getD1 } from ".";
export async function productFunnel() {
  const [events, payments] = await Promise.all([
    getD1().prepare("SELECT event, count(*) AS companies FROM product_milestones GROUP BY event").all<{ event: string; companies: number }>(),
    getD1().prepare("SELECT plan_code AS planCode, sum(paid_amount) AS revenue, count(*) AS activations FROM subscription_events WHERE action IN ('ACTIVATE','EXTEND') GROUP BY plan_code").all<{ planCode: string; revenue: number; activations: number }>(),
  ]);
  return { events: events.results, payments: payments.results };
}
