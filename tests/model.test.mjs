import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,reduce,hoverDetail,ORDINARY_APPS,loadState,saveState,STORAGE_KEY} from '../model.mjs';
const start=100000;
const apply=(s,e,time=start)=>reduce(s,e,time);
const task=(s,id)=>s.tasks.find(t=>t.id===id);

test('empty sends cannot create tasks or messages',()=>{
 const s=seedState();assert.equal(apply(s,{type:'SEND',text:'  ',goal:'desktop'}),s);
 assert.equal(apply(s,{type:'SEND',text:'hello',goal:'unknown'}),s);
});
test('goal-scoped research hands to writing, then retains an output version',()=>{
 let s=seedState();const other=structuredClone(s.goals[0]);
 s=apply(s,{type:'SEND',goal:'launch',text:'为发布计划整理研究简报',agent:'xiaoyi'});
 const r=s.tasks.at(-1);assert.equal(r.agent,'research');assert.equal(r.goal,'launch');
 s=apply(s,{type:'TICK'},start+2600);
 const w=s.tasks.at(-1);assert.equal(w.agent,'writer');assert.equal(w.workflow,r.id);assert.equal(w.goal,'launch');
 assert.equal(task(s,r.id).status,'done');
 s=apply(s,{type:'TICK'},start+5000);
 const o=s.outputs.at(-1);assert.equal(o.goal,'launch');assert.equal(o.version,1);assert.equal(task(s,w.id).unread,true);
 assert.deepEqual(s.goals[0],other);
});
test('agent selector routes a direct writing request to the selected Agent',()=>{
 const s=apply(seedState(),{type:'SEND',goal:'desktop',text:'改写一段开场白',agent:'writer'});
 assert.equal(s.tasks.at(-1).agent,'writer');assert.equal(s.tasks.at(-1).requestedBy,'writer');
});
test('pause requires ACK; repeated requests cannot create a second controller',()=>{
 let s=apply(seedState(),{type:'TAKEOVER'});
 assert.equal(s.session.phase,'requesting_human');assert.equal(s.session.controller,'agent');
 assert.equal(task(s,'research-main').status,'pausing');
 const deadline=s.session.dueAt;
 s=apply(s,{type:'TAKEOVER'},start+700);assert.equal(s.session.dueAt,deadline);
 const before=s.session.manualText;s=apply(s,{type:'MANUAL_EDIT',text:'not allowed'});assert.equal(s.session.manualText,before);
 s=apply(s,{type:'TICK'},start+1399);assert.equal(s.session.controller,'agent');
 s=apply(s,{type:'TICK'},start+1400);assert.equal(s.session.controller,'human');assert.equal(s.session.phase,'human');
 assert.equal(task(s,'research-main').status,'paused');
});
test('manual edit and handback use the same session/task and refreshed context after ACK',()=>{
 let s=apply(seedState(),{type:'TAKEOVER'});s=apply(s,{type:'TICK'},start+1400);
 const id=s.session.id,tid=s.session.task;
 s=apply(s,{type:'MANUAL_EDIT',text:'重点补充：检查人工接管的可恢复性。'});
 assert.equal(s.session.contextVersion,2);assert.notEqual(s.session.context,s.session.manualText);
 s=apply(s,{type:'HANDBACK'},start+2000);assert.equal(s.session.controller,'human');assert.equal(s.session.phase,'requesting_agent');
 const snapshot=s.session.manualText;s=apply(s,{type:'MANUAL_EDIT',text:'pending cannot mutate'});assert.equal(s.session.manualText,snapshot);
 s=apply(s,{type:'HANDBACK'},start+2300);assert.equal(s.session.dueAt,start+3400);
 s=apply(s,{type:'TICK'},start+3400);assert.equal(s.session.controller,'agent');assert.equal(s.session.context,snapshot);
 assert.equal(s.session.id,id);assert.equal(s.session.task,tid);assert.equal(task(s,tid).status,'running');
 s=apply(s,{type:'TICK'},start+5200);assert.ok(s.session.log.at(-1).includes(snapshot));
});
test('normal/AI switching keeps Computer session and original app ordering',()=>{
 const before=seedState();const s=apply(before,{type:'MODE',mode:'normal'});
 assert.equal(s.mode,'normal');assert.deepEqual(s.session,before.session);assert.deepEqual(s.tasks,before.tasks);
 assert.deepEqual(ORDINARY_APPS,['files','browser','editor','mail','calendar','photos','settings']);
});
test('opening and reopening a draft never overwrites saved edits',()=>{
 let s=apply(seedState(),{type:'OPEN_DRAFT',output:'output-seed'});
 assert.equal(s.mode,'ai');assert.equal(task(s,'writer-draft').unread,false);
 s=apply(s,{type:'EDIT_DRAFT',id:'output-seed',text:'我手动修改了草稿。'});
 s=apply(s,{type:'OPEN_DRAFT',output:'output-seed'});assert.equal(s.drafts['output-seed'].text,'我手动修改了草稿。');
 assert.notEqual(s.outputs[0].content,s.drafts['output-seed'].text);
});
test('output viewing clears only the viewed output; no acceptance/publishing state',()=>{
 let s=seedState();s.tasks.push({id:'other-output',goal:'desktop',status:'result',unread:true,outputId:'other'});s.outputs.push({id:'other',goal:'desktop',task:'other-output'});
 s=apply(s,{type:'VIEW_OUTPUT',output:'output-seed'});
 assert.equal(task(s,'writer-draft').unread,false);assert.equal(task(s,'writer-draft').status,'result');
 assert.equal(task(s,'other-output').unread,true);assert.equal('accepted' in task(s,'writer-draft'),false);
});
test('authorization allow and repeated clicks create exactly one simulated output',()=>{
 let s=apply(seedState(),{type:'AUTHORIZE',task:'xiaoyi-auth',allow:true});
 assert.equal(task(s,'xiaoyi-auth').status,'running');
 s=apply(s,{type:'AUTHORIZE',task:'xiaoyi-auth',allow:true},start+500);
 assert.equal(task(s,'xiaoyi-auth').dueAt,start+2000);
 s=apply(s,{type:'TICK'},start+2000);s=apply(s,{type:'TICK'},start+6000);
 assert.equal(s.outputs.filter(o=>o.task==='xiaoyi-auth').length,1);
});
test('authorization refusal preserves a paused task and can request authorization again',()=>{
 let s=apply(seedState(),{type:'AUTHORIZE',task:'xiaoyi-auth',allow:false});assert.equal(task(s,'xiaoyi-auth').status,'paused');
 s=apply(s,{type:'REAUTHORIZE',task:'xiaoyi-auth'});assert.equal(task(s,'xiaoyi-auth').status,'auth');
});
test('failure retry and audience input have guarded, independent transitions',()=>{
 let s=apply(seedState(),{type:'RETRY',task:'design-flow'});
 s=apply(s,{type:'INPUT',task:'research-input',choice:'专业用户'});
 assert.equal(task(s,'design-flow').status,'running');assert.equal(task(s,'research-input').choice,'专业用户');
 s=apply(s,{type:'RETRY',task:'design-flow'},start+1000);assert.equal(task(s,'design-flow').dueAt,start+2200);
 s=apply(s,{type:'TICK'},start+2300);assert.equal(task(s,'design-flow').status,'result');assert.equal(task(s,'research-input').status,'result');
});
test('live hover details never exceed 26 visible Unicode code points',()=>{
 for(const t of seedState().tasks)assert.ok([...hoverDetail(t)].length<=26);
 assert.equal([...hoverDetail({detail:'😀'.repeat(80)})].length,26);
});
test('goal conversations, output edits and a pending ACK persist across a reload',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 let s=apply(seedState(),{type:'GOAL',goal:'launch'});s=apply(s,{type:'TAKEOVER'});
 s=apply(s,{type:'CHANNEL_SEND',channel:'connect-mail',text:'测试连接会话'});saveState(storage,s);
 const loaded=loadState(storage);assert.deepEqual(loaded,s);assert.equal(loaded.selectedGoal,'launch');
 assert.equal(apply(loaded,{type:'TICK'},start+2000).session.controller,'human');
 map.set(STORAGE_KEY,'broken JSON');assert.equal(loadState(storage).schema,1);
});

