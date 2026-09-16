import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { agentFixture } from "./helpers/agent-fixture.mjs";
import { typescriptLoader } from "./helpers/load-typescript.mjs";
import {readFileSync} from "node:fs";

async function submitted(f,a,extra={}) {
 const response=await f.request("/api/public/submissions",f.form(a,extra));
 const body=await response.json(); assert.equal(response.status,201,JSON.stringify(body));return body.submissionId;
}
const note=(a,id,comment="Дополнительные сведения для компании",action="NOTE")=>{
 const f=new FormData();for(const [k,v] of Object.entries({token:a.token,submissionId:id,comment,action}))f.set(k,v);return f;
};
test("additive migration preserves existing agent data and logout clears only this agent's drafts",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();f.sqlite.exec("DROP TABLE agent_drafts; DROP TABLE agent_email_jobs; ALTER TABLE partner_profiles DROP COLUMN notifications_read_at;");
  f.sqlite.exec(readFileSync(new URL('../drizzle/0037_numerous_hulk.sql',import.meta.url),'utf8'));
  assert.equal(f.sqlite.prepare('SELECT email FROM partners WHERE id=?').get(a.partnerId).email,a.email);
  await f.request('/api/partner/draft',{token:a.token,missionId:a.missionId,action:'SAVE',requestId:crypto.randomUUID(),values:{'contact-name':'Client'}});
  await f.load(new URL('../lib/agent-auth.ts',import.meta.url)).createAgentSession(a.email,a.phone);
  assert.equal((await f.request('/api/agent/logout',undefined,{method:'GET'})).status,303);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM agent_drafts').get().n,0);
 }finally{f.close();}
});
test("ambiguous batch response does not delete files belonging to the committed submission",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();const batch=f.binding.batch;let interrupted=false;
  f.binding.batch=async statements=>{const result=await batch(statements);if(!interrupted&&f.sqlite.prepare('SELECT COUNT(*) AS n FROM submission_attachments').get().n){interrupted=true;throw Error('response lost after commit');}return result;};
  const form=f.form(a,{requestId:crypto.randomUUID()});form.set('file__files',new File(['test'],'evidence.pdf',{type:'application/pdf'}));
  const response=await f.request('/api/public/submissions',form);assert.equal(response.status,200,JSON.stringify(await response.json()));
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM submissions').get().n,1);assert.equal(f.objects.size,1);
 }finally{f.close();}
});
test("draft is scoped to the agent and task, expires, and is cleared atomically after submission",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();const b=await f.seed({companyId:"company-b",programId:"program-b",partnerId:"partner-b",email:"other@example.test",userId:"other-user"});
  const data={token:a.token,missionId:a.missionId,action:"SAVE",requestId:crypto.randomUUID(),values:{"contact-name":"Draft Client","contact-phone":"+77012223344",unknown:"must not persist"}};
  assert.equal((await f.request("/api/partner/draft",data)).status,200);
  const read=await (await f.request("/api/partner/draft",{...data,action:"READ"})).json();
  assert.equal(read.draft.values["contact-name"],"Draft Client");assert.equal(read.draft.values.unknown,undefined);
  assert.equal((await f.request("/api/partner/draft",{...data,token:b.token})).status,404);
  await submitted(f,a,{requestId:data.requestId});assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM agent_drafts").get().n,0);
  assert.equal((await f.request("/api/partner/draft",data)).status,200);
  f.sqlite.exec("UPDATE agent_drafts SET expires_at='2000-01-01T00:00:00.000Z'");
  assert.equal((await (await f.request("/api/partner/draft",{...data,action:"READ"})).json()).draft,null);
 }finally{f.close();}
});
test("concurrent retries with the same request ID create one submission and keep the same result",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();const requestId=crypto.randomUUID();
  const responses=await Promise.all([f.request("/api/public/submissions",f.form(a,{requestId})),f.request("/api/public/submissions",f.form(a,{requestId}))]);
  const bodies=await Promise.all(responses.map(r=>r.json()));
  for(const r of responses)assert.ok([200,201].includes(r.status),JSON.stringify(bodies));
  assert.equal(bodies[0].submissionId,bodies[1].submissionId);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM submissions").get().n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM submission_status_events").get().n,1);
  assert.equal(f.deliveries.filter(d=>d.notification==="submission").length,1);
  const repeated=await f.request("/api/public/submissions",f.form(a,{requestId}));assert.equal(repeated.status,200);
 }finally{f.close();}
});
test("clarification is appended, not substituted; request, reply and unread cursor stay tenant scoped",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();const b=await f.seed({companyId:"company-b",programId:"program-b",partnerId:"partner-b",email:"other@example.test",userId:"other-user"});const id=await submitted(f,a);
  const before=f.sqlite.prepare("SELECT * FROM submissions WHERE id=?").get(id);
  f.setCompany(b.companyId);assert.equal((await f.request("/api/company/agent-clarification",{submissionId:id,comment:"Уточните удобное время"})).status,404);
  f.setCompany(a.companyId);assert.equal((await f.request("/api/company/agent-clarification",{submissionId:id,comment:"Уточните удобное время"})).status,200);
  const portal=await f.load(new URL("../db/partner.ts",import.meta.url)).getPartnerPortal(a.token);
  const {clientAttention}=f.load(new URL("../lib/agent-workspace.ts",import.meta.url));assert.equal(clientAttention(portal.submissions[0],7,Date.now()),"Компания просит уточнение");
  assert.equal((await f.request("/api/partner/notes",note(b,id))).status,404);
  assert.equal((await f.request("/api/partner/notes",note(a,id))).status,200);
  assert.deepEqual(f.sqlite.prepare("SELECT * FROM submissions WHERE id=?").get(id),before);
  assert.equal((await f.request("/api/partner/notes",note(a,id))).status,429);
  const read=await f.request("/api/partner/actions",{token:a.token,action:"READ_EVENTS",through:new Date(Date.now()+1000).toISOString()});assert.equal(read.status,200);
  const cursor=f.sqlite.prepare("SELECT notifications_read_at AS at FROM partner_profiles WHERE partner_id=?").get(a.partnerId).at;assert.ok(cursor);
  assert.equal(f.sqlite.prepare("SELECT notifications_read_at AS at FROM partner_profiles WHERE partner_id=?").get(b.partnerId).at,null);
  await f.request("/api/partner/actions",{token:a.token,action:"READ_EVENTS",through:"2000-01-01"});assert.equal(f.sqlite.prepare("SELECT notifications_read_at AS at FROM partner_profiles WHERE partner_id=?").get(a.partnerId).at,cursor);
 }finally{f.close();}
});
test("overdue reminders have a 24-hour limit and never change the business status",async()=>{
 const f=agentFixture();try{
  const a=await f.seed();const id=await submitted(f,a);
  assert.equal((await f.request("/api/partner/notes",note(a,id,"","REMIND"))).status,400);
  f.sqlite.prepare("UPDATE submissions SET review_due_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z",id);
  assert.equal((await f.request("/api/partner/notes",note(a,id,"","REMIND"))).status,200);
  assert.equal((await f.request("/api/partner/notes",note(a,id,"","REMIND"))).status,429);
  assert.equal(f.sqlite.prepare("SELECT review_status FROM submissions WHERE id=?").get(id).review_status,"PENDING");
 }finally{f.close();}
});
test("failed emails retry from durable storage, then stop after success",async()=>{
 const f=agentFixture();const originalError=console.error;try{
  console.error=()=>{};const a=await f.seed();const id=await submitted(f,a);
  const mail=f.load(new URL("../lib/agent-email.ts",import.meta.url));let attempts=0;mail.sendAgentWorkUpdate=async()=>{attempts++;throw Error("unavailable");};
  const service=f.load(new URL("../lib/agent-work-notifications.ts",import.meta.url));await service.notifyAgentWorkChanges(a.companyId,[id]);
  assert.equal(attempts,1);assert.equal(f.sqlite.prepare("SELECT status FROM agent_email_jobs").get().status,"RETRY");
  f.sqlite.exec("UPDATE agent_email_jobs SET next_attempt_at='2000-01-01'");mail.sendAgentWorkUpdate=async()=>{attempts++;};
  await service.drainAgentNotifications();assert.equal(attempts,2);assert.equal(f.sqlite.prepare("SELECT status FROM agent_email_jobs").get().status,"SENT");
  await service.notifyAgentWorkChanges(a.companyId,[id]);assert.equal(attempts,2);
 }finally{console.error=originalError;f.close();}
});
test("reward semantics distinguish zero, estimate, cancelled and receipt; next actions use actual deadlines",()=>{
 const load=typescriptLoader();const {agentReward,clientAttention}=load(new URL("../lib/agent-workspace.ts",import.meta.url));
 const r={amount:0,currency:"KZT",status:"APPROVED",partnerConfirmedAt:null,plannedAt:null,approvedAt:null};
 assert.equal(agentReward(r).amount,"0 ₸");assert.equal(agentReward(r).label,"Компания должна выплатить");assert.equal(agentReward(null).label,"После выполнения условий");
 assert.equal(agentReward({...r,status:"CANCELLED"}).label,"Начисление отменено");assert.equal(agentReward({...r,status:"PAID"}).label,"Компания отметила перевод");assert.equal(agentReward({...r,status:"PAID",partnerConfirmedAt:"2026-01-01"}).label,"Деньги получены");
 assert.equal(clientAttention({events:[],reward:null,reviewStatus:"PENDING",reviewDueAt:null},7,Date.now()),"");
});
test("single accepted task opens the form directly; optional information is collapsed",()=>{
 const load=typescriptLoader({"next/image":{default:props=>createElement("img",props)},"next/navigation":{usePathname:()=>"/",useRouter:()=>({})}});const {QuickResultLauncher}=load(new URL("../app/partner/_components/partner-actions.tsx",import.meta.url));
 const mission={id:"m",title:"Test",programName:"Test",rewardLabel:"25 000 ₸",status:"ACTIVE",type:"LEAD"};
 const html=renderToStaticMarkup(createElement(QuickResultLauncher,{token:"test",missions:[mission],acceptedMissionIds:["m"]}));assert.match(html,/href="\/partner\/test\/submit\/m"/);assert.match(html,/Передать клиента/);
 const {LeadSubmissionForm}=load(new URL("../app/p/[slug]/missions/[missionId]/submit/lead-submission-form.tsx",import.meta.url));
 const {parseSubmissionFormFields}=load(new URL("../lib/submission-form.ts",import.meta.url));
 const form=renderToStaticMarkup(createElement(LeadSubmissionForm,{programSlug:"test",missionId:"m",missionType:"LEAD",token:"test",formFields:parseSubmissionFormFields(null).filter(f=>f.type!=="FILE")}));
 assert.match(form,/Подтвердить и отправить/);assert.match(form,/<details[^>]*><summary>Заполнить голосом/);assert.ok(!form.includes('class="lead-form-stepper"'));
});
