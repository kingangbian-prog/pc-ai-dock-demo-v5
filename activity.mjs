const PRIORITY={auth:0,input:1,result:2,failed:3,running:4,pausing:0,paused:5,resuming:4};
export function activityRevision(task){return `${task.status}:${task.outputId||''}`;}
export function activityTasks(state,{includeDismissed=false}={}){
 return state.tasks.filter(t=>['auth','input','failed','running','pausing','resuming'].includes(t.status)||(t.status==='paused'&&t.id===state.session?.task)||(t.status==='result'&&t.unread)).filter(t=>includeDismissed||state.liveDismissals?.[t.id]!==activityRevision(t)).slice().sort((a,b)=>(PRIORITY[a.status]??6)-(PRIORITY[b.status]??6));
}
export function hiddenActivityCount(state){return activityTasks(state,{includeDismissed:true}).length-activityTasks(state).length;}
export function activityRepresentatives(state){const result=[];for(const t of activityTasks(state))if(!result.some(x=>x.agent===t.agent))result.push(t);return result.slice(0,5);}
export function ensureLiveState(state){if(['hanger','capsule'].includes(state.liveStyle)&&state.liveDismissals&&typeof state.liveDismissals==='object'&&!Array.isArray(state.liveDismissals))return state;return {...state,liveStyle:['hanger','capsule'].includes(state.liveStyle)?state.liveStyle:'hanger',liveDismissals:state.liveDismissals&&typeof state.liveDismissals==='object'&&!Array.isArray(state.liveDismissals)?state.liveDismissals:{}};}
export function activityAction(task){if(task.status==='failed')return {kind:'retry',label:'重试这项任务'};if(task.status==='result'&&task.outputId)return {kind:'output',label:'打开输出文档'};if(task.kind==='computer')return {kind:'computer',label:'查看电脑操作'};return {kind:'task',label:task.status==='auth'?'查看并确认':task.status==='input'?'补充任务信息':'查看任务进度'};}
