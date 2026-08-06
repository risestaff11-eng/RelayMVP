import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getCompanyForUser } from "../../../../db/company";
import { getProgramForCompany } from "../../../../db/programs";
import { ProgramEditor } from "./program-editor";

export const metadata: Metadata = { title: "Настройка кампании" };
export const dynamic = "force-dynamic";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireChatGPTUser(`/dashboard/programs/${id}`);
  const company = await getCompanyForUser(user.userId);
  if (!company) redirect("/onboarding");
  const program = await getProgramForCompany(company.id, id);
  if (!program) notFound();
  return <ProgramEditor initialProgram={program} />;
}
