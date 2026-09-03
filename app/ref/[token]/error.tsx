"use client";
import { AgentLinkProblem } from "../../agent-link-problem";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AgentLinkProblem temporary reset={reset} />;
}
