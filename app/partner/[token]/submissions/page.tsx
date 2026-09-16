import { notFound } from "next/navigation";
import { getPartnerPortal } from "@/db/partner";
import { AgentClientList } from "../../_components/client-list";
import { QuickResultLauncher } from "../../_components/partner-actions";
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params; const p=await getPartnerPortal(token); if(!p) notFound();
 return <div className="partner-portal-content agent-workspace"><div className="partner-page-heading"><h1>Мои клиенты</h1><QuickResultLauncher token={token} missions={p.missions} acceptedMissionIds={p.acceptances.filter(a=>a.status==="ACTIVE").map(a=>a.missionId)}/></div><AgentClientList clients={p.submissions} token={token} payoutDays={p.company.payoutSlaDays} now={p.accessCheckedAt}/></div>;
}
