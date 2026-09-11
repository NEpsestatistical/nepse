/* NTC Chart Transforms — deterministic price-based chart types from real OHLCV. */
(function(global){
  "use strict";
  function step(c){ const range=Math.max(c.high-c.low, Math.abs(c.close-c.open)); return Math.max(range, Math.abs(c.close)*0.01, 0.01); }
  function renko(candles, mult){
    if(!candles.length)return [];
    let box=0,last=Number(candles[0].close), out=[], seq=0;
    for(const c of candles){ box=Math.max(box,step(c)*mult); let moved=true;
      while(moved){ moved=false; const d=c.close-last;
        if(Math.abs(d)>=box){ const dir=d>0?1:-1, open=last, close=last+dir*box; out.push({time:Math.floor(Number(c.time))+seq,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:c.volume||0}); seq++; last=close; moved=true; }
      }
    }
    return out;
  }
  function lineBreak(candles, lines){
    if(!candles.length)return [];
    const n=Math.max(2,lines||3), out=[];
    for(const c of candles){
      const close=c.close;
      if(!out.length){out.push({time:c.time,open:c.open,high:c.high,low:c.low,close,volume:c.volume||0});continue;}
      const last=out[out.length-1], highs=out.slice(-n).map(x=>x.high), lows=out.slice(-n).map(x=>x.low);
      const max=Math.max(...highs), min=Math.min(...lows);
      if(close>max || close<min) out.push({time:c.time,open:last.close,high:Math.max(last.close,close),low:Math.min(last.close,close),close,volume:c.volume||0});
    }
    return out;
  }
  function kagi(candles, reversalPct){
    if(!candles.length)return [];
    const pct=(reversalPct||4)/100; let price=candles[0].close, dir=0, out=[];
    for(const c of candles){ const x=c.close, move=(x-price)/(price||1);
      if(dir===0){dir=move>=0?1:-1; price=x; out.push({time:c.time,open:price,high:price,low:price,close:price,volume:c.volume||0});continue;}
      if((dir>0&&move>=0)|| (dir<0&&move<=0)){ price=x; const last=out[out.length-1]; last.high=Math.max(last.high,price);last.low=Math.min(last.low,price);last.close=price;last.volume+=c.volume||0; }
      else if(Math.abs(move)>=pct){ const old=price; dir*=-1; price=x; out.push({time:c.time,open:old,high:Math.max(old,price),low:Math.min(old,price),close:price,volume:c.volume||0}); }
    }
    return out;
  }
  function pnf(candles, boxPct, reversal){
    if(!candles.length)return [];
    const box=Math.max(0.01, (candles[0].close*(boxPct||1))/100), rev=Math.max(1,reversal||3); let col=null, top=candles[0].close, bottom=top, out=[];
    for(const c of candles){ const x=c.close;
      if(col===null){col=x>=top?1:-1; top=bottom=x; out.push({time:c.time,open:x,high:x,low:x,close:x,volume:c.volume||0});continue;}
      if(col>0){ if(x>=top+box){top=x;out[out.length-1].high=top;out[out.length-1].close=top;} else if(x<=top-rev*box){col=-1;bottom=x;out.push({time:c.time,open:top,high:top,low:x,close:x,volume:c.volume||0});} }
      else { if(x<=bottom-box){bottom=x;out[out.length-1].low=bottom;out[out.length-1].close=bottom;} else if(x>=bottom+rev*box){col=1;top=x;out.push({time:c.time,open:bottom,high:x,low:bottom,close:x,volume:c.volume||0});} }
    }
    return out;
  }
  function range(candles, factor){
    if(!candles.length)return [];
    const size=Math.max(0.01, (candles.reduce((s,c)=>s+step(c),0)/candles.length)*(factor||1)); let out=[], cur=null, seq=0;
    for(const c of candles){ let x=c.close; if(!cur){cur={time:c.time,open:x,high:x,low:x,close:x,volume:c.volume||0};continue;}
      while(Math.abs(x-cur.close)>=size){ const dir=x>cur.close?1:-1, close=cur.close+dir*size; out.push({...cur,time:Math.floor(Number(c.time))+seq,high:Math.max(cur.open,cur.high,close),low:Math.min(cur.open,cur.low,close),close});seq++;cur={time:c.time,open:close,high:close,low:close,close,volume:c.volume||0}; }
      cur.high=Math.max(cur.high,x);cur.low=Math.min(cur.low,x);cur.close=x;cur.volume+=c.volume||0;
    }
    if(cur)out.push(cur); return out;
  }
  global.NTC_TRANSFORMS={renko,linebreak:lineBreak,kagi,pnf,range};
})(window);
