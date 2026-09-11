/* NTC Phase 8 — local paper-trading engine. No broker/TMS connectivity. */
(function(global){
  "use strict";
  const KEY=(global.NTC_CONFIG&&global.NTC_CONFIG.STORAGE_PREFIX||"ntc_")+"paper_v1";
  const DEFAULT={startingCash:1000000,cash:1000000,feesBps:10,slippageBps:5,positions:{},orders:[],trades:[],accountHistory:[]};
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&typeof x==="object"?Object.assign(clone(DEFAULT),x):clone(DEFAULT)}catch(e){return clone(DEFAULT)}}
  let S=read();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
  function now(){return new Date().toISOString()}
  function fee(notional){return notional*num(S.feesBps)/10000}
  function slip(price,side){const b=num(S.slippageBps)/10000;return price*(1+(side==="buy"?b:-b))}
  function pos(sym){if(!S.positions[sym])S.positions[sym]={symbol:sym,qty:0,avgPrice:0,lastPrice:0,realizedPnl:0};return S.positions[sym]}
  function equity(prices){let e=num(S.cash);Object.values(S.positions).forEach(p=>{if(p.qty)e+=p.qty*num(prices&&prices[p.symbol],p.lastPrice||p.avgPrice)});return e}
  function fill(order,rawPrice,reason){
    const side=order.side, price=slip(num(rawPrice),side), qty=Math.floor(num(order.qty)); if(qty<=0||price<=0)return false;
    const p=pos(order.symbol), priorAvg=p.avgPrice, notional=price*qty, costs=fee(notional);
    if(side==="buy"){
      if(S.cash+1e-9 < notional+costs)return false;
      const oldCost=p.qty*p.avgPrice; p.avgPrice=(oldCost+notional)/(p.qty+qty||1); p.qty+=qty; S.cash-=notional+costs;
    }else{
      if(p.qty<qty)return false;
      const pnl=(price-p.avgPrice)*qty-costs; p.realizedPnl+=pnl; S.cash+=notional-costs; p.qty-=qty; if(!p.qty)p.avgPrice=0;
    }
    p.lastPrice=price;
    if(side==="buy" && (order.stopLoss||order.takeProfit)){ if(order.stopLoss) p.stopLoss=order.stopLoss; if(order.takeProfit) p.takeProfit=order.takeProfit; }
    const realized=side==="sell"?(price-priorAvg)*qty-costs:0;
    order.status="filled";order.fillPrice=price;order.filledAt=now();order.reason=reason||"market";order.fees=costs;
    S.trades.unshift({id:"t"+Date.now()+Math.random().toString(16).slice(2),orderId:order.id,symbol:order.symbol,side,qty,price,fees:costs,realizedPnl:realized,time:now()});
    S.accountHistory.unshift({time:now(),type:"fill",symbol:order.symbol,side,qty,price,fees:costs,cash:S.cash,equity:equity({[order.symbol]:price})});
    return true;
  }
  const Paper={
    getState(){return clone(S)},
    getAccount(prices){const unreal=Object.values(S.positions).reduce((a,p)=>p.qty?a+(num(prices&&prices[p.symbol],p.lastPrice||p.avgPrice)-p.avgPrice)*p.qty: a,0);return {cash:S.cash,equity:equity(prices),unrealizedPnl:unreal,realizedPnl:Object.values(S.positions).reduce((a,p)=>a+p.realizedPnl,0),buyingPower:S.cash,startingCash:S.startingCash}},
    configure(opts){if(opts&&opts.feesBps!=null)S.feesBps=Math.max(0,num(opts.feesBps));if(opts&&opts.slippageBps!=null)S.slippageBps=Math.max(0,num(opts.slippageBps));if(opts&&opts.startingCash!=null){const n=Math.max(0,num(opts.startingCash));if(n>0)S.startingCash=n;}save();return this.getAccount()},
    reset(){S=clone(DEFAULT);save();return this.getState()},
    deposit(amount){amount=Math.max(0,num(amount));S.cash+=amount;S.accountHistory.unshift({time:now(),type:"deposit",amount,cash:S.cash});save();return this.getAccount()},
    withdraw(amount){amount=Math.max(0,num(amount));if(amount>S.cash)return false;S.cash-=amount;S.accountHistory.unshift({time:now(),type:"withdraw",amount,cash:S.cash});save();return true},
    place({symbol,side,type,qty,limitPrice,stopPrice,stopLoss,takeProfit}){
      symbol=String(symbol||"").toUpperCase();side=side==="sell"?"sell":"buy";type=(type||"market").toLowerCase();qty=Math.floor(num(qty));
      if(!symbol||qty<1)throw new Error("Enter a valid symbol and quantity.");
      if(!["market","limit","stop","stop_limit"].includes(type))throw new Error("Unsupported order type.");
      if((type==="limit"||type==="stop_limit")&&num(limitPrice)<=0)throw new Error("Limit price is required.");
      if((type==="stop"||type==="stop_limit")&&num(stopPrice)<=0)throw new Error("Stop price is required.");
      if(side==="sell"&&pos(symbol).qty<qty)throw new Error("Not enough shares to sell.");
      const o={id:"o"+Date.now()+Math.random().toString(16).slice(2),symbol,side,type,qty,limitPrice:num(limitPrice),stopPrice:num(stopPrice),stopLoss:num(stopLoss),takeProfit:num(takeProfit),status:"open",createdAt:now()};
      S.orders.unshift(o);save();return clone(o)
    },
    cancel(id){const o=S.orders.find(x=>x.id===id);if(!o||o.status!=="open")return false;o.status="cancelled";o.cancelledAt=now();save();return true},
    closePosition(symbol,price){const p=pos(symbol);if(!p.qty)throw new Error("No open position.");const o=this.place({symbol,side:"sell",type:"market",qty:p.qty});this.processQuote(symbol,price);return o},
    processQuote(symbol,quote){symbol=String(symbol||"").toUpperCase();if(!quote)return;const price=num(quote.close!=null?quote.close:quote.ltp);if(price<=0)return;const p=pos(symbol);p.lastPrice=price;
      for(const o of S.orders.filter(x=>x.status==="open"&&x.symbol===symbol)){
        let should=false,fillPrice=price;
        if(o.type==="market")should=true;
        else if(o.type==="limit")should=o.side==="buy"?price<=o.limitPrice:price>=o.limitPrice,fillPrice=o.limitPrice;
        else if(o.type==="stop")should=o.side==="buy"?price>=o.stopPrice:price<=o.stopPrice;
        else if(o.type==="stop_limit")should=o.side==="buy"?price>=o.stopPrice&&price<=o.limitPrice:price<=o.stopPrice&&price>=o.limitPrice,fillPrice=o.limitPrice;
        if(should&&!fill(o,fillPrice,"quote"))o.status="rejected";
      }
      // Position brackets use the latest quote. They are local simulation only.
      const pp=pos(symbol); if(pp.qty){if(pp.avgPrice&&pp.stopLoss&&price<=pp.stopLoss){const o={id:"br"+Date.now(),symbol,side:"sell",qty:pp.qty,status:"open",type:"market"};S.orders.unshift(o);fill(o,price,"stop-loss")}else if(pp.takeProfit&&price>=pp.takeProfit){const o={id:"br"+Date.now(),symbol,side:"sell",qty:pp.qty,status:"open",type:"market"};S.orders.unshift(o);fill(o,price,"take-profit")}}
      save();return this.getAccount({[symbol]:price})
    },
    processCandle(symbol,c){if(!c)return;this.processQuote(symbol,{close:c.close});const p=pos(symbol);if(!p.qty)return;const hi=num(c.high),lo=num(c.low);if(p.stopLoss&&lo<=p.stopLoss&&p.qty){const o={id:"sl"+Date.now(),symbol,side:"sell",qty:p.qty,status:"open",type:"market"};S.orders.unshift(o);fill(o,p.stopLoss,"stop-loss")}else if(p.takeProfit&&hi>=p.takeProfit&&p.qty){const o={id:"tp"+Date.now(),symbol,side:"sell",qty:p.qty,status:"open",type:"market"};S.orders.unshift(o);fill(o,p.takeProfit,"take-profit")}save()},
    setPositionBracket(symbol,{stopLoss,takeProfit}){const p=pos(symbol);if(!p.qty)throw new Error("No open position.");p.stopLoss=Math.max(0,num(stopLoss));p.takeProfit=Math.max(0,num(takeProfit));save();return clone(p)},
    positions(prices){return Object.values(S.positions).filter(p=>p.qty>0).map(p=>{const last=num(prices&&prices[p.symbol],p.lastPrice||p.avgPrice);return Object.assign({},p,{marketValue:last*p.qty,unrealizedPnl:(last-p.avgPrice)*p.qty,pnlPct:p.avgPrice?(last/p.avgPrice-1)*100:0})})},
    orders(filter){return S.orders.filter(o=>!filter||o.status===filter).map(clone)},
    trades(){return S.trades.map(clone)},
    history(){return S.accountHistory.map(clone)},
  };
  global.NTC_PAPER=Paper;
})(window);
