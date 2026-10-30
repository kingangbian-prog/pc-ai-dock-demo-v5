import {icon} from './icons.mjs';
import {hoverDetail,statusInfo} from './model.mjs';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A separate portal keeps the actual input node alive while the desktop updates.
export class LiveProgressCard {
  constructor({host,getTask,onOpen,onSend,drafts=new Map()}) {
    Object.assign(this,{host,getTask,onOpen,onSend,taskId:null,drafts,blocked:new Set(),serial:0,timer:null});
    document.addEventListener('pointerover',e=>{
      const capsule=e.target.closest?.('.live-capsule');
      if(!capsule)return;
      const pill=e.target.closest('.live-item');
      if(pill)this.show(pill.dataset.task);
    });
    document.addEventListener('pointerout',e=>{
      if(e.target.closest?.('.live-capsule')&&!e.relatedTarget?.closest?.('.live-capsule'))this.scheduleClose();
    });
    document.addEventListener('focusin',e=>{
      const pill=e.target.closest?.('.live-item');
      if(pill)this.show(pill.dataset.task);
    });
    document.addEventListener('pointermove',e=>{
      const pill=e.target.closest?.('.live-item');
      for(const id of this.blocked)if(pill?.dataset.task!==id)this.blocked.delete(id);
    });
    document.addEventListener('pointerdown',e=>{
      if(this.taskId&&!this.host.contains(e.target)&&!e.target.closest?.('.live-capsule'))this.dismiss(false);
    },true);
    document.addEventListener('keydown',e=>{
      const pill=e.target.closest?.('.live-item');
      if(e.key==='ArrowDown'&&pill){e.preventDefault();e.stopPropagation();this.blocked.delete(pill.dataset.task);this.show(pill.dataset.task);host.querySelector('input')?.focus();return;}
      if(e.key==='Escape'&&this.taskId){const id=this.taskId;e.preventDefault();e.stopPropagation();this.dismiss(true);this.trigger(id)?.focus({preventScroll:true});}
    },true);
    host.addEventListener('pointerover',()=>this.cancelClose());
    host.addEventListener('pointerout',e=>{if(!host.contains(e.relatedTarget))this.scheduleClose();});
    host.addEventListener('focusin',()=>this.cancelClose());
    host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))this.scheduleClose();});
    host.addEventListener('input',e=>{
      if(e.target.id!=='live-task-input')return;
      this.drafts.set(this.taskId,e.target.value);
      host.querySelector('[type="submit"]').disabled=!e.target.value.trim();
    });
    host.addEventListener('submit',e=>{
      e.preventDefault();const id=e.target.dataset.task;
      const input=host.querySelector('#live-task-input');const text=input.value.trim();
      if(!text||!this.getTask(id))return;
      this.drafts.set(id,'');input.value='';
      this.onSend(id,text);this.update();
    });
    host.addEventListener('click',e=>{
      const header=e.target.closest('[data-live-open]');if(!header)return;
      const id=header.dataset.liveOpen;this.dismiss(true);this.onOpen(id);
    });
  }
  trigger(id=this.taskId){return [...document.querySelectorAll('.live-item')].find(e=>e.dataset.task===id);}
  cancelClose(){clearTimeout(this.timer);this.timer=null;}
  scheduleClose(){
    this.cancelClose();this.timer=setTimeout(()=>{
      const card=this.host.firstElementChild;const trigger=this.trigger();
      if(this.host.contains(document.activeElement)||card?.matches(':hover')||trigger?.matches(':hover')||trigger===document.activeElement)return;
      this.dismiss(false);
    },220);
  }
  suspend(){this.suspended=true;this.dismiss(false);}
  resume(){this.suspended=false;}
  show(id){
    if(this.suspended)return;
    if(this.blocked.has(id)||!this.getTask(id))return;
    if(this.host.contains(document.activeElement)&&this.taskId&&this.taskId!==id)return;
    this.cancelClose();
    if(this.taskId!==id){
      this.taskId=id;this.serial++;
      this.host.innerHTML=`<aside class="live-progress-card" role="dialog" aria-label="任务进度卡片" data-task="${escape(id)}"><button class="live-progress-header" data-live-open="${escape(id)}" aria-label="打开当前任务详情"><strong></strong>${icon('right')}</button><div class="live-progress-status"></div><p class="live-progress-detail"></p><div class="live-progress-feedback"></div><form class="live-progress-form" data-task="${escape(id)}"><input id="live-task-input" data-mount="${this.serial}" aria-label="给当前任务补充指令" placeholder="补充一句，仅此任务…" autocomplete="off"><button type="submit" aria-label="发送当前任务补充" disabled>${icon('arrow')}</button></form><small>本地模拟 · 补充文字不代表授权</small></aside>`;
      this.host.querySelector('#live-task-input').value=this.drafts.get(id)||'';
    }
    this.update();
    for(const pill of document.querySelectorAll('.live-item'))pill.setAttribute('aria-expanded',String(pill.dataset.task===this.taskId));
  }
  update(){
    if(!this.taskId)return;
    const task=this.getTask(this.taskId);if(!task){this.dismiss(false);return;}
    const card=this.host.firstElementChild;if(!card)return;
    card.querySelector('.live-progress-header strong').textContent=Array.from(task.title).slice(0,20).join('');
    card.querySelector('.live-progress-header').title=task.title;
    const [label,color,symbol]=statusInfo(task);
    card.querySelector('.live-progress-status').innerHTML=`<span class="status ${color}">${icon(symbol)}${label}</span>`;
    card.querySelector('.live-progress-detail').textContent=hoverDetail(task);
    card.querySelector('.live-progress-feedback').textContent=task.instructions?.length?`已记录 ${task.instructions.length} 条补充 · 仅此任务`:'仅补充当前任务，不影响其他任务';
    const input=card.querySelector('input');card.querySelector('[type="submit"]').disabled=!input.value.trim();
    const trigger=this.trigger();
    if(trigger){const r=trigger.getBoundingClientRect();if(!r.width||!r.height){this.dismiss(false);return;}const width=Math.min(284,innerWidth-24);card.style.left=Math.max(12,Math.min(innerWidth-width-12,r.x+r.width/2-width/2))+'px';card.style.top=r.bottom+10+'px';}
  }
  dismiss(suppress=false){
    if(suppress&&this.taskId)this.blocked.add(this.taskId);
    this.cancelClose();this.taskId=null;this.host.replaceChildren();
    for(const pill of document.querySelectorAll('.live-item'))pill.setAttribute('aria-expanded','false');
  }
}
