"use client";

import { useEffect, useState } from "react";

const reasons = [
  "Потому что знает, сколько ему должны.",
  "Потому что заработок всегда перед глазами.",
  "Потому что знает, сколько еще может заработать.",
  "Потому что ни одна возможность заработать не теряется.",
  "Потому что доход растет вместе с активностью.",
];

export function TypedReasons() {
  const [reasonIndex, setReasonIndex] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = reasons[reasonIndex];
    const complete = length === current.length;
    const empty = length === 0;
    const delay = !deleting && complete ? 1650 : deleting ? 24 : 48;

    const timer = window.setTimeout(() => {
      if (!deleting && complete) {
        setDeleting(true);
      } else if (deleting && empty) {
        setDeleting(false);
        setReasonIndex((value) => (value + 1) % reasons.length);
      } else {
        setLength((value) => value + (deleting ? -1 : 1));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [deleting, length, reasonIndex]);

  return <span className="lp-typed-reason"><span aria-hidden="true">{reasons[reasonIndex].slice(0, length)}</span><i aria-hidden="true" /><span className="lp-sr-only">{reasons.join(" ")}</span></span>;
}
