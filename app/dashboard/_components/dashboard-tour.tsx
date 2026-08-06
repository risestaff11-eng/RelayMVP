"use client";

import { useCallback, useEffect, useState } from "react";

const steps = [
  { target: "overview", title: "Рабочий стол", text: "Главные показатели, свежие события и следующий рекомендуемый шаг." },
  { target: "programs", title: "Кампании", text: "Создавайте задания, назначайте награды и публикуйте внешнюю ссылку." },
  { target: "submissions", title: "Результаты", text: "Проверяйте лиды, сделки, публикации и другие доказательства выполнения." },
  { target: "partners", title: "Агенты", text: "Следите за участниками, их активностью и вкладом в кампании." },
  { target: "rewards", title: "Выплаты", text: "Контролируйте начисления, сроки и отметки о фактической выплате." },
  { target: "analytics", title: "Аналитика", text: "Сравнивайте активацию агентов, качество результатов и стоимость канала." },
];

type TourRect = { top: number; left: number; width: number; height: number };

export function DashboardTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<TourRect | null>(null);

  const updateRect = useCallback(() => {
    if (step === null) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${steps[step].target}"]`);
    if (!element || element.offsetParent === null) return setRect(null);
    const box = element.getBoundingClientRect();
    setRect({ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 });
  }, [step]);

  useEffect(() => {
    if (localStorage.getItem("relay-dashboard-tour-v1") !== "done") {
      const timer = window.setTimeout(() => setStep(0), 550);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateRect);
    window.addEventListener("resize", updateRect);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRect);
    };
  }, [updateRect]);

  function close() {
    localStorage.setItem("relay-dashboard-tour-v1", "done");
    setStep(null);
  }

  function next() {
    if (step === null) return;
    if (step === steps.length - 1) return close();
    setStep(step + 1);
  }

  return (
    <>
      <button className="icon-button tour-launch" type="button" onClick={() => setStep(0)} aria-label="Открыть обучение">?</button>
      {step !== null && <div className="tour-layer" role="dialog" aria-modal="true" aria-label="Обучение по кабинету"><div className="tour-backdrop" />{rect && <div className="tour-highlight" style={rect} />}<div className={`tour-tooltip ${rect ? "targeted" : "centered"}`} style={rect ? { top: Math.min(window.innerHeight - 250, Math.max(20, rect.top)), left: Math.min(window.innerWidth - 350, rect.left + rect.width + 18) } : undefined}><div className="tour-progress"><span>ШАГ {step + 1} ИЗ {steps.length}</span><button type="button" onClick={close}>Пропустить</button></div><h2>{steps[step].title}</h2><p>{steps[step].text}</p><div className="tour-dots">{steps.map((item, index) => <i className={index === step ? "active" : ""} key={item.target} />)}</div><div className="tour-actions">{step > 0 && <button type="button" className="tour-back" onClick={() => setStep(step - 1)}>Назад</button>}<button type="button" className="tour-next" onClick={next}>{step === steps.length - 1 ? "Готово" : "Далее →"}</button></div></div></div>}
    </>
  );
}
