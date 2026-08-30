"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const steps = [
  { target: "overview", title: "Рабочий стол", text: "Главные показатели, свежие события и следующий рекомендуемый шаг." },
  { target: "programs", title: "Программы", text: "Создавайте задания, назначайте награды и публикуйте внешнюю ссылку." },
  { target: "submissions", title: "Заявки", text: "Принимайте клиентов в работу или отклоняйте заявку с понятной причиной." },
  { target: "partners", title: "Агенты", text: "Следите за участниками, их активностью и вкладом в программы." },
  { target: "rewards", title: "Выплаты", text: "Контролируйте начисления, сроки и отметки о фактической выплате." },
  { target: "analytics", title: "Аналитика", text: "Сравнивайте активацию агентов, качество результатов и стоимость канала." },
];

type TourRect = { top: number; left: number; width: number; height: number };

export function DashboardTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [compact, setCompact] = useState(false);

  const updateRect = useCallback(() => {
    if (step === null) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${steps[step].target}"]`);
    if (!element || element.offsetParent === null) return setRect(null);
    const box = element.getBoundingClientRect();
    setRect({ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 });
  }, [step]);

  useEffect(() => {
    const updateCompact = () => setCompact(window.innerWidth <= 760);
    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
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

  const targeted = Boolean(rect && !compact);
  const overlay = step !== null ? <div className="tour-layer" role="dialog" aria-modal="true" aria-label="Обучение по кабинету"><div className="tour-backdrop" />{targeted && rect && <div className="tour-highlight" style={rect} />}<div className={`tour-tooltip ${compact ? "mobile" : targeted ? "targeted" : "centered"}`} style={targeted && rect ? { top: Math.min(window.innerHeight - 250, Math.max(20, rect.top)), left: Math.min(window.innerWidth - 350, rect.left + rect.width + 18) } : undefined}><div className="tour-progress"><span>ШАГ {step + 1} ИЗ {steps.length}</span><button type="button" onClick={close}>Пропустить</button></div><h2>{steps[step].title}</h2><p>{steps[step].text}</p><div className="tour-dots">{steps.map((item, index) => <i className={index === step ? "active" : ""} key={item.target} />)}</div><div className="tour-actions">{step > 0 && <button type="button" className="tour-back" onClick={() => setStep(step - 1)}>Назад</button>}<button type="button" className="tour-next" onClick={next}>{step === steps.length - 1 ? "Готово" : "Далее →"}</button></div></div></div> : null;

  return (
    <>
      <button className="icon-button tour-launch" type="button" onClick={() => setStep(0)} aria-label="Открыть обзор разделов" title="Обзор разделов">?</button>
      {overlay && createPortal(overlay, document.body)}
    </>
  );
}
