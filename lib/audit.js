export const DEVICES = ["Emsculpt NEO","Emsculpt (classic)","Emsella","Emface","Emtone","Emfemme 360","Exilis Ultra 360","Vanquish ME","Other BTL device"];

export const PILLARS = [
  { id:"util", name:"Utilization", weight:25, sub:"A device only earns while it is running. This is the number every other number depends on.", conf:"Our BTL devices run close to their full capacity.", behLabel:"In a typical week, how many treatment hours does your busiest BTL device actually deliver?", options:[
    {id:"under_2",label:"Under 2 hours",score:10},{id:"2_5",label:"2–5 hours",score:30},{id:"6_10",label:"6–10 hours",score:55},{id:"11_20",label:"11–20 hours",score:80},{id:"over_20",label:"More than 20 hours",score:100},{id:"unknown",label:"I do not track this",score:5,unknown:true}],
    good:"The machine is working for its keep.", bad:"The asset is idle most of the week. Everything else is downstream of this.", unknown:"You cannot fix a utilization problem you have never measured." },
  { id:"conv", name:"Consult conversion", weight:15, sub:"They walked in the door. What happened next?", conf:"Almost everyone who comes in for a BTL consult books a treatment.", behLabel:"Of your last 10 BTL consults, how many booked a treatment?", options:[
    {id:"0_2",label:"0–2 of them",score:15},{id:"3_4",label:"3–4",score:35},{id:"5_6",label:"5–6",score:55},{id:"7_8",label:"7–8",score:80},{id:"9_10",label:"9–10",score:100},{id:"unknown",label:"I do not know",score:5,unknown:true}],
    good:"The consult is doing its job.", bad:"You are paying to get people into a room and then losing them in it.", unknown:"Nobody in the room knows whether the consult works." },
  { id:"comp", name:"Series completion", weight:25, sub:"A four-session protocol that stops at two is not half a result. It is no result — and a patient who now believes the device does not work.", conf:"Patients who start a treatment series almost always finish every session.", behLabel:"Of patients who started a BTL series in the last 6 months, what share completed every session?", options:[
    {id:"under_40",label:"Under 40%",score:10},{id:"40_59",label:"40–59%",score:30},{id:"60_74",label:"60–74%",score:50},{id:"75_89",label:"75–89%",score:75},{id:"90_plus",label:"90% or more",score:100},{id:"unknown",label:"I do not know",score:5,unknown:true}],
    good:"Patients finish, so patients get results.", bad:"Dropouts cost the revenue, the result, and the referral.", unknown:"This is one of the most expensive numbers a clinic can fail to track." },
  { id:"maint", name:"Maintenance return", weight:15, sub:"The series ends. Then what?", conf:"Patients come back for maintenance without us chasing them.", behLabel:"What actually happens after a patient finishes their series?", options:[
    {id:"drift",label:"Nothing is scheduled — they drift",score:10},{id:"remember",label:"We reach out when we remember",score:30},{id:"manual",label:"Staff manually follow up",score:55},{id:"automated",label:"Automated follow-up and a booked maintenance date",score:95},{id:"unknown",label:"Not sure",score:5,unknown:true}],
    good:"You built a return path, not a cliff.", bad:"You paid the acquisition cost once and threw away the annuity.", unknown:"If nobody knows what happens after the last session, nothing happens." },
  { id:"oper", name:"Operator dependency", weight:10, sub:"How much of this revenue walks out the door if one person does?", conf:"If our top provider left tomorrow, BTL revenue would hold.", behLabel:"How many people can run the device end to end — consult, protocol, and result?", options:[
    {id:"one",label:"Just one person",score:15},{id:"two",label:"Two",score:45},{id:"three",label:"Three",score:70},{id:"four_plus",label:"Four or more",score:95},{id:"unknown",label:"Nobody does it consistently",score:5,unknown:true}],
    good:"The capability lives in the clinic, not in one person.", bad:"You do not own a device business. You own one person's calendar.", unknown:"Inconsistent operation produces inconsistent results." },
  { id:"econ", name:"Unit economics", weight:10, sub:"Discounting to fill a calendar is a symptom of everything above.", conf:"We know what each device earns, and we rarely discount to fill it.", behLabel:"In the last 90 days, how often did you discount BTL treatments to fill the calendar?", options:[
    {id:"never",label:"Never",score:100},{id:"once_twice",label:"Once or twice",score:70},{id:"monthly",label:"About monthly",score:40},{id:"constant",label:"Constantly — it is how we fill",score:10},{id:"unknown",label:"We discount, but do not track it",score:5,unknown:true}],
    good:"You are selling the outcome, not the price.", bad:"Every discount trains the market to wait for the next one.", unknown:"Discounting without tracking is slowly lowering your price." }
];

export function publicConfig(){
  return {devices:DEVICES,pillars:PILLARS.map(({id,name,sub,conf,behLabel,options})=>({id,name,sub,conf,behLabel,options:options.map(({id,label,unknown})=>({id,label,unknown:!!unknown}))}))};
}

