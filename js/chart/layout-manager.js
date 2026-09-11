/* NTC Phase 6 — multi-chart workspace manager. */
(function(global){
  "use strict";
  const LAYOUTS={
    "1": {cols:1,rows:1}, "2h":{cols:2,rows:1}, "2v":{cols:1,rows:2},
    "4":{cols:2,rows:2}, "6":{cols:3,rows:2}, "8":{cols:4,rows:2},
    "12":{cols:4,rows:3}, "16":{cols:4,rows:4}
  };
  class LayoutManager{
    constructor({root,onActiveChange,onCreate,onDestroy}){this.root=root;this.onActiveChange=onActiveChange||(()=>{});this.onCreate=onCreate||(()=>{});this.onDestroy=onDestroy||(()=>{});this.items=[];this.active=0;this.layout="1";this._renderGrid()}
    _renderGrid(){const l=LAYOUTS[this.layout]||LAYOUTS["1"];this.root.style.setProperty("--ntc-layout-cols",l.cols);this.root.style.setProperty("--ntc-layout-rows",l.rows)}
    setLayout(layout){if(!LAYOUTS[layout])return;if(layout===this.layout && this.items.length)return;const old=this.items.slice();this.layout=layout;const n=LAYOUTS[layout].cols*LAYOUTS[layout].rows;while(this.items.length<n){const item=this.onCreate(this.items.length);this.items.push(item)}while(this.items.length>n){const item=this.items.pop();this.onDestroy(item)}this.active=Math.min(this.active,this.items.length-1);this._renderGrid();this.items.forEach((x,i)=>{x.card.classList.toggle("active",i===this.active);const b=x.head&&x.head.querySelector("button");if(b)b.textContent=i===this.active?"ACTIVE":"SELECT"});this.onActiveChange(this.items[this.active],this.active)}
    addInitial(item){this.items.push(item);item.card.classList.toggle("active",this.items.length===1)}
    setActive(index){index=Math.max(0,Math.min(index,this.items.length-1));if(index===this.active)return;this.active=index;this.items.forEach((x,i)=>x.card.classList.toggle("active",i===index));this.onActiveChange(this.items[index],index)}
    getActive(){return this.items[this.active]||null}
    getLayout(){return this.layout}
    destroy(){this.items.forEach(x=>this.onDestroy(x));this.items=[]}
  }
  global.NTC_LAYOUTS=LAYOUTS; global.NTC_LayoutManager=LayoutManager;
})(window);
