import {activityRevision,ensureLiveState} from './activity.mjs';
export const IDEA_NODES=Object.freeze([
 {id:'demo-idea-local-context',name:'构筑本地context'},
 {id:'demo-idea-live-hanger',name:'AI实况窗晾衣架'},
 {id:'demo-idea-ai-screen',name:'AI屏'},
 {id:'demo-idea-personal-agent',name:'懂你的Agent'},
]);
export function ensureIdeaNodes(state){
 const existing=Array.isArray(state.ideas)?state.ideas:[],ids=new Set(existing.map(i=>i.id)),names=new Set(existing.map(i=>i.name));
 const additions=IDEA_NODES.filter(i=>!ids.has(i.id)&&!names.has(i.name)).map(i=>({...i}));
 const ideas=additions.length?[...existing,...additions]:existing;
 const invalid=state.selectedIdea&&!ideas.some(i=>i.id===state.selectedIdea);
 if(Array.isArray(state.ideas)&&!additions.length&&!invalid)return state;
 return {...state,ideas,...(invalid?{selectedIdea:null}:{})};
}
export function ideaChannel(id){return id?'idea-'+id:'ideas';}
export const STORAGE_KEY = 'ai-dock-prototype-v5';
export const AGENTS = {
  xiaoyi:{name:'小艺',selectorLabel:'小艺',icon:'ring',color:'xiaoyi',role:'协调与确认'},
  research:{name:'Workbuddy',short:'Workbuddy',selectorLabel:'WB',taskType:'研究',icon:'workbuddy',color:'research',role:'寻找线索，建立判断'},
  writer:{name:'千问',short:'千问',selectorLabel:'千问',taskType:'写作',icon:'qianwen',color:'writer',role:'把思考整理成文字'},
  design:{name:'豆包工作',short:'豆包工作',selectorLabel:'豆包',taskType:'设计',icon:'doubao',color:'design',role:'让想法清晰可见'},
  code:{name:'ChatGPT',short:'ChatGPT',selectorLabel:'GPT',taskType:'代码',icon:'chatgpt',color:'code',role:'把方案变成原型'},
};
export const AGENT_ORDER=['research','writer','design','code'];
const HOVER_DEMOS={
 research:[['capabilities','桌面助手能力地图','done','已整理三类模拟协作能力'],['sources','交互资料速览','running','正在比较模拟资料中的交互差异'],['outline','研究问题清单','done','已归纳本次模拟研究问题']],
 writer:[['outline','发布文案提纲','running','正在梳理模拟发布文案层次'],['notes','会议纪要整理','done','已整理模拟会议的行动条目'],['review','简报文字校对','running','正在检查模拟简报的用词']],
 design:[['icons','状态图标探索','running','正在比较三组模拟状态图标'],['permission','授权弹层方案','done','已整理模拟授权弹层结构'],['layout','任务卡片排版','running','正在检查模拟卡片的层次']],
 code:[['interaction','Dock 交互检查','running','正在检查模拟点击和切换行为'],['structure','本地页面结构','done','已整理本地演示页面结构'],['accessibility','键盘路径检查','running','正在检查模拟键盘导航路径']],
};
// Fill only missing demo slots; never replace or edit an existing task or document.
export function ensureAgentDemoTasks(state){
 const additions=[],ids=new Set(state.tasks.map(t=>t.id));
 for(const agent of AGENT_ORDER){
  let count=state.tasks.filter(t=>t.agent===agent).length;
  for(const [key,title,status,step] of HOVER_DEMOS[agent]){
   if(count>=3)break;
   const id=`demo-hover-${agent}-${key}`;if(ids.has(id))continue;
   const goal=state.goals.find(g=>g.id===(agent==='code'?'launch':'desktop'))?.id||state.goals[0]?.id;
   if(!goal)continue;
   additions.push({id,agent,goal,title,status,step,detail:step,dueAt:null,demo:true});ids.add(id);count++;
  }
 }
 if(!additions.length)return state;
 return {...state,tasks:[...state.tasks,...additions]};
}
const LEGACY_AGENT_NAMES={'研究 Agent':'Workbuddy','写作 Agent':'千问','设计 Agent':'豆包工作','代码 Agent':'ChatGPT'};
function renameGeneratedText(text){
  if(typeof text!=='string')return text;
  const marker='收到模拟补充：',index=text.indexOf(marker);
  const prefix=index<0?text:text.slice(0,index+marker.length),suffix=index<0?'':text.slice(index+marker.length);
  return Object.entries(LEGACY_AGENT_NAMES).reduce((s,[from,to])=>s.replaceAll(from,to),prefix)+suffix;
}
export function migrateAgentIdentity(state){
  if(state.agentIdentityVersion===2)return state;
  const s=structuredClone(state);s.agentIdentityVersion=2;
  for(const t of s.tasks){t.step=renameGeneratedText(t.step);t.detail=renameGeneratedText(t.detail);}
  for(const goal of s.goals)for(const m of goal.messages||[])if(m.role!=='user')m.text=renameGeneratedText(m.text);
  for(const messages of Object.values(s.channels||{}))for(const m of messages)if(m.role!=='user')m.text=renameGeneratedText(m.text);
  if(s.session?.log)s.session.log=s.session.log.map(text=>text.startsWith('继续执行：')?text:renameGeneratedText(text));
  return s;
}
export const ORDINARY_APPS = ['files','browser','editor','mail','calendar','photos','settings'];
export const APP_NAMES = {files:'文件',browser:'浏览器',editor:'Office Word',mail:'邮件',calendar:'日历',photos:'相册',settings:'设置'};
export const CONNECTIONS = {mail:'邮箱',computer:'Computer Use',wechat:'微信',feishu:'飞书'};
export function seedState() {
  return ensureAgentDemoTasks({
    schema:1,liveStyle:'capsule',liveDismissals:{}, ideas:IDEA_NODES.map(i=>({...i})),selectedIdea:null,ideaOpen:false,ideasCollapsed:false,goalsCollapsed:false, connectCollapsed:false, agentIdentityVersion:2, serial:10, mode:'ai', selectedGoal:'desktop',
    goals:[
      {id:'desktop',name:'桌面 AI 体验研究',subtitle:'为下周评审，准备一份有依据的交互简报。',messages:[
        {role:'user',text:'研究桌面 AI 助手的交互方式，整理一份评审简报。',time:'10:20'},
        {role:'bot',text:'我把工作拆成了研究和写作。你可以继续自己的工作，重要的进展会留在这里。',time:'10:20'},
        {role:'handoff',text:'Workbuddy 正在查阅模拟资料；千问 已保存第一版简报。',time:'10:24'}]},
      {id:'launch',name:'新品发布计划',subtitle:'从一份想法，走到可以讨论的发布方案。',messages:[{role:'user',text:'先保留一个小范围发布的方向，下次继续。',time:'昨天'},{role:'bot',text:'已记在这个目标里。以后回到这里，可以接着上次的思路继续。',time:'昨天'}]},
    ],
    channels:{ideas:[{role:'bot',text:'零散的想法也值得留下。这里的会话只保存在本机。',time:'现在'}]},
    tasks:[
      {id:'research-main',source:'bot',agent:'research',goal:'desktop',title:'竞品交互研究',status:'running',step:'正在浏览桌面 AI 交互样例',detail:'正在模拟浏览竞品交互资料',kind:'computer'},
      {id:'research-input',agent:'research',goal:'desktop',title:'发布渠道建议',status:'input',step:'等待你选择目标用户',detail:'需要选择这次研究的目标用户'},
      {id:'writer-draft',source:'bot',agent:'writer',goal:'desktop',title:'评审简报初稿',status:'result',step:'第一版简报已保存，等待查看',detail:'评审简报初稿已就绪',unread:true,outputId:'output-seed'},
      {id:'design-flow',agent:'design',goal:'desktop',title:'交互流程图',status:'failed',step:'模拟素材解析失败，可重试',detail:'模拟素材解析失败，可重试'},
      {id:'xiaoyi-auth',agent:'xiaoyi',goal:'desktop',title:'演示资料整理',status:'auth',step:'等待授权读取模拟资料',detail:'需要你确认本次模拟资料访问'},
      {id:'code-plan',agent:'code',goal:'launch',title:'发布页结构草案',status:'running',step:'正在整理本地演示页面结构',detail:'正在整理发布页结构',dueAt:null},
    ],
    outputs:[{id:'output-seed',goal:'desktop',task:'writer-draft',version:1,title:'桌面 AI 交互评审简报',created:'10:24',content:'桌面 AI 交互评审简报\n\n一、核心判断\nAI 应当融入已有的工作节奏。普通应用的位置保持稳定，任务的状态与控制权始终清晰。\n\n二、交互建议\n1. 固定 Agent，同一 Agent 展开多项任务。\n2. 把运行中、等待确认、结果待查看和执行失败分开。\n3. Computer Use 先暂停并收到确认，再交给人操作；交还后沿用同一会话。\n\n三、下一步\n用模拟任务验证切换成本、状态可读性与草稿连续性。\n\n本文为交互原型的演示内容，未经真实研究或发布。'}],
    drafts:{personal:{title:'新品发布计划',text:'新品发布计划\n\n一、项目背景\n让新的能力自然出现在熟悉的工作里。\n\n二、目标与定位\n从少量种子用户开始，先验证体验，再逐步迭代。\n\n三、我的工作笔记\n这是一份可以持续编辑的本地草稿。'}},
    session:{id:'cu-session-001',task:'research-main',agent:'research',goal:'desktop',phase:'agent',controller:'agent',contextVersion:1,manualText:'对比重点：任务状态是否清晰、人工接管是否顺畅。',context:'对比重点：任务状态是否清晰、人工接管是否顺畅。',log:['Workbuddy 启动模拟浏览器','正在查阅本地竞品演示页'],dueAt:null},
  });
}
export function hoverDetail(task) { return Array.from(task.detail || task.step).slice(0,26).join(''); }
export function statusInfo(task) {
  if (task.status === 'result') return task.unread ? ['结果待查看','green','check'] : ['已查看','muted','check'];
  return ({running:['运行中','blue','clock'],auth:['待授权','yellow','shield'],input:['需要输入','yellow','chat'],failed:['执行失败','red','alert'],pausing:['等待暂停确认','yellow','pause'],paused:['已暂停','muted','pause'],resuming:['等待交还确认','blue','refresh'],done:['已完成','muted','check']})[task.status] || ['已记录','muted','clock'];
}
function message(s, goal, role, text, now) {
  const g=s.goals.find(g=>g.id===goal);
  g?.messages.push({role,text,time:new Date(now).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})});
}
function complete(s, task, content, now) {
  const version=s.outputs.filter(o=>o.goal===task.goal).length+1;
  const id=`output-${++s.serial}`;
  s.outputs.push({id,goal:task.goal,task:task.id,version,title:task.title,created:new Date(now).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}),content});
  Object.assign(task,{status:'result',unread:true,outputId:id,dueAt:null,step:'结果已保存，等待你查看',detail:'新的任务结果已就绪'});
  message(s,task.goal,'handoff',`${AGENTS[task.agent].name} 已保存「${task.title}」· 版本 ${version}。`,now);
}
export function reduce(state, event, now=Date.now()) {
  const s=structuredClone(state);
  const t=s.tasks.find(t=>t.id===event.task);
  const cu=s.session;
  switch(event.type) {
    case 'LIVE_STYLE': if(!['capsule','hanger'].includes(event.style))return state;s.liveStyle=event.style;break;
    case 'DISMISS_LIVE_CARD': if(!t)return state;s.liveDismissals??={};s.liveDismissals[t.id]=activityRevision(t);break;
    case 'RESTORE_LIVE_CARDS': s.liveDismissals={};break;
    case 'MODE': s.mode=event.mode==='normal'?'normal':'ai'; break;
    case 'IDEA_SELECT': if(event.idea!=null&&!s.ideas?.some(i=>i.id===event.idea))return state;s.selectedIdea=event.idea??null;s.ideaOpen=true;if(event.expand)s.ideasCollapsed=false;break;
    case 'IDEA_LEAVE': s.ideaOpen=false;break;
    case 'TOGGLE_IDEAS': s.ideasCollapsed=!s.ideasCollapsed;break;
    case 'TOGGLE_GOALS': s.goalsCollapsed=!s.goalsCollapsed;break;
    case 'TOGGLE_CONNECT': s.connectCollapsed=!s.connectCollapsed;break;
    case 'GOAL': if(s.goals.some(g=>g.id===event.goal)){s.selectedGoal=event.goal;s.ideaOpen=false;} break;
    case 'SEND': {
      const text=String(event.text||'').trim();
      if(!text || !s.goals.some(g=>g.id===event.goal)) return state;
      s.ideaOpen=false;message(s,event.goal,'user',text,now);
      const chosen=AGENTS[event.agent]?event.agent:'xiaoyi';
      message(s,event.goal,'bot',['xiaoyi','research'].includes(chosen)?'我会先交给Workbuddy，再请千问 整理成草稿。任务和输出都留在当前目标。':`已交给${AGENTS[chosen].name}，任务和输出都会保留在当前目标。`,now);
      const id=`research-${++s.serial}`;
      const agent=['xiaoyi','research'].includes(chosen)?'research':chosen;
      s.tasks.push({id,agent,goal:event.goal,title:(AGENTS[agent].taskType||'任务')+'：'+text.slice(0,18),command:text,status:'running',step:agent==='research'?'正在整理问题与模拟研究线索':'正在整理这条指令的模拟输出',detail:`${AGENTS[agent].name}正在处理模拟指令`,workflow:id,stage:agent==='research'?'research':agent==='writer'?'writing':'direct',dueAt:now+2600,requestedBy:chosen,source:event.source|| (chosen==='xiaoyi'?'bot':'manual')});
      break;
    }
    case 'CHANNEL_SEND': {
      const text=String(event.text||'').trim(); if(!text) return state;
      s.channels[event.channel]??=[];
      s.channels[event.channel].push({role:'user',text,time:'现在'},{role:'bot',text:(event.channel==='ideas'||event.channel.startsWith('idea-'))?'想法已保存在本机会话中。':'已记录这条演示消息。此连接未接入真实账号，不会发送或读取外部资料。',time:'现在'}); break;
    }
    case 'SUPPLEMENT_TASK': {
      const text=String(event.text||'').trim();if(!t||!text)return state;
      t.instructions??=[];t.instructions.push({text,time:new Date(now).toISOString()});
      message(s,t.goal,'handoff',`${AGENTS[t.agent].name} · ${t.title} 收到模拟补充：${text}`,now);
      break;
    }
    case 'VIEW': if(t?.status==='result') t.unread=false; break;
    case 'VIEW_OUTPUT': {const o=s.outputs.find(o=>o.id===event.output);const task=s.tasks.find(t=>t.id===o?.task);if(task?.status==='result')task.unread=false;break;}
    case 'DISMISS_TASK_HOVER': if(t)t.hoverHidden=true;break;
    case 'OPEN_DRAFT': {
      const o=s.outputs.find(o=>o.id===event.output); if(!o)return state;
      s.drafts[o.id]??={title:o.title,text:o.content};
      const task=s.tasks.find(t=>t.id===o.task); if(task){task.unread=false;task.hoverHidden=false;} break;
    }
    case 'EDIT_DRAFT': if(s.drafts[event.id])s.drafts[event.id].text=String(event.text);break;
    case 'AUTHORIZE': if(t?.status==='auth') Object.assign(t,event.allow?{status:'running',stage:'authorization',step:'本次模拟授权已确认，正在整理资料',detail:'已确认授权，正在整理演示资料',dueAt:now+2000}:{status:'paused',step:'你拒绝了本次模拟授权，任务已暂停',detail:'本次模拟授权被拒绝',denied:true});break;
    case 'REAUTHORIZE': if(t?.denied){Object.assign(t,{status:'auth',denied:false,step:'等待你重新确认本次模拟授权',detail:'等待重新确认本次模拟授权'});}break;
    case 'INPUT': if(t?.status==='input' && ['专业用户','个人用户'].includes(event.choice))Object.assign(t,{status:'running',stage:'input',choice:event.choice,step:`已采用「${event.choice}」，正在整理建议`,detail:'已补充目标用户，继续整理建议',dueAt:now+2100});break;
    case 'RETRY': if(t?.status==='failed')Object.assign(t,{status:'running',stage:'retry',step:'正在重新解析模拟素材',detail:'正在重试模拟素材解析',dueAt:now+2200});break;
    case 'TAKEOVER': if(cu?.phase==='agent'){Object.assign(cu,{phase:'requesting_human',dueAt:now+1400}); const ct=s.tasks.find(t=>t.id===cu.task);Object.assign(ct,{status:'pausing',step:'暂停请求已发出，等待 Agent 确认',detail:'已请求暂停，等待 Agent 确认'});cu.log.push('用户请求接管；当前仍由 Agent 控制');}break;
    case 'MANUAL_EDIT': if(cu?.phase==='human' && String(event.text||'').trim()){cu.manualText=String(event.text).trim();cu.contextVersion++;cu.log.push(`你保存了模拟页面 · 上下文 v${cu.contextVersion}`);}break;
    case 'HANDBACK': if(cu?.phase==='human'){Object.assign(cu,{phase:'requesting_agent',dueAt:now+1400});const ct=s.tasks.find(t=>t.id===cu.task);Object.assign(ct,{status:'resuming',step:'等待 Agent 确认接收最新上下文',detail:'正在交还，等待 Agent 确认'});cu.log.push('你请求交还；正在同步最新页面上下文');}break;
    case 'TICK': {
      if(cu?.dueAt && now>=cu.dueAt){
        const ct=s.tasks.find(t=>t.id===cu.task);
        if(cu.phase==='requesting_human'){
          Object.assign(cu,{phase:'human',controller:'human',dueAt:null});
          Object.assign(ct,{status:'paused',step:'暂停已确认，你可以编辑模拟页面',detail:'暂停已确认，当前由你控制'});
          cu.log.push('Agent ACK：已暂停；控制权已交给你');
        }else if(cu.phase==='requesting_agent'){
          Object.assign(cu,{phase:'agent',controller:'agent',context:cu.manualText,dueAt:now+1800,continuing:true});
          Object.assign(ct,{status:'running',step:`已接收上下文 v${cu.contextVersion}，继续原任务`,detail:'Agent 已接回控制，继续同一任务'});
          cu.log.push(`Agent ACK：采用上下文 v${cu.contextVersion}；同一会话恢复`);
        }else if(cu.continuing){
          cu.dueAt=null;cu.continuing=false;ct.step='正在依据你的修改整理对比结论';cu.log.push(`继续执行：${cu.context}`);
        }
      }
      const due=s.tasks.filter(t=>t.dueAt && now>=t.dueAt && t.status==='running');
      for(const task of due){
        if(task.stage==='research'){
          Object.assign(task,{status:'done',step:'模拟研究完成，已交给千问',detail:'研究完成，已交给千问',dueAt:null});
          s.tasks.push({id:`writer-${++s.serial}`,agent:'writer',goal:task.goal,title:'简报：'+task.command.slice(0,18),command:task.command,status:'running',step:'正在把研究结论整理成草稿',detail:'千问 正在整理研究草稿',stage:'writing',dueAt:now+2400,workflow:task.workflow,source:task.source});
          message(s,task.goal,'handoff','Workbuddy → 千问：模拟研究线索已交接，目标归属保持不变。',now);
        }else{
          const content=task.stage==='writing'?`${task.title}\n\n你的指令\n${task.command}\n\n研究摘要（模拟）\n1. 任务需要明确归属到目标，保持会话的连续性。\n2. 交互状态应能说明当前步骤和下一步需要谁操作。\n3. 自动化暂停与控制权转移需要明确确认。\n\n建议\n先验证最小闭环，再逐步补充实际服务。\n\n这是本地原型生成的模拟结果，未调用真实 Agent，也未发布。`:`${task.title}\n\n${task.choice?'目标用户：'+task.choice+'\n\n':''}本次模拟已完成。建议保留清晰的任务归属、确认步骤与可继续编辑的输出。\n\n这是本地交互演示数据，未读取真实资料。`;
          complete(s,task,content,now);
        }
      }
      if(JSON.stringify(s)===JSON.stringify(state))return state;
      break;
    }
    default:return state;
  }
  return s;
}
export function loadState(storage) {
  try{const s=JSON.parse(storage.getItem(STORAGE_KEY));if(s?.schema===1 && Array.isArray(s.tasks)&&Array.isArray(s.goals)&&s.drafts&&s.session){const next={...ensureLiveState(ensureIdeaNodes(ensureAgentDemoTasks(migrateAgentIdentity(s)))),liveStyle:"capsule",liveDismissals:{}};if(next!==s)saveState(storage,next);return next;}}catch{}
  return seedState();
}
export function saveState(storage,state) { try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;} }

export function goalAgents(state,goal){return [...new Set(state.tasks.filter(t=>t.goal===goal&&AGENTS[t.agent]).map(t=>t.agent))];}
// Notifications describe attention already required by simulated tasks; reading them cannot advance work.
export function notificationTasks(state){
 const priority={auth:0,input:1,failed:2,result:3};
 return state.tasks.filter(t=>['auth','input','failed'].includes(t.status)||(t.status==='result'&&t.unread)).slice().sort((a,b)=>priority[a.status]-priority[b.status]);
}