export function scoreSubmission(body){
  const rows=PILLARS.map(p=>{
    const confidence=Number(body.answers?.[p.id]?.confidence);
    const option=p.options.find(o=>o.id===body.answers?.[p.id]?.reality);
    if(!Number.isInteger(confidence)||confidence<1||confidence>5||!option) throw new Error(`Invalid answer for ${p.name}`);
    const belief=(confidence-1)*25;
    return {id:p.id,name:p.name,weight:p.weight,belief,reality:option.score,delta:belief-option.score,unknown:!!option.unknown,answer:option.label,good:p.good,bad:p.bad,unknownCopy:p.unknown};
  });
  const total=Math.round(rows.reduce((sum,r)=>sum+r.reality*r.weight,0)/100);
  const blind=Math.max(0,...rows.map(r=>r.delta));
  const unknowns=rows.filter(r=>r.unknown).length;
  const burn=body.financeStatus==="yes"&&rows.find(r=>r.id==="util").reality<=30;
  return {rows,total,blind,unknowns,burn};
}

export function band(total){
  if(total>=78)return ["Compounding","The asset is producing. Protect the systems that got you here."];
  if(total>=58)return ["Functional","It works, but it leaks. The gaps are visible and fixable."];
  if(total>=38)return ["Underwater","The device is not producing consistently enough. Start with capacity and completion before adding demand."];
  return ["Critical","The asset needs an operating reset before more promotion or discounting."];
}

const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

export function renderScorecard(submission,{forStage=false,projector=false}={}){
  const data=submission.scored||scoreSubmission(submission);
  const [bandName,bandDesc]=band(data.total);
  const shownName=submission.anonymousReview?"Clinic withheld":submission.clinicName;
  const subline=submission.anonymousReview?"Anonymous submission":[submission.city,(submission.devices||[]).join(" · ")].filter(Boolean).join(" — ");
  return `<article class="card ${projector?"projector-card":""}"><header class="card-top"><div class="brandline"><span>Astra Culture · Device Performance Audit</span><span>Masters of Masterclasses</span></div><h1 class="card-name">${esc(shownName)}</h1><div class="card-sub">${esc(subline)}</div><div class="card-score"><div class="big-num">${data.total}<span>/100</span></div><div class="score-meta"><div class="band">${bandName}</div><div class="desc">${bandDesc}</div></div></div></header><section class="bars"><div class="bars-legend"><span><i class="lg-real"></i>Operating signal</span><span><i class="lg-belief"></i>Self-rating</span></div>${data.rows.map(r=>{const gap=r.delta>=20;return `<div class="bar-row"><div class="bar-head"><span class="nm">${esc(r.name)}</span><span class="nums">${r.reality}${gap?` · self-rated ${r.belief}`:""}</span></div><div class="bar-track"><div class="bar-real" style="width:${r.reality}%"></div><div class="bar-belief" style="left:${Math.min(100,r.belief)}%"></div></div><div class="bar-note ${r.unknown?"flag":""}">${esc(r.unknown?r.unknownCopy:(r.reality>=70?r.good:r.bad))}</div></div>`}).join("")}</section>${forStage?renderBriefing(submission,data):`<footer class="card-close"><strong>Bring this with you.</strong> The scorecard is a directional operating audit, not a financial valuation. The useful part is the distance between your self-rating and your current operating signal.</footer>`}</article>`;
}

function renderBriefing(submission,data){
  const rows=data.rows;
  const worst=[...rows].sort((a,b)=>b.delta-a.delta)[0];
  const weakest=[...rows].sort((a,b)=>a.reality-b.reality)[0];
  const strongest=[...rows].sort((a,b)=>b.reality-a.reality)[0];
  const unknownRows=rows.filter(r=>r.unknown);
  const who=submission.anonymousReview?"this clinic":submission.clinicName;
  const beats=[];
  if(worst.delta>=20) beats.push(["Open with the contradiction",`They self-rated <strong>${esc(worst.name)}</strong> at ${worst.belief}/100, while the operating answer scores ${worst.reality}/100: “${esc(worst.answer)}.” Ask them what explains the distance before supplying an answer.`]);
  beats.push(["Follow the mechanism",`The weakest operating signal is <strong>${esc(weakest.name)} at ${weakest.reality}</strong>. ${esc(weakest.bad)} Keep the conversation on the operating system, not the owner's character.`]);
  if(data.burn) beats.push(["Handle carefully",`The device is still financed or leased and utilization is at ${rows.find(r=>r.id==="util").reality}. Name the carrying-cost problem plainly, then move immediately to the first controllable operating change.`]);
  if(unknownRows.length) beats.push(["The cleanest next step",`There are ${unknownRows.length} visibility gaps: ${esc(unknownRows.map(r=>r.name).join(", "))}. These are often the fastest fixes because measurement can begin before strategy changes.`]);
  beats.push(["Give this back",strongest.reality>=70?`<strong>${esc(strongest.name)} is genuinely strong at ${strongest.reality}.</strong> ${esc(strongest.good)} Close by asking how that system could be copied elsewhere.`:`There is no category above 70. Give them credit for answering without inflating the numbers, then identify one first move rather than leaving them with six failures.`]);
  return `<section class="brief"><div class="brief-tag"><span>Private stage briefing</span><span>Never served by /audit</span></div><h2>How to run <em>${esc(who)}</em></h2>${beats.map(([label,html])=>`<div class="beat"><div class="lbl">${label}</div><div class="body">${html}</div></div>`).join("")}${!submission.anonymousReview&&data.total<40?`<div class="brief-warn"><strong>Consider anonymizing this one.</strong> A named score below 40 can overwhelm the useful operating lesson.</div>`:""}</section>`;
}
