/* NTC Phase 7 — lightweight client-side alert engine. */
(function(global){
  "use strict";
  const KEY=()=>global.NTC_CONFIG.STORAGE_PREFIX+"alerts_v1";
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY())||"[]");return Array.isArray(x)?x:[]}catch(e){return[]}}
  function write(x){try{localStorage.setItem(KEY(),JSON.stringify(x));return true}catch(e){return false}}
  function notify(a,message){
    a.lastTriggered=Date.now(); write(AlertEngine.list);
    try{if("Notification" in window&&Notification.permission==="granted")new Notification("NEPSE Alert",{body:message})}catch(e){}
    document.dispatchEvent(new CustomEvent("ntc-alert-trigger",{detail:{alert:a,message}}));
  }
  class AlertEngine{
    static list=read();
    static add(a){a.id="a"+Date.now()+Math.random().toString(16).slice(2);a.createdAt=Date.now();a.enabled=true;AlertEngine.list.push(a);write(AlertEngine.list);return a}
    static remove(id){AlertEngine.list=AlertEngine.list.filter(x=>x.id!==id);write(AlertEngine.list)}
    static toggle(id){const a=AlertEngine.list.find(x=>x.id===id);if(a){a.enabled=!a.enabled;write(AlertEngine.list)}return a}
    static clear(){AlertEngine.list=[];write(AlertEngine.list)}
    static async check(symbol,candles){
      if(!symbol||!candles||candles.length<2)return;
      const last=candles[candles.length-1], prev=candles[candles.length-2];
      for(const a of AlertEngine.list){
        if(!a.enabled||a.symbol!==symbol)continue;
        if(a.type==="price"){
          const v=Number(last.close); const level=Number(a.value); const crossed=a.direction==="above"?(prev.close<level&&v>=level):(prev.close>level&&v<=level);
          if(crossed)notify(a,`${symbol} crossed ${a.direction} ${level} (close ${v})`);
        } else if(a.type==="crossover"&&global.NTC_INDICATORS){
          const id=a.indicatorId,def=global.NTC_INDICATORS.registry[id]; if(!def)continue;
          try{const r=global.NTC_INDICATORS.calculate(id,candles,a.settings||{});const cdef=global.NTC_INDICATORS.registry[a.compareId];const cr=cdef?global.NTC_INDICATORS.calculate(a.compareId,candles,a.settings||{}):null;const line=r&&r.lines&&r.lines[0], other=cr&&cr.lines&&cr.lines[0]; if(!line||!other)continue;const vals=line[1],ov=other[1];let i=vals.length-1,j=i-1;while(i>=0&&(vals[i]==null||ov[i]==null))i--;while(j>=0&&(vals[j]==null||ov[j]==null))j--;if(i<1||j<0)continue;const now=vals[i]-ov[i],before=vals[j]-ov[j];if(a.direction==="above"?before<=0&&now>0:before>=0&&now<0)notify(a,`${symbol} ${def.name}/${cdef.name} ${a.direction==='above'?'bullish':'bearish'} crossover`)}catch(e){console.warn("[ntc-alert]",e)}}
      }
    }
  }
  global.NTC_ALERTS=AlertEngine;
})(window);