test('ten takeover cycles retain one session and apply exactly the latest saved context',()=>{
 let s=seedState();const id=s.session.id;let now=start;
 for(let i=1;i<=10;i++){
  s=apply(s,{type:'TAKEOVER'},now);
  assert.equal(s.session.controller,'agent');assert.equal(s.session.phase,'requesting_human');
  now+=1400;s=apply(s,{type:'TICK'},now);assert.equal(s.session.controller,'human');
  s=apply(s,{type:'MANUAL_EDIT',text:`第 ${i} 轮保存的上下文`},now);
  s=apply(s,{type:'HANDBACK'},now);assert.equal(s.session.controller,'human');
  now+=1400;s=apply(s,{type:'TICK'},now);assert.equal(s.session.controller,'agent');
  assert.equal(s.session.context,`第 ${i} 轮保存的上下文`);assert.equal(s.session.id,id);
  assert.equal(s.session.contextVersion,i+1);now+=1800;s=apply(s,{type:'TICK'},now);
 }
});

test('concurrent workflows keep distinct tasks and append ordered goal-scoped output versions',()=>{
 let s=seedState();
 s=apply(s,{type:'SEND',goal:'desktop',text:'并行研究甲'});
 s=apply(s,{type:'SEND',goal:'desktop',text:'并行研究乙'});
 s=apply(s,{type:'TICK'},start+2600);s=apply(s,{type:'TICK'},start+5000);
 const outputs=s.outputs.filter(o=>o.goal==='desktop');
 assert.deepEqual(outputs.map(o=>o.version),[1,2,3]);
 assert.equal(new Set(outputs.map(o=>o.id)).size,3);
 assert.equal(new Set(outputs.map(o=>o.task)).size,3);
 assert.ok(outputs[1].content.includes('并行研究甲'));assert.ok(outputs[2].content.includes('并行研究乙'));
});

