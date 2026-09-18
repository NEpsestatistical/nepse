/* NTC Drawing Settings Panel — small floating popover shown when a drawing
   (trend line, rectangle, fib, etc.) is selected. Lets the user change its
   color and line width, toggle lock, or delete it — without touching any
   data-feed / worker configuration. */
(function(global){
  "use strict";
  const COLORS=["#2962FF","#FF9800","#AB47BC","#26A69A","#EF5350","#42A5F5","#FFCA28","#EC407A","#FFFFFF","#787B86"];
  const WIDTHS=[1,2,3,4];

  class DrawingPanel{
    constructor(){
      this.el=document.createElement("div");
      this.el.className="ntc-drawing-panel";
      this.el.style.display="none";
      document.body.appendChild(this.el);
      this._engine=null;this._drawing=null;
      // Reposition on scroll/resize while visible.
      window.addEventListener("resize",()=>this._reposition());
      document.addEventListener("scroll",()=>this._reposition(),true);
    }

    show(drawing,engine){
      this._drawing=drawing;this._engine=engine;
      this._renderContent();
      this.el.style.display="block";
      this._reposition();
    }

    hide(){
      this.el.style.display="none";
      this._engine=null;this._drawing=null;
    }

    _renderContent(){
      const d=this._drawing;if(!d)return;
      const swatches=COLORS.map(c=>`<button class="ntc-dp-swatch${c.toLowerCase()===String(d.color||"").toLowerCase()?" active":""}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("");
      const widths=WIDTHS.map(w=>`<button class="ntc-dp-width${(d.width||1)===w?" active":""}" data-width="${w}" title="Width ${w}"><span style="height:${w}px"></span></button>`).join("");
      const dashes=[["solid","Solid"],["dashed","Dashed"],["dotted","Dotted"]].map(([id,label])=>`<button class="ntc-dp-dash${(d.dash||"solid")===id?" active":""}" data-dash="${id}">${label}</button>`).join("");
      this.el.innerHTML=`
        <div class="ntc-dp-row ntc-dp-colors">${swatches}</div>
        <div class="ntc-dp-row ntc-dp-widths">${widths}</div>
        <div class="ntc-dp-row ntc-dp-dashes">${dashes}</div>
        <div class="ntc-dp-row ntc-dp-actions">
          <button class="ntc-dp-lock" title="${d.locked?"Unlock":"Lock"}">${d.locked?"🔒 Locked":"🔓 Lock"}</button>
          <button class="ntc-dp-delete" title="Delete" ${d.locked?"disabled":""}>🗑 Delete</button>
        </div>`;
      this.el.querySelectorAll(".ntc-dp-swatch").forEach(btn=>{
        btn.addEventListener("click",()=>{this._engine&&this._engine.updateSelected({color:btn.dataset.color});});
      });
      this.el.querySelectorAll(".ntc-dp-width").forEach(btn=>{
        btn.addEventListener("click",()=>{this._engine&&this._engine.updateSelected({width:Number(btn.dataset.width)});});
      });
      this.el.querySelectorAll(".ntc-dp-dash").forEach(btn=>{
        btn.addEventListener("click",()=>{this._engine&&this._engine.updateSelected({dash:btn.dataset.dash});});
      });
      this.el.querySelector(".ntc-dp-lock").addEventListener("click",()=>{
        if(!this._engine)return;this._engine.updateSelected({locked:!d.locked});
      });
      this.el.querySelector(".ntc-dp-delete").addEventListener("click",()=>{
        if(!this._engine)return;this._engine.deleteSelected();this.hide();
      });
    }

    _reposition(){
      if(this.el.style.display==="none"||!this._engine||!this._drawing)return;
      const engine=this._engine,d=this._drawing;
      let pt;
      try{pt=engine.xyOf(d.a);}catch(e){pt=null;}
      const rect=engine.container.getBoundingClientRect();
      if(!pt||pt.x==null||pt.y==null){
        // Fallback: anchor near the top-left of the chart container.
        this.el.style.left=(rect.left+12)+"px";
        this.el.style.top=(rect.top+12)+"px";
        return;
      }
      const panelW=this.el.offsetWidth||190,panelH=this.el.offsetHeight||90;
      let left=rect.left+pt.x+10,top=rect.top+pt.y-panelH/2;
      // Keep the popover inside the viewport.
      left=Math.min(Math.max(8,left),window.innerWidth-panelW-8);
      top=Math.min(Math.max(8,top),window.innerHeight-panelH-8);
      this.el.style.left=left+"px";
      this.el.style.top=top+"px";
    }
  }

  global.NTC_DrawingPanel=new DrawingPanel();
})(window);
