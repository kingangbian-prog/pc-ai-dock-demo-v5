export const RESOURCES=[{id:'brief',name:'/模拟项目/需求简报.md',purpose:'理解需求',mode:'只读'},{id:'notes',name:'/模拟项目/研究笔记.md',purpose:'交叉核对',mode:'只读'},{id:'folder',name:'/模拟项目/*',purpose:'可选补充资料',mode:'可写（范围过宽）'},{id:'extra',name:'/模拟项目/补充数据.csv',purpose:'新增数据核验',mode:'只读'},{id:'publish',name:'模拟对外发布',purpose:'发布摘要',mode:'对外传输（高风险）'}];
export function permissionState(task){return task.permission||{grants:[],expires:0,step:0,log:[],pending:null,reason:'尚未访问模拟资源',narrow:false};}
export function risk(p,now=Date.now()){if(p.pending||p.reason==='已拒绝'||p.reason==='已撤回'||(p.grants.length&&p.expires<=now))return ['red',p.expires<=now&&p.grants.length?'授权已到期，访问阻止':p.reason];if(p.grants.includes('folder'))return ['yellow','建议收窄为两份只读文件'];if(p.grants.length)return ['green','当前动作在授权范围'];return ['yellow','尚未访问，开始前确认范围'];}
export function permissionEvent(task,event,now=Date.now()) {const t=structuredClone(task),p=t.permission=structuredClone(permissionState(task));const request=(ids,reason)=>{p.pending=ids;p.reason=reason;};
if(event.op==='start'){if(!p.grants.length||p.expires<=now)request(['brief','notes'],'等待任务授权');else p.log.push('复用有效任务授权，无需重复确认');}
if(event.op==='narrow'){p.narrow=true;p.grants=p.grants.filter(x=>x==='brief');if(p.pending)p.pending=p.pending.filter(x=>x==='brief'||x==='publish');p.reason=p.grants.length?'已收窄为仅需求简报':'已收窄，等待确认';}
if(event.op==='allow'&&p.pending){const ids=p.pending;p.grants=[...new Set([...p.grants,...ids.filter(x=>x!=='publish')])];p.expires=now+600000;p.pending=null;p.reason='已授权';p.log.push(ids.includes('publish')?'已单次确认并完成模拟发布；未授予后续发布权限':'已授权本任务所列资源，10分钟有效');}
if(event.op==='deny'){p.pending=null;p.reason='已拒绝';p.log.push('拒绝：依赖访问保持暂停，未执行');}
if(event.op==='revoke'){p.grants=[];p.expires=0;p.pending=null;p.reason='已撤回';p.log.push('已收回后续访问，已有结果保留');}
if(event.op==='expire'){p.expires=now-1;p.reason='已到期';}
if(event.op==='expand')request(['extra'],'新增文件需要你决定');
if(event.op==='high')request(['publish'],'高风险对外传输需逐次确认');
if(event.op==='next'){const id=p.step%2?'notes':'brief';if(p.pending||!p.grants.includes(id)||p.expires<=now||['已拒绝','已撤回'].includes(p.reason))request([id],'访问被阻止，等待重新授权');else{p.step++;p.log.push(`步骤 ${p.step}：读取${id==='brief'?'需求简报':'研究笔记'}（模拟），复用授权`);}}
if(event.op==='independent')p.log.push('无资源访问的排版步骤完成；不受文件授权影响');
return t;}
