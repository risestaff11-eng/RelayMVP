import assert from 'node:assert/strict';
import test from 'node:test';
import {Window} from 'happy-dom';
import {typescriptLoader} from './helpers/load-typescript.mjs';
const window=new Window({url:'https://agents.risestaff.kz/partner/test/submit/m'});
for(const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Event','FormData'])Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true,writable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {act,createElement}=await import('react');const {createRoot}=await import('react-dom/client');
const load=typescriptLoader({'next/image':()=>null});
const {LeadSubmissionForm}=load(new URL('../app/p/[slug]/missions/[missionId]/submit/lead-submission-form.tsx',import.meta.url));
const {parseSubmissionFormFields}=load(new URL('../lib/submission-form.ts',import.meta.url));
async function mount(Component,props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>{root.render(createElement(Component,props));});return {host,async close(){await act(async()=>root.unmount());host.remove();}};}
async function fill(host,name,value){const input=host.querySelector(`[name="${name}"]`);assert.ok(input);await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
const props={token:'test',missionId:'m',missionType:'LEAD',programSlug:'program',formFields:parseSubmissionFormFields(null)};
test('compact form restores its draft and keeps values and retry identity after a network error',async()=>{
 const original=globalThis.fetch;let draft=null;let ui;const requests=[];let release;
 globalThis.fetch=async(path,options)=>{
  if(path==='/api/partner/draft'){const payload=JSON.parse(options.body);if(payload.action==='SAVE')draft={values:payload.values,requestId:payload.requestId};return Response.json({draft});}
  requests.push(options.body);return new Promise(resolve=>{release=()=>resolve(Response.json({error:'Temporary failure'},{status:503}));});
 };
 try{
  ui=await mount(LeadSubmissionForm,props);assert.equal(ui.host.querySelector('.lead-form-stepper'),null);
  await fill(ui.host,'field__contact-name','Client Draft');await fill(ui.host,'field__contact-phone','77012223344');
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,900));});assert.equal(draft.values['contact-name'],'Client Draft');
  await ui.close();ui=await mount(LeadSubmissionForm,props);assert.equal(ui.host.querySelector('[name="field__contact-name"]').value,'Client Draft');
  await act(async()=>{for(let i=0;i<2;i++)ui.host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(requests.length,1);assert.equal(requests[0].get('requestId'),draft.requestId);
  await act(async()=>{release();});assert.equal(ui.host.querySelector('[name="field__contact-name"]').value,'Client Draft');assert.match(ui.host.querySelector('[role="alert"]').textContent,/Temporary failure/);
  await act(async()=>ui.host.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(requests.length,2);assert.equal(requests[1].get('requestId'),requests[0].get('requestId'));await act(async()=>release());
 }finally{if(ui)await ui.close();globalThis.fetch=original;}
});
test('receipt requires opening the confirmation and an explicit second action',async()=>{
 const original=globalThis.fetch;const calls=[];globalThis.fetch=async(path,options)=>{calls.push(JSON.parse(options.body));return Response.json({ok:true});};let ui;
 try{const {RewardReceiptConfirmation}=load(new URL('../app/partner/_components/partner-actions.tsx',import.meta.url));ui=await mount(RewardReceiptConfirmation,{token:'test',rewardId:'r',confirmed:false,supportHref:'https://example.test',amount:'25 000 ₸',companyName:'Company'});
  await act(async()=>ui.host.querySelector('button').click());assert.equal(calls.length,0);assert.match(ui.host.textContent,/25 000 ₸/);await act(async()=>[...ui.host.querySelectorAll('button')].find(b=>b.textContent==='Да, деньги получены').click());assert.equal(calls.length,1);assert.equal(calls[0].confirmed,true);assert.match(ui.host.textContent,/Деньги получены/);
 }finally{if(ui)await ui.close();globalThis.fetch=original;}
});
