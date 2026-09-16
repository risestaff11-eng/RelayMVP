import { notFound } from "next/navigation";
import { getPartnerPortal } from "@/db/partner";
import { AgentTaskList } from "../../_components/task-list";
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params; const p=await getPartnerPortal(token); if(!p) notFound();
 return <div className="partner-portal-content agent-workspace"><div className="partner-page-heading"><h1>Задания</h1></div><AgentTaskList missions={p.missions} acceptedMissionIds={p.acceptances.filter(a=>a.status==="ACTIVE").map(a=>a.missionId)} token={token}/></div>;
}
