// Render-only budgets. World coordinates, input, combat and network timing are unchanged.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RenderQuality=api;})(typeof window==='undefined'?globalThis:window,function(){
  const levels=[1,.9,.8,.7];
  function controller(){
    let mode='auto',level=0,samples=0,total=0,last=0,settle=0,good=0;
    const reset=()=>{samples=total=last=good=0;};
    return {
      mode:()=>mode,
      set(value){const next=['auto','high','smooth'].includes(value)?value:'auto';if(next===mode)return false;mode=next;level=0;reset();settle=0;return true;},
      scale:()=>mode==='smooth'?.72:mode==='high'?1:levels[level],
      ambient:()=>mode==='high'||mode==='auto'&&level<2,
      particles:()=>mode==='smooth'?300:mode==='high'?1800:700,
      ratio(native,w,h){const scale=this.scale(),budget=mode==='high'?4e6:mode==='smooth'?1.4e6:2.8e6;return Math.max(.65,Math.min(2,native||1,Math.sqrt(budget/Math.max(1,w*h)))*scale);},
      sample(now,active=true){
        if(!active){reset();settle=now+1500;return false;}
        const delta=last?now-last:0;last=now;
        if(mode!=='auto'||!delta||delta>250||now<settle)return false;
        samples++;total+=Math.min(80,delta);
        if(samples<120)return false;
        const average=total/samples;samples=total=0;
        if(average>22&&level<levels.length-1){level++;good=0;settle=now+2500;return true;}
        if(average<17.5&&level>0){if(++good>=8){level--;good=0;settle=now+4000;return true;}}else good=0;
        return false;
      },
    };
  }
  return {controller};
});
