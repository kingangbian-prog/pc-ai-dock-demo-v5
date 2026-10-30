import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENTS,AGENT_ORDER,seedState,reduce,migrateAgentIdentity,loadState,STORAGE_KEY} from '../model.mjs';

test('four requested identities retain a fixed order and compact accessible selector labels',()=>{
 assert.deepEqual(AGENT_ORDER.map(k=>AGENTS[k].name),['Workbuddy','千问','豆包工作','ChatGPT']);
 assert.deepEqual(AGENT_ORDER.map(k=>AGENTS[k].selectorLabel),['WB','千问','豆包','GPT']);
 assert.equal(AGENTS.xiaoyi.name,'小艺');assert.equal(AGENTS.xiaoyi.selectorLabel,'小艺');
 assert.equal(new Set(AGENT_ORDER.map(k=>AGENTS[k].icon)).size,4);
});
test('each selected identity dispatches to its existing task owner and the default pipeline remains intact',()=>{
 for(const key of AGENT_ORDER){
  let s=reduce(seedState(),{type:'SEND',goal:'desktop',text:'身份映射测试',agent:key},1000);
  assert.equal(s.tasks.at(-1).agent,key);assert.equal(s.tasks.at(-1).requestedBy,key);
  assert.ok(s.goals[0].messages.at(-1).text.includes(AGENTS[key].name));
 }
 let s=reduce(seedState(),{type:'SEND',goal:'desktop',text:'默认协作测试',agent:'xiaoyi'},1000);
 assert.equal(s.tasks.at(-1).agent,'research');s=reduce(s,{type:'TICK'},3600);
 assert.equal(s.tasks.at(-1).agent,'writer');assert.ok(s.goals[0].messages.at(-1).text.includes('Workbuddy → 千问'));
});
test('legacy migration changes generated identities while preserving IDs, human control and user content',()=>{
 let old=seedState();delete old.agentIdentityVersion;
 old.session.phase='human';old.session.controller='human';old.session.manualText='我写的研究 Agent 笔记';old.session.context='保持原文';
 old.session.log=['研究 Agent 启动模拟浏览器','继续执行：我写的研究 Agent 笔记'];
 old.tasks[0].detail='研究 Agent 正在模拟操作';old.tasks[1].step='已交给写作 Agent';
 old.goals[0].messages.push({role:'user',text:'我手写的写作 Agent 名称'},{role:'bot',text:'研究 Agent → 写作 Agent'},{role:'handoff',text:'研究 Agent · 任务 收到模拟补充：保留研究 Agent 原文'});
 old.drafts.personal.text='我的研究 Agent 草稿，请保留';const before=structuredClone(old);
 const next=migrateAgentIdentity(old);
 assert.deepEqual(next.tasks.map(t=>t.id),before.tasks.map(t=>t.id));assert.equal(next.session.id,before.session.id);assert.equal(next.session.agent,'research');
 assert.equal(next.session.phase,'human');assert.equal(next.session.controller,'human');
 assert.equal(next.session.manualText,before.session.manualText);assert.equal(next.session.context,before.session.context);
 assert.equal(next.session.log[0],'Workbuddy 启动模拟浏览器');assert.equal(next.session.log[1],before.session.log[1]);
 assert.equal(next.tasks[0].detail,'Workbuddy 正在模拟操作');assert.equal(next.goals[0].messages.at(-2).text,'Workbuddy → 千问');
 assert.equal(next.goals[0].messages.at(-3).text,before.goals[0].messages.at(-3).text);
 assert.equal(next.goals[0].messages.at(-1).text,'Workbuddy · 任务 收到模拟补充：保留研究 Agent 原文');
 assert.deepEqual(next.drafts,before.drafts);assert.deepEqual(next.outputs,before.outputs);assert.equal(migrateAgentIdentity(next),next);
});
test('loading old storage persists identity migration without resetting task or output history',()=>{
 const old=seedState();delete old.agentIdentityVersion;old.session.log=['研究 Agent 启动模拟浏览器'];
 const store=new Map([[STORAGE_KEY,JSON.stringify(old)]]);const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const next=loadState(storage),saved=JSON.parse(store.get(STORAGE_KEY));
 assert.equal(next.agentIdentityVersion,2);assert.equal(saved.agentIdentityVersion,2);assert.equal(next.tasks.length,old.tasks.length);
 assert.deepEqual(next.outputs,old.outputs);assert.equal(AGENTS[next.session.agent].name,'Workbuddy');
});
