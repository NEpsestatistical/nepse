/* NTC Phase 10 — broker/TMS adapter boundary.
   Generic, credential-safe connector: no broker-specific endpoints are assumed.
   Secrets live in memory only for the current page session. */
(function(global){
  "use strict";
  const KEY=(global.NTC_CONFIG&&global.NTC_CONFIG.STORAGE_PREFIX||"ntc_")+"broker_v1";
  const DEFAULT={label:"Not configured",baseUrl:"",healthPath:"/",authMode:"bearer"};
  let state=Object.assign({},DEFAULT); let token="";
  try{const saved=JSON.parse(localStorage.getItem(KEY)||"null");if(saved&&typeof saved==="object")state=Object.assign({},DEFAULT,saved)}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
  function normalizeBase(u){return String(u||"").trim().replace(/\/+$/ ,"")}
  async function request(path,options){
    if(!state.baseUrl) throw new Error("Broker connector is not configured.");
    const headers=Object.assign({"Accept":"application/json"},options&&options.headers||{});
    if(token){headers.Authorization=state.authMode==="basic"?"Basic "+token:"Bearer "+token}
    const res=await fetch(normalizeBase(state.baseUrl)+(String(path||"/").startsWith("/")?path:"/"+path),Object.assign({},options,{headers,cache:"no-store"}));
    const text=await res.text(); let data=null; try{data=text?JSON.parse(text):null}catch(e){data=text}
    if(!res.ok) throw new Error(`Broker request failed (${res.status}).`);
    return data;
  }
  const api={
    getConfig(){return Object.assign({},state)},
    isConfigured(){return !!normalizeBase(state.baseUrl)},
    hasSessionSecret(){return !!token},
    configure(cfg){state=Object.assign({},state,{label:String(cfg.label||"Broker"),baseUrl:normalizeBase(cfg.baseUrl),healthPath:String(cfg.healthPath||"/"),authMode:cfg.authMode==="basic"?"basic":"bearer"});save();return api.getConfig()},
    setSessionSecret(value){token=String(value||"");return token.length>0},
    clearSessionSecret(){token=""},
    async health(){return request(state.healthPath,{method:"GET"})},
    async request(path,options){return request(path,options)},
    async placeOrder(order){return request("/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(order)})},
    async cancelOrder(id){return request(`/orders/${encodeURIComponent(id)}`,{method:"DELETE"})},
    async positions(){return request("/positions",{method:"GET"})},
    async orders(){return request("/orders",{method:"GET"})},
    disconnect(){token=""},
    reset(){state=Object.assign({},DEFAULT);token="";try{localStorage.removeItem(KEY)}catch(e){}return api.getConfig()}
  };
  global.NTC_BROKER=api;
})(window);
