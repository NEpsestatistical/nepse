/* NTC Indicator Engine — Phase 2
   Pure calculations + registry. No external data and no invented prices. */
(function(global){
"use strict";
const N= {
 sma:(v,p)=>v.map((_,i)=>i+1>=p?v.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p:null),
 ema:(v,p)=>{const o=Array(v.length).fill(null),k=2/(p+1);let prev=null;v.forEach((x,i)=>{if(x==null)return;if(i===p-1)prev=v.slice(0,p).reduce((a,b)=>a+b,0)/p;else if(i>=p)prev=x*k+prev*(1-k);if(i>=p-1)o[i]=prev});return o},
 wma:(v,p)=>v.map((_,i)=>i+1>=p?v.slice(i-p+1,i+1).reduce((s,x,j)=>s+x*(j+1),0)/(p*(p+1)/2):null),
 rma:(v,p)=>{const o=Array(v.length).fill(null);let prev=null;v.forEach((x,i)=>{if(i===p-1)prev=v.slice(0,p).reduce((a,b)=>a+b,0)/p;else if(i>=p)prev=(prev*(p-1)+x)/p;if(i>=p-1)o[i]=prev});return o},
 std:(v,p)=>v.map((_,i)=>{if(i+1<p)return null;const a=v.slice(i-p+1,i+1),m=a.reduce((x,y)=>x+y,0)/p;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/p)}),
 tr:(c)=>c.map((x,i)=>i?Math.max(x.high-x.low,Math.abs(x.high-c[i-1].close),Math.abs(x.low-c[i-1].close)):x.high-x.low),
 roc:(v,p)=>v.map((x,i)=>i>=p?((x/v[i-p])-1)*100:null),
 momentum:(v,p)=>v.map((x,i)=>i>=p?x-v[i-p]:null),
 highest:(v,p)=>v.map((_,i)=>i+1>=p?Math.max(...v.slice(i-p+1,i+1)):null),
 lowest:(v,p)=>v.map((_,i)=>i+1>=p?Math.min(...v.slice(i-p+1,i+1)):null)
};
function vals(c){return {o:c.map(x=>x.open),h:c.map(x=>x.high),l:c.map(x=>x.low),cl:c.map(x=>x.close),v:c.map(x=>Number(x.volume)||0)}}
function mapSeries(c,a){return a.map((v,i)=>v==null?null:{time:c[i].time,value:v}).filter(Boolean)}
function calc(name,c,p={}){const {h,l,cl,v}=vals(c), period=+p.period||14;
 switch(name){
 case"sma":return {overlay:true,lines:[["SMA",N.sma(cl,period)]]};
 case"ema":return {overlay:true,lines:[["EMA",N.ema(cl,period)]]};
 case"wma":return {overlay:true,lines:[["WMA",N.wma(cl,period)]]};
 case"vwma":{const pv=cl.map((x,i)=>x*v[i]);return {overlay:true,lines:[["VWMA",N.sma(pv,period).map((x,i)=>x==null?null:x/N.sma(v,period)[i])]]}}
 case"hma":{const w=N.wma(cl,period),half=N.wma(cl,Math.max(1,Math.floor(period/2))),raw=cl.map((_,i)=>w[i]!=null&&half[i]!=null?2*half[i]-w[i]:null), vals2=raw.map(x=>x==null?0:x);return {overlay:true,lines:[["HMA",N.wma(vals2,Math.max(1,Math.floor(Math.sqrt(period))))]]}}
 case"rma":return {overlay:true,lines:[["RMA",N.rma(cl,period)]]};
 case"dema":{const e=N.ema(cl,period),ee=N.ema(e.map(x=>x==null?cl[0]:x),period);return {overlay:true,lines:[["DEMA",e.map((x,i)=>x!=null&&ee[i]!=null?2*x-ee[i]:null)]]}}
 case"tema":{const e=N.ema(cl,period),ee=N.ema(e.map(x=>x==null?cl[0]:x),period),eee=N.ema(ee.map(x=>x==null?cl[0]:x),period);return {overlay:true,lines:[["TEMA",e.map((x,i)=>x!=null&&ee[i]!=null&&eee[i]!=null?3*x-3*ee[i]+eee[i]:null)]]}}
 case"ichimoku":{const ten=+p.tenkan||9,k=+p.kijun||26,s=+p.senkou||52;const mid=(a,b,i)=>{if(i+1<b)return null;const hh=Math.max(...h.slice(i-b+1,i+1)),ll=Math.min(...l.slice(i-b+1,i+1));return(hh+ll)/2};const T=c.map((_,i)=>mid(c,ten,i)),K=c.map((_,i)=>mid(c,k,i)),SA=T.map((x,i)=>x!=null&&K[i]!=null?(x+K[i])/2:null),SB=c.map((_,i)=>mid(c,s,i));return {overlay:true,lines:[["Tenkan",T],["Kijun",K],["Senkou A",SA],["Senkou B",SB]]}}
 case"supertrend":{const atr=N.rma(N.tr(c),+p.atr||10),mult=+p.mult||3,up=[],dn=[],st=[];for(let i=0;i<c.length;i++){if(atr[i]==null){up.push(null);dn.push(null);st.push(null);continue}const m=(h[i]+l[i])/2;up[i]=m+mult*atr[i];dn[i]=m-mult*atr[i];if(i){up[i]=up[i]<up[i-1]||cl[i-1]>up[i-1]?up[i]:up[i-1];dn[i]=dn[i]>dn[i-1]||cl[i-1]<dn[i-1]?dn[i]:dn[i-1]}st[i]=i&&!st[i-1]?up[i]:cl[i]>up[i-1]?dn[i]:cl[i]<dn[i-1]?up[i]:st[i-1]}return {overlay:true,lines:[["Supertrend",st]]}}
 case"psar":{const step=+p.step||.02,max=+p.max||.2,ps=[];let bull=true,af=step,ep=h[0],sar=l[0];for(let i=0;i<c.length;i++){if(i===0){ps[i]=sar;continue}sar=sar+af*(ep-sar);if(bull){sar=Math.min(sar,l[i-1],i>1?l[i-2]:l[i-1]);if(l[i]<sar){bull=false;sar=ep;ep=l[i];af=step}}else{sar=Math.max(sar,h[i-1],i>1?h[i-2]:h[i-1]);if(h[i]>sar){bull=true;sar=ep;ep=h[i];af=step}}if(bull&&h[i]>ep){ep=h[i];af=Math.min(max,af+step)}if(!bull&&l[i]<ep){ep=l[i];af=Math.min(max,af+step)}ps[i]=sar}return {overlay:true,lines:[["Parabolic SAR",ps]]}}
 case"adx":{const tr=N.tr(c),up=[],dn=[];for(let i=0;i<c.length;i++){up[i]=i?Math.max(h[i]-h[i-1],0):0;dn[i]=i?Math.max(l[i-1]-l[i],0):0;if(up[i]<dn[i])up[i]=0;if(dn[i]<up[i])dn[i]=0}const atr=N.rma(tr,period),pu=N.rma(up,period),pd=N.rma(dn,period),diP=pu.map((x,i)=>atr[i]?100*x/atr[i]:null),diM=pd.map((x,i)=>atr[i]?100*x/atr[i]:null),dx=diP.map((x,i)=>x!=null&&diM[i]!=null?100*Math.abs(x-diM[i])/(x+diM[i]||1):null),adx=N.rma(dx.map(x=>x==null?0:x),period);return {overlay:false,lines:[["+DI",diP],["-DI",diM],["ADX",adx]]}}
 case"aroon":{const up=[],dn=[];for(let i=0;i<c.length;i++){if(i+1<period){up[i]=dn[i]=null;continue}const hh=Math.max(...h.slice(i-period+1,i+1)),ll=Math.min(...l.slice(i-period+1,i+1));up[i]=100*(period-1-(period-1-h.slice(i-period+1,i+1).lastIndexOf(hh)))/(period-1);dn[i]=100*(period-1-(period-1-l.slice(i-period+1,i+1).lastIndexOf(ll)))/(period-1)}return {overlay:false,lines:[["Aroon Up",up],["Aroon Down",dn]]}}
 case"donchian":return {overlay:true,lines:[["Upper",N.highest(h,period)],["Middle",N.highest(h,period).map((x,i)=>x!=null&&N.lowest(l,period)[i]!=null?(x+N.lowest(l,period)[i])/2:null)],["Lower",N.lowest(l,period)]]};
 case"keltner":{const e=N.ema(cl,period),a=N.rma(N.tr(c),period),m=+p.mult||2;return {overlay:true,lines:[["Middle",e],["Upper",e.map((x,i)=>x!=null&&a[i]!=null?x+m*a[i]:null)],["Lower",e.map((x,i)=>x!=null&&a[i]!=null?x-m*a[i]:null)]]}}
 case"rsi":{const ch=cl.map((x,i)=>i?x-cl[i-1]:0),gain=ch.map(x=>Math.max(x,0)),loss=ch.map(x=>Math.max(-x,0)),g=N.rma(gain,period),lo=N.rma(loss,period),r=g.map((x,i)=>x!=null&&lo[i]!=null?100-100/(1+x/(lo[i]||1e-9)):null);return {overlay:false,lines:[["RSI",r]],bounds:[30,70]}}
 case"stochastic":{const k=cl.map((x,i)=>{if(i+1<period)return null;const hh=Math.max(...h.slice(i-period+1,i+1)),ll=Math.min(...l.slice(i-period+1,i+1));return 100*(x-ll)/(hh-ll||1)}),d=N.sma(k.map(x=>x==null?0:x),+p.smooth||3);return {overlay:false,lines:[["%K",k],["%D",d]],bounds:[20,80]}}
 case"stochrsi":{const ch=cl.map((x,i)=>i?x-cl[i-1]:0),g=N.rma(ch.map(x=>Math.max(x,0)),14),lo=N.rma(ch.map(x=>Math.max(-x,0)),14),r=g.map((x,i)=>x!=null&&lo[i]!=null?100-100/(1+x/(lo[i]||1e-9)):null), k=r.map((x,i)=>{if(x==null||i+1<period)return null;const a=r.slice(i-period+1,i+1).filter(y=>y!=null),mn=Math.min(...a),mx=Math.max(...a);return (x-mn)/(mx-mn||1)*100});return {overlay:false,lines:[["Stoch RSI",k]],bounds:[20,80]}}
 case"macd":{const e1=N.ema(cl,+p.fast||12),e2=N.ema(cl,+p.slow||26),m=e1.map((x,i)=>x!=null&&e2[i]!=null?x-e2[i]:null),s=N.ema(m.map(x=>x==null?0:x),+p.signal||9),hist=m.map((x,i)=>x!=null&&s[i]!=null?x-s[i]:null);return {overlay:false,lines:[["MACD",m],["Signal",s]],hist:["Histogram",hist]}}
 case"ppo":{const e1=N.ema(cl,12),e2=N.ema(cl,26),m=e1.map((x,i)=>x!=null&&e2[i]!=null?100*(x-e2[i])/e2[i]:null),s=N.ema(m.map(x=>x||0),9);return {overlay:false,lines:[["PPO",m],["Signal",s]]}}
 case"roc":return {overlay:false,lines:[["ROC",N.roc(cl,period)]]};
 case"momentum":return {overlay:false,lines:[["Momentum",N.momentum(cl,period)]]};
 case"cci":{const tp=c.map(x=>(x.high+x.low+x.close)/3),ma=N.sma(tp,period),md=tp.map((_,i)=>i+1>=period?tp.slice(i-period+1,i+1).reduce((s,x)=>s+Math.abs(x-ma[i]),0)/period:null);return {overlay:false,lines:[["CCI",tp.map((x,i)=>ma[i]!=null&&md[i]? (x-ma[i])/(.015*md[i]):null)]]}}
 case"williams":{const hh=N.highest(h,period),ll=N.lowest(l,period);return {overlay:false,lines:[["Williams %R",cl.map((x,i)=>hh[i]!=null?(hh[i]-x)/(hh[i]-ll[i]||1)*-100:null)]],bounds:[-80,-20]}}
 case"ultimate":{const bp=[],tr=[];for(let i=0;i<c.length;i++){const pc=i?cl[i-1]:cl[i],bot=Math.min(l[i],pc),top=Math.max(h[i],pc);bp[i]=cl[i]-bot;tr[i]=top-bot}const av=(p)=>bp.map((_,i)=>i+1>=p?bp.slice(i-p+1,i+1).reduce((s,x,j)=>s+x,0)/(tr.slice(i-p+1,i+1).reduce((s,x)=>s+x,0)||1):null),a7=av(7),a14=av(14),a28=av(28);return {overlay:false,lines:[["Ultimate",a7.map((x,i)=>x!=null&&a14[i]!=null&&a28[i]!=null?(4*x+2*a14[i]+a28[i])/7*100:null)]]}}
 case"awesome":{const m=h.map((x,i)=>(x+l[i])/2),fast=N.sma(m,5),slow=N.sma(m,34);return {overlay:false,lines:[["Awesome",fast.map((x,i)=>x!=null&&slow[i]!=null?x-slow[i]:null)]]}}
 case"trix":{const e=N.ema(cl,period),ee=N.ema(e.map(x=>x||cl[0]),period),eee=N.ema(ee.map(x=>x||cl[0]),period);return {overlay:false,lines:[["TRIX",N.roc(eee,1)]]}}
 case"tsi":{const mom=cl.map((x,i)=>i?x-cl[i-1]:0),a=N.ema(mom,25),b=N.ema(a.map(x=>x||0),13),aa=N.ema(mom.map(Math.abs),25),bb=N.ema(aa.map(x=>x||0),13);return {overlay:false,lines:[["TSI",b.map((x,i)=>x!=null&&bb[i]?100*x/bb[i]:null)]]}}
 case"cmo":{const ch=cl.map((x,i)=>i?x-cl[i-1]:0),up=N.sma(ch.map(x=>Math.max(x,0)),period),dn=N.sma(ch.map(x=>Math.max(-x,0)),period);return {overlay:false,lines:[["CMO",up.map((x,i)=>x!=null&&dn[i]!=null?100*(x-dn[i])/(x+dn[i]||1):null)]]}}
 case"dpo":{const sma=N.sma(cl,period),shift=Math.floor(period/2)+1;return {overlay:false,lines:[["DPO",cl.map((x,i)=>i>=shift&&sma[i-shift]!=null?x-sma[i-shift]:null)]]}}
 case"fisher":{const hh=N.highest(h,period),ll=N.lowest(l,period),x=cl.map((v,i)=>hh[i]!=null?(2*(v-ll[i])/(hh[i]-ll[i]||1)-1)*.33:null),f=[],sig=[];let prev=0;for(let i=0;i<c.length;i++){if(x[i]==null){f[i]=null;sig[i]=null;continue}const q=.67*prev+.33*Math.max(-.999,Math.min(.999,x[i]));f[i]=.5*Math.log((1+q)/(1-q));sig[i]=i?f[i-1]:null;prev=q}return {overlay:false,lines:[["Fisher",f],["Signal",sig]]}}
 case"atr":return {overlay:false,lines:[["ATR",N.rma(N.tr(c),period)]]};
 case"truerange":return {overlay:false,lines:[["True Range",N.tr(c)]]};
 case"bb":{const m=N.sma(cl,period),s=N.std(cl,period),mult=+p.mult||2;return {overlay:true,lines:[["Basis",m],["Upper",m.map((x,i)=>x!=null&&s[i]!=null?x+mult*s[i]:null)],["Lower",m.map((x,i)=>x!=null&&s[i]!=null?x-mult*s[i]:null)]]}}
 case"bbwidth":{const m=N.sma(cl,period),s=N.std(cl,period),mult=+p.mult||2;return {overlay:false,lines:[["BB Width",m.map((x,i)=>x!=null&&s[i]!=null?(2*mult*s[i]/x)*100:null)]]}}
 case"hv":{const r=cl.map((x,i)=>i?Math.log(x/cl[i-1]):0),s=N.std(r,period);return {overlay:false,lines:[["Historical Volatility",s.map(x=>x==null?null:x*Math.sqrt(252)*100)]]}}
 case"stddev":return {overlay:false,lines:[["Std Dev",N.std(cl,period)]]};
 case"atrbands":{const a=N.rma(N.tr(c),period),e=N.ema(cl,period),m=+p.mult||2;return {overlay:true,lines:[["Basis",e],["Upper",e.map((x,i)=>x!=null&&a[i]!=null?x+m*a[i]:null)],["Lower",e.map((x,i)=>x!=null&&a[i]!=null?x-m*a[i]:null)]]}}
 case"volume":return {overlay:false,volume:true,lines:[["Volume",v]]};
 case"volsma":return {overlay:false,lines:[["Volume SMA",N.sma(v,period)]]};
 case"vwap":{let cv=0,pv=0;const out=[];c.forEach((x,i)=>{cv+=v[i];pv+=((x.high+x.low+x.close)/3)*v[i];out[i]=cv?pv/cv:null});return {overlay:true,lines:[["VWAP",out]]}}
 case"avwap":{const anchor=Math.max(0,c.length-(+p.period||30));let cv=0,pv=0;const out=Array(c.length).fill(null);for(let i=anchor;i<c.length;i++){cv+=v[i];pv+=((c[i].high+c[i].low+c[i].close)/3)*v[i];out[i]=cv?pv/cv:null}return {overlay:true,lines:[["Anchored VWAP",out]]}}
 case"vp":{const bins=Math.max(10,Math.min(80,+p.bins||24)),start=Math.max(0,c.length-(+p.period||100)),hi=Math.max(...h.slice(start)),lo=Math.min(...l.slice(start)),step=(hi-lo||1)/bins,vols=Array(bins).fill(0);for(let i=start;i<c.length;i++){const idx=Math.max(0,Math.min(bins-1,Math.floor((cl[i]-lo)/step)));vols[idx]+=v[i]}const total=vols.reduce((a,b)=>a+b,0),pocIdx=vols.indexOf(Math.max(...vols)),poc=lo+(pocIdx+.5)*step;let left=pocIdx,right=pocIdx;let covered=vols[pocIdx],target=total*.7;while(covered<target&&(left>0||right<bins-1)){const lv=left>0?vols[left-1]:-1,rv=right<bins-1?vols[right+1]:-1;if(rv>=lv){right++;covered+=vols[right]}else{left--;covered+=vols[left]}}const vah=lo+(right+1)*step,val=lo+left*step;return {overlay:true,lines:[["POC",Array(c.length).fill(poc)],["VAH",Array(c.length).fill(vah)],["VAL",Array(c.length).fill(val)]]}}
 case"obv":{const o=[];let x=0;c.forEach((q,i)=>{if(i)x+=q.close>c[i-1].close?q.volume:q.close<c[i-1].close?-q.volume:0;o[i]=x});return {overlay:false,lines:[["OBV",o]]}}
 case"ad":{let x=0,o=[];c.forEach((q,i)=>{x+=q.high!==q.low?((q.close-q.low)-(q.high-q.close))/(q.high-q.low)*q.volume:0;o[i]=x});return {overlay:false,lines:[["A/D",o]]}}
 case"cmf":{const mf=c.map(q=>q.high!==q.low?((q.close-q.low)-(q.high-q.close))/(q.high-q.low)*q.volume:0),ms=N.sma(mf,period),vs=N.sma(v,period);return {overlay:false,lines:[["CMF",ms.map((x,i)=>x!=null&&vs[i]?x/vs[i]:null)]],bounds:[0]}}
 case"mfi":{const tp=c.map(q=>(q.high+q.low+q.close)/3),pos=[],neg=[];for(let i=0;i<c.length;i++){const flow=tp[i]*v[i];pos[i]=i&&tp[i]>tp[i-1]?flow:0;neg[i]=i&&tp[i]<tp[i-1]?flow:0}const P=N.sma(pos,period),M=N.sma(neg,period);return {overlay:false,lines:[["MFI",P.map((x,i)=>x!=null&&M[i]!=null?100-100/(1+x/(M[i]||1e-9)):null)]],bounds:[20,80]}}
 case"force":return {overlay:false,lines:[["Force Index",cl.map((x,i)=>i?(x-cl[i-1])*v[i]:0)] ]};
 case"eom":{const raw=c.map((q,i)=>i?((q.high+q.low)/2-(c[i-1].high+c[i-1].low)/2)*(q.high-q.low)/(q.volume||1):0);return {overlay:false,lines:[["Ease of Movement",N.sma(raw,period)]]}}
 case"vpt":{let x=0,o=[];c.forEach((q,i)=>{if(i)x+=q.volume*((q.close-c[i-1].close)/(c[i-1].close||1));o[i]=x});return {overlay:false,lines:[["VPT",o]]}}
 case"volosc":{const f=N.sma(v,5),s=N.sma(v,period);return {overlay:false,lines:[["Volume Oscillator",f.map((x,i)=>x!=null&&s[i]!=null?(x-s[i])/s[i]*100:null)]]}}
 case"relvol":{const s=N.sma(v,period);return {overlay:false,lines:[["Relative Volume",v.map((x,i)=>s[i]?x/s[i]:null)]]}}
 case"pivot":{const hi=[],lo=[];for(let i=2;i<c.length-2;i++){hi[i]=h[i]>h[i-1]&&h[i]>h[i+1]&&h[i]>=h[i-2]&&h[i]>=h[i+2]?h[i]:null;lo[i]=l[i]<l[i-1]&&l[i]<l[i+1]&&l[i]<=l[i-2]&&l[i]<=l[i+2]?l[i]:null}return {overlay:true,points:[["Pivot High",hi,"high"],["Pivot Low",lo,"low"]]} }
 case"fractals":{const hi=[],lo=[];for(let i=2;i<c.length-2;i++){hi[i]=h[i]>h[i-1]&&h[i]>h[i+1]&&h[i]>h[i-2]&&h[i]>h[i+2]?h[i]:null;lo[i]=l[i]<l[i-1]&&l[i]<l[i+1]&&l[i]<l[i-2]&&l[i]<l[i+2]?l[i]:null}return {overlay:true,points:[["Fractal High",hi,"high"],["Fractal Low",lo,"low"]]} }
 case"zigzag":{const depth=+p.depth||5,out=[];for(let i=depth;i<c.length-depth;i++){const hh=Math.max(...h.slice(i-depth,i+depth+1)),ll=Math.min(...l.slice(i-depth,i+depth+1));if(h[i]===hh)out[i]=h[i];else if(l[i]===ll)out[i]=l[i];else out[i]=null}return {overlay:true,lines:[["Zig Zag",out]]}}
 case"swings":return calc("pivot",c,{period:2});
 case"hhll":{const out=[];for(let i=1;i<c.length;i++){out[i]=h[i]>h[i-1]?"HH":l[i]<l[i-1]?"LL":h[i]<h[i-1]?"LH":"HL"}return {overlay:true,labels:out}}
 case"support":{const hi=N.highest(h,period),lo=N.lowest(l,period);return {overlay:true,lines:[["Resistance",hi],["Support",lo]]}}
 default:return null;
 }
}
const defs=[
["sma","SMA","Trend",true,20],["ema","EMA","Trend",true,20],["wma","WMA","Trend",true,20],["vwma","VWMA","Trend",true,20],["hma","HMA","Trend",true,20],["rma","RMA / SMMA","Trend",true,14],["dema","DEMA","Trend",true,20],["tema","TEMA","Trend",true,20],["ichimoku","Ichimoku Cloud","Trend",true,14],["supertrend","Supertrend","Trend",true,10],["psar","Parabolic SAR","Trend",true,14],["adx","ADX / DI","Trend",false,14],["aroon","Aroon","Trend",false,14],["donchian","Donchian Channel","Trend",true,20],["keltner","Keltner Channel","Trend",true,20],
["rsi","RSI","Momentum",false,14],["stochastic","Stochastic","Momentum",false,14],["stochrsi","Stochastic RSI","Momentum",false,14],["macd","MACD","Momentum",false,12],["ppo","PPO","Momentum",false,12],["roc","ROC","Momentum",false,12],["momentum","Momentum","Momentum",false,10],["cci","CCI","Momentum",false,20],["williams","Williams %R","Momentum",false,14],["ultimate","Ultimate Oscillator","Momentum",false,14],["awesome","Awesome Oscillator","Momentum",false,34],["trix","TRIX","Momentum",false,15],["tsi","TSI","Momentum",false,14],["cmo","CMO","Momentum",false,14],["dpo","DPO","Momentum",false,20],["fisher","Fisher Transform","Momentum",false,10],
["atr","ATR","Volatility",false,14],["truerange","True Range","Volatility",false,14],["bb","Bollinger Bands","Volatility",true,20],["bbwidth","Bollinger Band Width","Volatility",false,20],["hv","Historical Volatility","Volatility",false,20],["stddev","Standard Deviation","Volatility",false,20],["atrbands","ATR Bands","Volatility",true,20],
["volume","Volume","Volume",false,20],["volsma","Volume SMA","Volume",false,20],["vwap","VWAP","Volume",true,14],["obv","OBV","Volume",false,14],["ad","Accumulation / Distribution","Volume",false,14],["cmf","CMF","Volume",false,20],["mfi","MFI","Volume",false,14],["force","Force Index","Volume",false,13],["eom","Ease of Movement","Volume",false,14],["vpt","Volume Price Trend","Volume",false,14],["volosc","Volume Oscillator","Volume",false,20],["relvol","Relative Volume","Volume",false,20],["avwap","Anchored VWAP","Volume",true,30],["vp","Volume Profile (POC / VAH / VAL)","Volume",true,100],
["pivot","Pivot High/Low","Market Structure",true,2],["fractals","Fractals","Market Structure",true,2],["zigzag","Zig Zag","Market Structure",true,5],["swings","Swing High/Low","Market Structure",true,2],["hhll","HH / HL / LH / LL","Market Structure",true,2],["support","Support / Resistance","Market Structure",true,20]
];
const REG={};
defs.forEach(d=>REG[d[0]]={id:d[0],name:d[1],category:d[2],overlay:d[3],period:d[4]});
global.NTC_INDICATORS={registry:REG,defs,calculate:calc,mapSeries};
})(window);
