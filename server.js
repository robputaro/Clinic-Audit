import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import {Pool} from "pg";
import {publicConfig,scoreSubmission,renderScorecard} from "./lib/audit.js";

const app=express();
const pool=new Pool({connectionString:process.env.POSTGRES_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined});
const PORT=process.env.PORT||3000;
const SESSION_COOKIE="astra_stage";

app.disable("x-powered-by");
app.use(express.json({limit:"100kb"}));
app.use(express.urlencoded({extended:false,limit:"20kb"}));
app.use(cookieParser());
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","same-origin");res.setHeader("X-Frame-Options","DENY");next();});
app.use("/assets",express.static("public",{fallthrough:false,maxAge:"1h"}));

function sign(value){return crypto.createHmac("sha256",process.env.SESSION_SECRET||"").update(value).digest("base64url")}
function makeSession(){const expires=Date.now()+8*60*60*1000;const value=String(expires);return `${value}.${sign(value)}`}
function validSession(req){const raw=req.cookies[SESSION_COOKIE];if(!raw)return false;const [expires,sig]=raw.split(".");if(!expires||!sig||Number(expires)<Date.now())return false;const expected=sign(expires);return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
function requireStage(req,res,next){if(!validSession(req))return res.status(401).json({error:"Stage authentication required"});next();}
function safeEqual(a,b){const aa=Buffer.from(String(a||""));const bb=Buffer.from(String(b||""));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function validateIdentity(body){if(!String(body.clinicName||"").trim())throw new Error("Clinic name is required");if(!String(body.city||"").trim())throw new Error("City is required");if(!["yes","no","unsure"].includes(body.financeStatus))throw new Error("Finance status is required");if(!Array.isArray(body.devices)||body.devices.length<1)throw new Error("Select at least one device");}

app.get("/",(req,res)=>res.redirect("/audit"));
app.get("/audit",(req,res)=>res.sendFile("audit.html",{root:"public"}));
app.get("/stage",(req,res)=>res.sendFile(validSession(req)?"stage.html":"stage-login.html",{root:"public"}));
app.get("/stage/projector/:id",(req,res)=>res.sendFile(validSession(req)?"projector.html":"stage-login.html",{root:"public"}));
app.get("/api/config",(req,res)=>res.json(publicConfig()));

app.post("/api/submit",async(req,res)=>{
  try{
    validateIdentity(req.body);
    const scored=scoreSubmission(req.body);
    const id=crypto.randomUUID();
    const q=`INSERT INTO audit_submissions (id,clinic_name,city,website,instagram,devices,finance_status,provider_count,live_review_consent,anonymous_review,answers,score,blind_spot,unknown_count,burn_flag) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)`;
    await pool.query(q,[id,req.body.clinicName.trim(),req.body.city.trim(),req.body.website||null,req.body.instagram||null,JSON.stringify(req.body.devices),req.body.financeStatus,req.body.providerCount||null,!!req.body.liveReviewConsent,!!req.body.anonymousReview,JSON.stringify(req.body.answers),scored.total,scored.blind,scored.unknowns,scored.burn]);
    const submission={...req.body,id,scored};
    res.status(201).json({id,scorecardHtml:renderScorecard(submission)});
  }catch(err){console.error(err);res.status(400).json({error:err.message||"Submission failed"});}
});

app.post("/api/stage/login",(req,res)=>{
  if(!process.env.STAGE_PASSWORD||!process.env.SESSION_SECRET)return res.status(503).json({error:"Stage authentication is not configured"});
  if(!safeEqual(req.body.password,process.env.STAGE_PASSWORD))return res.status(401).json({error:"Incorrect password"});
  res.cookie(SESSION_COOKIE,makeSession(),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:8*60*60*1000,path:"/"});
  res.json({ok:true});
});
app.post("/api/stage/logout",(req,res)=>{res.clearCookie(SESSION_COOKIE,{path:"/"});res.json({ok:true});});

app.get("/api/submissions",requireStage,async(req,res)=>{
  const sort={delta:"blind_spot DESC",score:"score ASC",burn:"burn_flag DESC, blind_spot DESC",name:"clinic_name ASC"}[req.query.sort]||"blind_spot DESC";
  const {rows}=await pool.query(`SELECT id,created_at,clinic_name,city,devices,live_review_consent,anonymous_review,score,blind_spot,unknown_count,burn_flag FROM audit_submissions ORDER BY ${sort} LIMIT 500`);
  res.json({submissions:rows});
});
app.get("/api/submission/:id",requireStage,async(req,res)=>{
  const {rows}=await pool.query("SELECT * FROM audit_submissions WHERE id=$1 LIMIT 1",[req.params.id]);
  if(!rows[0])return res.status(404).json({error:"Submission not found"});
  const r=rows[0];
  const submission={id:r.id,clinicName:r.clinic_name,city:r.city,website:r.website,instagram:r.instagram,devices:r.devices,financeStatus:r.finance_status,providerCount:r.provider_count,liveReviewConsent:r.live_review_consent,anonymousReview:r.anonymous_review,answers:r.answers};
  const scored=scoreSubmission(submission);
  res.json({id:r.id,consented:r.live_review_consent,cardHtml:renderScorecard({...submission,scored},{forStage:true}),projectorHtml:renderScorecard({...submission,scored},{forStage:false,projector:true})});
});

app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Unexpected server error"});});
app.listen(PORT,()=>console.log(`Astra audit listening on http://localhost:${PORT}`));
export default app;
