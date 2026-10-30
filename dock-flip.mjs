// One in-flight transition; only the concealed midpoint changes the saved mode.
export const FLIP_HALF_MS=220;
export class DockFlip {
  constructor({getMode,commit,prepare=()=>{},phaseChanged=()=>{},finished=()=>{},reduced=()=>false,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}) {
    Object.assign(this,{getMode,commit,prepare,phaseChanged,finished,reduced,schedule,cancel,active:false,phase:'idle',target:null,committed:false,timer:null});
  }
  change(target) {
    if(this.active||!['ai','normal'].includes(target)||target===this.getMode())return false;
    this.active=true;this.target=target;this.committed=false;
    try {
      this.prepare();
      if(this.reduced()){this.settle();return true;}
      this.setPhase('out');
      this.timer=this.schedule(()=>{
        this.timer=null;
        try{this.commitOnce();this.setPhase('in');this.timer=this.schedule(()=>this.finish(),FLIP_HALF_MS);}
        catch(error){this.finish();throw error;}
      },FLIP_HALF_MS);
      return true;
    } catch(error){if(this.active)this.finish();throw error;}
  }
  setPhase(phase){this.phase=phase;this.phaseChanged(phase);}
  commitOnce(){if(!this.committed){this.committed=true;this.commit(this.target);}}
  settle(){if(!this.active)return;try{this.commitOnce();}finally{this.finish();}}
  finish(){
    if(!this.active)return;
    if(this.timer!==null)this.cancel(this.timer);
    this.timer=null;this.active=false;this.target=null;
    try{this.setPhase('idle');}finally{this.finished();}
  }
}
