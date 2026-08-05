import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Кабинет компании" };
export const dynamic = "force-dynamic";

const modules = {
  programs: {
    kicker: "ПАРТНЁРСКИЕ ПРОГРАММЫ",
    title: "Программы и миссии",
    description: "Здесь будут опубликованные программы и четыре типа партнёрских миссий.",
    icon: "◇",
    emptyTitle: "Создайте первую программу",
    emptyText: "Подтвердите профиль компании — после этого Relay подготовит миссии для лидов, сделок, имиджа и вовлечения.",
    action: "Продолжить настройку профиля",
    href: "/dashboard/company-profile",
  },
  submissions: {
    kicker: "РЕЗУЛЬТАТЫ МИССИЙ",
    title: "Лиды и результаты",
    description: "Единая очередь для проверки лидов, сделок, публикаций и заданий вовлечения.",
    icon: "↗",
    emptyTitle: "Результатов пока нет",
    emptyText: "Они появятся, когда вы опубликуете программу и первый партнёр отправит результат.",
    action: "Перейти к программам",
    href: "/dashboard/programs",
  },
  partners: {
    kicker: "ПАРТНЁРСКАЯ СЕТЬ",
    title: "Партнёры и амбассадоры",
    description: "Управляйте внешними продавцами и отслеживайте вклад каждого участника.",
    icon: "○",
    emptyTitle: "Первый партнёр ещё не подключён",
    emptyText: "Ссылка для приглашения появится после публикации первой программы.",
    action: "Подготовить программу",
    href: "/dashboard/programs",
  },
  rewards: {
    kicker: "ФИНАНСЫ",
    title: "Вознаграждения",
    description: "Начисления, ожидаемые выплаты и прозрачная история по каждому результату.",
    icon: "₸",
    emptyTitle: "Начислений пока нет",
    emptyText: "Вознаграждение появится здесь после того, как компания примет результат партнёра.",
    action: "Настроить первую миссию",
    href: "/dashboard/programs",
  },
  analytics: {
    kicker: "АНАЛИТИКА КАНАЛА",
    title: "Эффективность программы",
    description: "Следите за активацией партнёров, качеством лидов и стоимостью результата.",
    icon: "⌁",
    emptyTitle: "Для аналитики нужны данные",
    emptyText: "Графики появятся после первых просмотров программы, подключений партнёров и отправленных результатов.",
    action: "Запустить программу",
    href: "/dashboard/programs",
  },
} as const;

export default async function DashboardSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const module = modules[section as keyof typeof modules];
  if (!module) notFound();

  return (
    <div className="dashboard-content module-content">
      <div className="module-heading">
        <div><span className="module-kicker">{module.kicker}</span><h1>{module.title}</h1><p>{module.description}</p></div>
      </div>
      <section className="module-empty panel">
        <div className="module-empty-icon">{module.icon}</div>
        <h2>{module.emptyTitle}</h2>
        <p>{module.emptyText}</p>
        <a className="button button-primary" href={module.href}>{module.action}<span>→</span></a>
      </section>
    </div>
  );
}
