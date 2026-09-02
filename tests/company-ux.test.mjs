import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("company cabinet uses a consistent navigation icon system and contextual topbar", async () => {
  const navigation = await readFile(new URL("../app/dashboard/_components/dashboard-nav.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/dashboard/layout.tsx", import.meta.url), "utf8");
  assert.match(navigation, /DashboardIcon name=\{item\.icon\}/);
  assert.ok(navigation.indexOf('label: "Материалы для агентов"') < navigation.indexOf('label: "Данные компании"'));
  assert.match(layout, /<DashboardContext nextStep=/);
});

test("company dashboard prioritizes results that require review", async () => {
  const dashboard = await readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const startGuide = await readFile(new URL("../app/dashboard/_components/first-run-guide.tsx", import.meta.url), "utf8");
  const tour = await readFile(new URL("../app/dashboard/_components/dashboard-tour.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /stats\.awaitingReview > 0 \? "\/dashboard\/crm"/);
  assert.match(dashboard, /countRu\(stats\.awaitingReview, "новая заявка", "новые заявки", "новых заявок"\)/);
  assert.match(dashboard, /href="\/dashboard\/rewards"/);
  assert.match(dashboard, /<FirstRunGuide/);
  assert.match(startGuide, /Сделайте один полезный шаг/);
  assert.match(startGuide, /приблизит программу к первым продажам/);
  assert.doesNotMatch(tour, /setTimeout\(\(\) => setStep\(0\)/);
});

test("company CRM keeps the client funnel primary while ranking stays separate", async () => {
  const [navigation, crm, workspace, rating] = await Promise.all([
    readFile(new URL("../app/dashboard/_components/dashboard-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/crm/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/crm/crm-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/agent-rating/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(navigation, /href: "\/dashboard\/crm", label: "CRM"/);
  assert.doesNotMatch(navigation, /href: "\/dashboard\/submissions"/);
  assert.doesNotMatch(navigation, /href: "\/dashboard\/partners"/);
  assert.match(crm, /CrmWorkspace/);
  assert.doesNotMatch(crm, /AgentTable/);
  assert.doesNotMatch(crm, /CopyProgramLink/);
  assert.match(workspace, /draggable=\{pending !== item\.id\}/);
  assert.match(workspace, /onDrop=/);
  assert.match(workspace, /Карточка возвращена на прежний этап/);
  assert.match(workspace, /crm-lead-fullscreen/);
  assert.match(workspace, /договор \/ предоплата/i);
  assert.match(workspace, /Компания отметила перевод/);
  assert.doesNotMatch(workspace, />WhatsApp</);
  assert.match(rating, /Рейтинг агентов/);
  assert.match(rating, /AnalyticsFilters/);
});

test("company can set a reward that is then visible to the ambassador", async () => {
  const [workspace, submissionApi, agentList, agentDetail] = await Promise.all([
    readFile(new URL("../app/dashboard/crm/crm-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/partner/[token]/submissions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partner/[token]/submissions/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /Сумма вознаграждения/);
  assert.match(workspace, /amount: calculatedReward/);
  assert.match(workspace, /После сохранения сумма появится в кабинете амбассадора/);
  assert.match(submissionApi, /requestedAmount/);
  assert.match(agentList, /К ВЫПЛАТЕ/);
  assert.match(agentDetail, /formatMoney\(submission\.reward\.amount/);
});

test("company cabinet refinement covers responsive and accessible states", async () => {
  const rootLayout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/company-premium.css", import.meta.url), "utf8");
  assert.match(rootLayout, /import "\.\/company-premium\.css"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});
