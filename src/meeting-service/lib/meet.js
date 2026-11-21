import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {flushNotionMeeting,queueLinkedPlayer,queueNotionEvent} from './notion-sync.js';

const hash=s=>createHash('sha256').update(s).digest('hex');
const key=()=>randomBytes(32).toString('hex');
const validKey=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const clean=(s,max=180)=>String(s??'').trim().slice(0,max);
const time=s=>Date.parse(s+'+08:00');
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status})};
const assert=(ok,m)=>{if(!ok)fail(m)};
const positive=e=>e.rows.filter(r=>r.status==='正取');
const capacity=e=>e.capacity??6;
const waiting=e=>e.rows.filter(r=>r.status==='候補');
const party=(e,row)=>row.groupId?e.rows.filter(entry=>entry.groupId===row.groupId&&entry.status===row.status):[row];
const partyKey=row=>row.groupId||row.id;
function attachReservedRows(db,uid,playerId){
 for(const event of db.events){
 const queued=event.rows.find(row=>row.notionPlayerId===playerId&&row.status!=='取消');
 if(queued&&!event.rows.some(row=>row.uid===uid&&row.status!=='取消'))queued.uid=uid;
 }
}
const fee=r=>r.due??(r.status==='正取'?300:0);
function preferences(body){
 const list=['輕','中','重'].filter(x=>Array.isArray(body.pref)&&body.pref.includes(x));
 assert(list.length,'請選擇策略程度');return list.join('、');
}
function cutoff(e,now){
 if(e.draft||e.done||e.closed||e.cutoff||now<time(e.deadline))return;
 e.cutoff={deadline:e.deadline,count:positive(e).length};
 if(e.cutoff.count<3&&!e.reached&&!e.published){e.closed=true;e.log.push('截止時少於 3 位玩家，已停辦')}
}
function project(db,admin,uid){
 return {admin,catalog:db.catalog||[],profile:db.members[uid],...(admin?{members:db.members}:{}),
 events:db.events.filter(e=>admin||!e.draft).map(e=>{
 const {rows,address,travel,gameNotes,arrivalContact,teachingStart,...basic}=e;
 const me=rows.findLast(r=>r.uid===uid),qualified=me?.status==='正取'&&e.published&&!e.closed;
 const queue=[...new Set(waiting(e).map(partyKey))];
 const companions=me?.groupId?party(e,me).filter(row=>row!==me).map(row=>({id:row.id,name:row.name,table:qualified?row.table:'',changeRequest:row.changeRequest,changeResult:row.changeResult})):[];
 const removedCompanions=me?.groupId&&me.status!=='取消'?rows.filter(row=>row.groupId===me.groupId&&row.status==='取消').map(row=>row.name):[];
 return {...basic,capacity:capacity(e),count:positive(e).length,waiting:rows.filter(r=>r.status==='候補').length,
 ...(admin||qualified?{address,travel,gameNotes,arrivalContact,teachingStart}:{}),...(admin?{rows,gatheringPageId:db.notionGatherings?.[e.id]}:{}),
 me:me?{status:me.status,pref:me.pref,wish:me.wish||'',table:qualified?me.table:'',
 cancellationRequested:!!me.cancellationRequestedAt,
 ...(companions.length?{companions}:{}),...(removedCompanions.length?{removedCompanions}:{}),
 ...(me.status==='候補'?{waitPosition:queue.indexOf(partyKey(me))+1}:{})}:null};
 })};
}
function timetable(b){
 const result={};for(const k of ['title','area','start','end','deadline'])result[k]=clean(b[k]);
 if(b.draft){
 assert(result.title&&Number.isFinite(time(result.start))&&(!result.end||time(result.start)<time(result.end))&&(!result.deadline||time(result.deadline)<=time(result.start)),'請確認草稿名稱與時間');
 return result;
 }
 assert(result.title&&result.area&&time(result.deadline)<=time(result.start)&&time(result.start)<time(result.end),'請確認名稱、地區與時間');return result;
}
function eventCapacity(value){
 const count=Number(value??6);
 assert(Number.isInteger(count)&&count>=1&&count<=9,'名額須為 1 至 9 位');
 return count;
}
function eventDetails(b){
 const details={};
 for(const field of ['featuredGame','backupGame','teachingMode','nearby','venueType']){
 if(Object.hasOwn(b,field))details[field]=clean(b[field],120);
 }
 if(Object.hasOwn(b,'teachingMinutes')){
 const minutes=Number(b.teachingMinutes||0);
 assert(Number.isInteger(minutes)&&minutes>=0&&minutes<=1440,'預估時間須為 0 至 1440 分鐘');
 details.teachingMinutes=minutes;
 }
 return details;
}
function importEvent(input){
 assert(input&&Array.isArray(input.rows)&&input.rows.length<=2000,'無效場次備份');
 const groups=new Map();
 const rows=input.rows.map(r=>{
 assert(r&&['正取','候補','取消'].includes(r.status)&&typeof r.uid==='string'&&typeof r.name==='string','備份名單無效');
 const result={id:randomUUID(),uid:r.uid,name:clean(r.name,40),status:r.status,pref:clean(r.pref),wish:clean(r.wish,300),at:clean(r.at),table:clean(r.table),attend:clean(r.attend),due:fee(r),paid:r.paid??0};
 if(typeof r.notionPlayerId==='string'&&/^[a-f0-9-]{36}$/.test(r.notionPlayerId))result.notionPlayerId=r.notionPlayerId;
 if(typeof r.groupId==='string'&&r.groupId){
 if(!groups.has(r.groupId))groups.set(r.groupId,randomUUID());
 result.groupId=groups.get(r.groupId);result.groupLeader=r.groupLeader===true;
 }
 assert([result.due,result.paid].every(n=>Number.isInteger(n)&&n>=0&&n<=100000),'備份金額無效');return result;
 });
 const seats=eventCapacity(input.capacity);
 assert(rows.filter(r=>r.status==='正取').length<=seats,'備份正取超過場次名額');
 for(const groupId of groups.values()){
 const group=rows.filter(r=>r.groupId===groupId);
 assert(group.length<=6&&group.filter(r=>r.groupLeader).length===1&&new Set(group.filter(r=>r.status!=='取消').map(r=>r.status)).size<=1,'團體備份名單無效');
 }
 return {...timetable({...input,draft:true}),...eventDetails(input),capacity:seats,title:clean('還原｜'+input.title),id:randomUUID(),draft:true,rows,reached:!!input.reached,published:!!input.published,done:!!input.done,closed:!!input.closed,address:clean(input.address),travel:clean(input.travel),arrivalContact:clean(input.arrivalContact),teachingStart:clean(input.teachingStart),gameNotes:clean(input.gameNotes,2000),log:[...(Array.isArray(input.log)?input.log.map(x=>clean(x)):[]),'自備份還原為獨立場次']};
}
function mutate(db,action,b,uid,admin){
 const now=Date.now();db.events.forEach(e=>cutoff(e,now));
 if(!admin&&!['profile','join','registration','requestCancellation','requestCompanionChange'].includes(action))fail('限主辦人操作',403);
 if(action==='invite'||action==='reissue'){
 const invite=key(),id=hash(invite),previous=db.members[b.uid];
 if(action==='reissue'){assert(previous?.active,'請選擇有效會員');previous.playerId??=randomUUID();db.members[id]=previous;delete db.members[b.uid];for(const e of db.events)for(const r of e.rows)if(r.uid===b.uid)r.uid=id}
 else{
 const notionPlayerId=clean(b.notionPlayerId,36).toLowerCase();
 if(notionPlayerId){
 assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(notionPlayerId),'請選擇有效玩家');
 assert(!Object.values(db.members).some(member=>member.notionPlayerId===notionPlayerId),'此玩家已有專屬邀請');
 }
 db.members[id]={name:clean(b.name,40)||'受邀玩家',active:true,playerId:randomUUID(),...(notionPlayerId?{notionPlayerId}:{})};
 if(notionPlayerId)attachReservedRows(db,id,notionPlayerId);
 }
 return {invite,recipient:db.members[id].name};
 }
 if(action==='restore'){const copy=importEvent(b.source);db.events.unshift(copy);return {selected:copy.id}}
 if(action==='syncNotion')return;
 if(action==='linkPlayer'){
 const member=db.members[b.uid];
 assert(member&&typeof b.notionPlayerId==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(b.notionPlayerId),'請選擇有效玩家');
 assert(!Object.values(db.members).some(other=>other!==member&&other.notionPlayerId===b.notionPlayerId),'此玩家已綁定另一個邀請身分');
 member.playerId??=randomUUID();
 member.notionPlayerId=b.notionPlayerId.toLowerCase();
 attachReservedRows(db,b.uid,member.notionPlayerId);
 return;
 }
 if(action==='deleteInvite'||action==='restoreInvite'){
 const member=db.members[b.uid];assert(member,'找不到邀請');
 if(action==='deleteInvite'){
 member.deletedAt??=new Date().toISOString();
 member.active=false;
 }else{
 assert(member.deletedAt,'邀請尚未刪除');
 const invite=key(),id=hash(invite);
 member.playerId??=randomUUID();delete member.deletedAt;member.active=true;
 db.members[id]=member;delete db.members[b.uid];
 for(const event of db.events)for(const row of event.rows)if(row.uid===b.uid)row.uid=id;
 return {invite,recipient:member.name};
 }
 return;
 }
 if(action==='member'){assert(db.members[b.uid]&&!db.members[b.uid].deletedAt,'找不到可操作的會員');db.members[b.uid].active=!!b.active;return}
 if(action==='catalog'){const games=[...new Set(String(b.games||'').split(/\r?\n/).map(x=>clean(x,120)).filter(Boolean))];assert(games.length<=2000,'清單上限 2000 款');db.catalog=games;return}
 if(action==='profile'){Object.assign(db.members[uid],{name:clean(b.name,40)||'玩家',contact:clean(b.contact),experience:clean(b.experience),pref:preferences(b),note:clean(b.note)});return}
 if(action==='create'){
 const seats=eventCapacity(b.capacity);
 let e={...timetable(b),...eventDetails(b),capacity:seats,id:randomUUID(),draft:!!b.draft,rows:[],log:[]};
 if(b.roster!==undefined){
 assert(e.draft&&Array.isArray(b.roster),'只能預填草稿名單');
 const ids=new Set(),at=new Date().toISOString();
 for(const attendee of b.roster){
 const name=clean(attendee.name,40),notionPlayerId=clean(attendee.notionPlayerId,36);
 const companions=attendee.companions??[];
 assert(name&&/^[a-f0-9-]{36}$/.test(notionPlayerId)&&!ids.has(notionPlayerId)&&Array.isArray(companions)&&companions.length<=5,'預填名單無效');
 ids.add(notionPlayerId);
 const uid=Object.keys(db.members).find(key=>db.members[key].notionPlayerId===notionPlayerId)||randomUUID();
 const groupId=companions.length?randomUUID():null;
 const names=[name,...companions.map(value=>clean(value,40))];
 assert(names.every(Boolean)&&e.rows.length+names.length<=seats,'預填名單超過場次名額');
 e.rows.push(...names.map((player,index)=>({id:randomUUID(),uid:index===0?uid:randomUUID(),name:player,pref:'',wish:'',status:'正取',at,paid:0,...(index===0?{notionPlayerId}:{}),...(groupId?{groupId,groupLeader:index===0}:{})})));
 }
 e.reached=e.rows.length>=4;
 }
 db.events.unshift(e);return {selected:e.id}
 }
 const e=db.events.find(v=>v.id===b.event);assert(e,'找不到場次');
 if(action==='edit'){
 const fields=timetable(b);
 const seats=eventCapacity(b.capacity??capacity(e));
 assert(positive(e).length<=seats&&waiting(e).every(row=>party(e,row).length<=seats),'名額不可少於已正取人數或既有候補團體');
 if(e.deadline!==fields.deadline)delete e.cutoff;
 if(e.start!==fields.start||e.end!==fields.end||e.area!==fields.area||b.draft){
 delete e.confirmed;delete e.published;
 }
 Object.assign(e,fields,eventDetails(b),{draft:!!b.draft,capacity:seats});e.log.push('活動資料已更新');return
 }
 assert(!(e.closed||e.done)||action==='account','本場已關閉');
 const active=positive(e),wait=waiting(e),row=e.rows.find(r=>r.id===b.row);
 if(action==='confirmEvent'){
 assert(!e.draft&&active.length>=4,'至少四位正取才能確認成團');
 if(!e.confirmed){e.confirmed=true;e.log.push('主辦人已確認成團')}
 return;
 }
 if(action==='requestCompanionChange'||action==='resolveCompanionChange'){
 const leader=row?.groupId?e.rows.find(entry=>entry.groupId===row.groupId&&entry.groupLeader):null;
 assert(!e.draft&&leader&&row!==leader&&row.status===leader.status&&row.status!=='取消'&&!leader.cancellationRequestedAt,'找不到可變更的同行者');
 const validateName=value=>{
 const name=clean(value,40);
 assert(typeof value==='string'&&value.trim().length<=40&&name,'請填寫有效的替補暱稱');
 assert(!party(e,leader).some(member=>member!==row&&member.name.normalize('NFKC').toLowerCase()===name.normalize('NFKC').toLowerCase()),'同團暱稱不可重複');
 return name;
 };
 if(action==='requestCompanionChange'){
 if(leader.uid!==uid&&!admin)fail('限該團主揪操作',403);
 assert(!row.changeRequest&&['remove','replace'].includes(b.kind),'已有待處理申請或操作無效');
 row.changeRequest={kind:b.kind,...(b.kind==='replace'?{name:validateName(b.name)}:{})};
 delete row.changeResult;
 }else{
 assert(row.changeRequest&&['approve','reject'].includes(b.decision),'找不到待處理申請');
 if(b.decision==='approve'){
 if(row.changeRequest.kind==='remove'){row.status='取消';row.cancelledAt=new Date().toISOString();row.due=0}
 else{
 const name=validateName(row.changeRequest.name);
 assert(row.paid===0&&!row.attend,'已有收款或出席紀錄，請先處理再換人');
 row.name=name;
 }
 }
 delete row.changeRequest;
 row.changeResult=b.decision;
 }
 return;
 }
 if(action==='join'||action==='guest'){
 assert(!e.draft&&now<time(e.deadline),'報名已截止');
 const who=action==='join'?uid:randomUUID();assert(!e.rows.some(r=>r.uid===who&&r.status!=='取消'),'你已報名');
 const name=action==='join'?db.members[uid]?.name:clean(b.name,40);assert(name,'請填寫暱稱');
 const supplied=action==='join'?b.companions:undefined;
 assert(supplied===undefined||(Array.isArray(supplied)&&supplied.length<=5&&supplied.every(value=>typeof value==='string'&&value.trim()&&value.trim().length<=40)),'最多可填五位同行者，每個暱稱須為 1 至 40 字');
 const names=[name,...(supplied||[]).map(value=>clean(value,40))];
 assert(names.length<=capacity(e),'團體人數超過本場名額');
 assert(new Set(names.map(value=>value.normalize('NFKC').toLowerCase())).size===names.length,'同團暱稱不可重複');
 const groupId=names.length>1?randomUUID():null;
 const common={pref:preferences(b),wish:clean(b.wish,300),status:active.length+names.length<=capacity(e)&&!wait.length?'正取':'候補',at:new Date().toISOString(),paid:0};
 e.rows.push(...names.map((member,index)=>({id:randomUUID(),uid:index===0?who:randomUUID(),name:member,...common,...(groupId?{groupId,groupLeader:index===0}:{})})));
 }else if(action==='registration'||action==='requestCancellation'){
 const r=e.rows.findLast(r=>r.uid===uid&&r.status!=='取消');assert(r&&!e.draft,'無可修改的報名');
 if(action==='requestCancellation')r.cancellationRequestedAt??=new Date().toISOString();
 else{const pref=preferences(b),wish=clean(b.wish,300);for(const member of party(e,r)){member.pref=pref;member.wish=wish}}
 }
 else if(action==='cancel'){
 assert(row&&row.status!=='取消'&&(!row.groupId||row.groupLeader),'請由主揪的報名紀錄取消');
 for(const member of party(e,row)){member.status='取消';member.cancelledAt=new Date().toISOString();member.due=0;delete member.cancellationRequestedAt;delete member.changeRequest}
 }
 else if(action==='promote'){
 assert(row&&row===wait[0]&&!row.cancellationRequestedAt,'請依候補順序遞補，先處理取消申請');
 const group=party(e,row);
 assert(active.length+group.length<=capacity(e),'空位不足，請等候整團可入席');
 assert(!group.some(member=>member.changeRequest),'請先處理同行變更申請');
 for(const member of group){member.status='正取';delete member.due}
 }
 else if(action==='publish'){assert(clean(b.address)&&active.every(r=>clean(b.tables?.[r.id])),'請填寫集合地址及各席分桌');Object.assign(e,{published:true,address:clean(b.address),travel:clean(b.travel),gameNotes:clean(b.gameNotes,2000)});for(const field of ['arrivalContact','teachingStart'])if(Object.hasOwn(b,field))e[field]=clean(b[field]);for(const r of active)r.table=clean(b.tables[r.id]);e.log.push('集合地址與分桌已公布')}
 else if(action==='account'){assert(row,'找不到玩家');const due=Number(b.due),paid=Number(b.paid);assert([due,paid].every(n=>Number.isInteger(n)&&n>=0&&n<=100000),'金額無效');Object.assign(row,{due,paid,attend:clean(b.attend)})}
 else if(action==='stop'){e.closed=true;e.log.push('活動已停辦')}
 else if(action==='finish')e.done=true;
 else fail('未知操作');
 if(positive(e).length>=4)e.reached=true;
}
// Storage is injected so authorization can be exercised independently of Blob.
export function clubHandler(path,storage,{records,defer}={}){
 const {get,put}=storage;
 const load=async()=>{
 const loaded=await get(path,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});
 if(!loaded)fail('團務資料不存在，請聯絡管理者',503);
 return {db:JSON.parse(await new Response(loaded.stream).text()),etag:loaded.blob.etag.replace(/^W\//,'').replace(/-(gzip|br)(?="?$)/,'')};
 };
 const save=async({db,etag})=>{
 try{await put(path,JSON.stringify(db),{access:'private',addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json'});return true}
 catch(err){if(/precondition|etag|already exists|condition.*fail/i.test(err.name+' '+err.message))return false;throw err}
 };
 const sync=db=>{
 if(records&&defer&&Object.keys(db.notionPending??{}).length)
 defer((async()=>{
 const deadline=Date.now()+18000;
 while(Date.now()<deadline&&await flushNotionMeeting({load,save,records})==='progress'){}
 })().catch(error=>console.error('Meeting Notion sync deferred',error.message)));
 };
 return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 try{
 const b=req.body||{},action=req.method==='GET'?'read':b.action;
 if(!['GET','POST'].includes(req.method))fail('方法不支援',405);
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail('來源無效',403);
 if(['rotate','recover'].includes(action))fail('主辦人金鑰功能已停用，請由桌遊清單管理員登入',410);
 const secret=process.env.MEETING_ADMIN_BRIDGE_SECRET;
 const supplied=req.headers['x-meeting-admin'];
 const admin=!!secret&&typeof supplied==='string'&&Buffer.byteLength(secret)===Buffer.byteLength(supplied)&&timingSafeEqual(Buffer.from(secret),Buffer.from(supplied));
 const token=action==='login'?b.key:(req.headers.cookie||'').match(/(?:^|; *)club=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!admin&&!validKey(token))fail('請輸入個人邀請碼',401);
 const uid=validKey(token)?hash(token):'',session=k=>res.setHeader('Set-Cookie','club='+k+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+(k?2592000:0));
 for(let attempt=0;attempt<6;attempt++){
 const loaded=await load(),{db}=loaded;
 if(!admin&&!db.members[uid]?.active)fail('邀請碼無效或已停用',401);
 if(action==='logout'){session('');return res.json({ok:true})}
 if(action==='login'||action==='read'||action==='backup'){if(action==='backup'&&!admin)fail('限主辦人操作',403);db.events.forEach(e=>cutoff(e,Date.now()));if(action==='login')session(token);sync(db);
 return res.json(action==='backup'?{version:1,events:db.events,catalog:db.catalog||[],members:db.members}:project(db,admin,uid))}
 const before=records?new Map(db.events.map(event=>[event.id,structuredClone(event)])):null;
 const extra=mutate(db,action,b,uid,admin);
 if(before){
 for(const event of db.events)queueNotionEvent(db,event,action==='syncNotion'?undefined:before.get(event.id));
 if(action==='linkPlayer')queueLinkedPlayer(db,b.uid);
 }
 if(!await save(loaded)){
 if(attempt<5){await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)+Math.random()*70));continue;}
 fail('名單剛更新，請重新整理後再操作',409);
 }
 sync(db);
 return res.json({...project(db,admin,uid),...extra})
 }
 }catch(err){res.status(err.status||503).json({error:err.status?err.message:'資料服務暫時無法使用'})}
 };
}