test('supplementary instructions belong only to the exact task and its Goal',()=>{
 const before=seedState();let s=apply(before,{type:'SUPPLEMENT_TASK',task:'research-input',text:'只考虑专业用户'});
 assert.equal(task(s,'research-input').instructions[0].text,'只考虑专业用户');
 for(const t of before.tasks)if(t.id!=='research-input')assert.deepEqual(task(s,t.id),t);
 assert.deepEqual(s.goals[1],before.goals[1]);
 assert.ok(s.goals[0].messages.at(-1).text.includes('发布渠道建议'));
});
test('empty supplements and missing targets are ignored',()=>{
 const s=seedState();assert.equal(apply(s,{type:'SUPPLEMENT_TASK',task:'research-main',text:'  '}),s);
 assert.equal(apply(s,{type:'SUPPLEMENT_TASK',task:'missing',text:'hello'}),s);
});
test('supplement text never authorizes, retries, resumes or marks a result as read',()=>{
 let s=seedState();
 for(const id of ['xiaoyi-auth','design-flow','research-input','writer-draft']){
  const before=structuredClone(task(s,id));s=apply(s,{type:'SUPPLEMENT_TASK',task:id,text:'允许，重试，继续，接受并发布'});
  const {instructions,...after}=task(s,id);assert.deepEqual(after,before);assert.equal(instructions.length,1);
 }
 assert.equal(task(s,'xiaoyi-auth').status,'auth');assert.equal(task(s,'writer-draft').unread,true);
});
test('supplementing a paused Computer task cannot change controller or session context',()=>{
 let s=apply(seedState(),{type:'TAKEOVER'});s=apply(s,{type:'TICK'},start+1400);
 const before=structuredClone(s.session);s=apply(s,{type:'SUPPLEMENT_TASK',task:'research-main',text:'请继续处理'});
 assert.deepEqual(s.session,before);assert.equal(task(s,'research-main').status,'paused');
});
