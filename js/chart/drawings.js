/* NTC Drawing Engine — persistent chart drawings with select/edit interaction. */
(function(global){
  "use strict";
  const KEY=()=>global.NTC_CONFIG.STORAGE_PREFIX+"drawings_v1";
  const COLORS=["#2962FF","#FF9800","#AB47BC","#26A69A","#EF5350","#42A5F5"];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const FIB_LEVELS=[0,.236,.382,.5,.618,.786,1];
  const FIBEXT_LEVELS=[0,.236,.382,.5,.618,.786,1,1.272,1.414,1.618,2,2.618];
  const POINTS_NEEDED={channel:3};

  class DrawingEngine{
    constructor({container,chart,series,symbol,onChange}){
      this.container=container;this.chart=chart;this.series=series;this.symbol=symbol;this.onChange=onChange||(()=>{});
      this.tool="cursor";this.points=[];this.drawings=[];this.selected=null;this.hidden=false;this.locked=false;this.drag=null;
      this._makeSvg();this._bind();this.load(symbol);
    }

    _makeSvg(){
      this.svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      this.svg.classList.add("ntc-drawing-layer");this.svg.setAttribute("aria-hidden","true");
      this.container.appendChild(this.svg);
    }

    _bind(){
      this._chartClick=(param)=>{
        if(this.tool==="cursor"||this.locked)return;
        const point=param&&param.point;
        if(!point||point.x==null||point.y==null)return;
        this._placeAt(Number(point.x),Number(point.y));
      };
      // Keep the native chart callback as a secondary path, but use a capture-phase
      // DOM click handler as the primary placement path. This is reliable even when
      // a chart/library interaction consumes or suppresses its own click callback.
      this.chart.subscribeClick(this._chartClick);
      this._domClick=(e)=>{
        if(this.tool==="cursor"||this.locked)return;
        if(e.button!=null && e.button!==0)return;
        const r=this.container.getBoundingClientRect();
        const x=e.clientX-r.left, y=e.clientY-r.top;
        if(x<0||y<0||x>r.width||y>r.height)return;
        e.preventDefault();
        e.stopPropagation();
        this._placeAt(x,y,true);
      };
      this.container.addEventListener("click",this._domClick,true);
      this._move=()=>this.render();
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(this._move);

      this._pointerMove=(e)=>this._dragMove(e);
      this._pointerUp=(e)=>this._dragEnd(e);
      this.documentPointerDown=(e)=>{
        if(this.tool!=="cursor"||this.hidden||this.locked)return;
        if(e.button!=null&&e.button!==0)return;
        // Selection is done with a geometry hit-test instead of relying on SVG
        // pointer-events, so an invisible SVG layer can never disable chart panning.
        const r=this.container.getBoundingClientRect();
        const x=e.clientX-r.left,y=e.clientY-r.top;
        const hit=this._hitTest(x,y);
        if(hit){e.preventDefault();e.stopPropagation();this._startDragFromPoint(e,hit.id,x,y);}
        else if(this.selected){this.selected=null;this.render();}
      };
      this.container.addEventListener("pointerdown",this.documentPointerDown,true);
      document.addEventListener("pointermove",this._pointerMove,{passive:false});
      document.addEventListener("pointerup",this._pointerUp,{passive:false});
    }

    _placeAt(x,y,fromDom=false){
      const p=this._anchor(x,y);if(!p)return;
      // The DOM fallback and the native chart callback can both fire for one click.
      // Suppress duplicate placement within the same animation frame.
      if(fromDom){this._lastDomPoint={x,y,at:performance.now()};}
      else if(this._lastDomPoint){
        const q=this._lastDomPoint;if(performance.now()-q.at<40&&Math.abs(q.x-x)<2&&Math.abs(q.y-y)<2)return;
      }
      this.points.push(p);
      const need=POINTS_NEEDED[this.tool]||2;
      if(["horizontal","vertical","text"].includes(this.tool)||this.points.length>=need)this._finish();
      this.render();
    }

    _anchor(x,y){
      try{const price=this.series.coordinateToPrice(y),time=this.chart.timeScale().coordinateToTime(x);if(price==null||time==null)return null;return {time:Number(time),price:Number(price)}}catch(e){return null}
    }

    _find(id){return this.drawings.find(d=>d.id===id)||null}

    setTool(tool){
      this.tool=tool;this.points=[];
      if(tool!=="cursor")this.selected=null;
      this.container.classList.toggle("ntc-drawing-active",tool!=="cursor");
      this.render();
    }

    _finish(){
      const a=this.points[0],b=this.points[1]||a;
      let d={id:"d"+Date.now()+Math.random().toString(16).slice(2),type:this.tool,a,b,color:COLORS[this.drawings.length%COLORS.length],width:1};
      if(this.tool==="text")d.text=prompt("Text:","")||"";
      if(this.tool==="horizontal")d.b={time:b.time,price:a.price};
      if(this.tool==="vertical")d.b={time:a.time,price:b.price};
      if(this.tool==="fib")d.levels=FIB_LEVELS.slice();
      if(this.tool==="fibext")d.levels=FIBEXT_LEVELS.slice();
      if(this.tool==="measure"){d.deltaPrice=b.price-a.price;d.deltaPct=a.price?d.deltaPrice/a.price*100:0;}
      if(this.tool==="channel"){d.b=this.points[1];d.c=this.points[2]||this.points[1];}
      this.drawings.push(d);this.points=[];this.tool="cursor";this.container.classList.remove("ntc-drawing-active");
      this.save();this.onChange(this.drawings);this.render();
    }

    _xy(p){return {x:this.chart.timeScale().timeToCoordinate(p.time),y:this.series.priceToCoordinate(p.price)}}
    _el(tag,attrs){const e=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,String(v)));this.svg.appendChild(e);return e}
    _hit(el,id,kind="stroke"){
      el.dataset.drawingId=id;el.dataset.hit=kind;el.classList.add("ntc-drawing-hit");
      el.style.pointerEvents="none";
      return el;
    }

    _hitTest(x,y){
      const tol=8;
      let best=null,bestDist=Infinity;
      const distSeg=(px,py,ax,ay,bx,by)=>{
        const dx=bx-ax,dy=by-ay;
        if(dx===0&&dy===0)return Math.hypot(px-ax,py-ay);
        const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
        return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
      };
      for(let i=this.drawings.length-1;i>=0;i--){
        const d=this.drawings[i];
        if(!d||d.locked)continue;
        const a=this._xy(d.a),b=this._xy(d.b);if(!a||!b||a.x==null||a.y==null||b.x==null||b.y==null)continue;
        let dist=Infinity;
        if(d.type==="horizontal")dist=Math.abs(y-a.y);
        else if(d.type==="vertical")dist=Math.abs(x-a.x);
        else if(d.type==="rectangle"){
          const rx=Math.min(a.x,b.x),ry=Math.min(a.y,b.y),rw=Math.abs(b.x-a.x),rh=Math.abs(b.y-a.y);
          const inside=x>=rx&&x<=rx+rw&&y>=ry&&y<=ry+rh;
          if(inside)dist=0;
          else dist=Math.min(Math.hypot(x-rx,y-ry),Math.hypot(x-(rx+rw),y-ry),Math.hypot(x-rx,y-(ry+rh)),Math.hypot(x-(rx+rw),y-(ry+rh)));
        } else if(d.type==="fib"||d.type==="fibext"){
          const diff=d.b.price-d.a.price;
          for(const l of (d.levels||FIB_LEVELS)){
            const yy=this.series.priceToCoordinate(d.a.price+diff*l);
            if(yy!=null)dist=Math.min(dist,Math.abs(y-yy));
          }
        } else if(d.type==="ellipse"){
          const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(b.x-a.x)/2||1,ry=Math.abs(b.y-a.y)/2||1;
          const nx=(x-cx)/rx,ny=(y-cy)/ry,r=Math.hypot(nx,ny);
          dist=Math.abs(r-1)*Math.min(rx,ry);
        } else if(d.type==="channel"){
          const c=this._xy(d.c||d.b);
          const off=c&&c.y!=null?c.y-a.y-(b.y-a.y)*((c.x-a.x)/((b.x-a.x)||1)):0;
          dist=Math.min(distSeg(x,y,a.x,a.y,b.x,b.y),distSeg(x,y,a.x,a.y+off,b.x,b.y+off));
        } else if(d.type==="text"){
          const w=Math.max(28,(d.text||"Text").length*7+8);dist=(x>=a.x-8&&x<=a.x+w&&y>=a.y-20&&y<=a.y+4)?0:Math.hypot(x-a.x,y-a.y);
        } else dist=distSeg(x,y,a.x,a.y,b.x,b.y);
        if(dist<=tol&&dist<bestDist){bestDist=dist;best={id:d.id};}
      }
      return best;
    }

    _drawCommon(d){return {stroke:d.color,fill:"none","stroke-width":d.width||1,"vector-effect":"non-scaling-stroke"}}

    render(){
      this.svg.innerHTML="";
      this.svg.style.pointerEvents="none";
      if(this.hidden)return;
      for(const d of this.drawings){
        const a=this._xy(d.a),b=this._xy(d.b);if(a.x==null||a.y==null||b.x==null||b.y==null)continue;
        const common=this._drawCommon(d), selected=this.selected===d.id;
        if(d.type==="trend"||d.type==="ray"){
          let x2=b.x,y2=b.y;
          if(d.type==="ray"){const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>0.001){x2=dx>0?this.container.clientWidth:0;y2=a.y+dy/dx*(x2-a.x)}}
          this._el("line",{...common,x1:a.x,y1:a.y,x2,y2});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:a.y,x2,y2}),d.id);
        } else if(d.type==="horizontal"){
          this._el("line",{...common,x1:0,y1:a.y,x2:this.container.clientWidth,y2:a.y});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:0,y1:a.y,x2:this.container.clientWidth,y2:a.y}),d.id);
        } else if(d.type==="vertical"){
          this._el("line",{...common,x1:a.x,y1:0,x2:a.x,y2:this.container.clientHeight});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:0,x2:a.x,y2:this.container.clientHeight}),d.id);
        } else if(d.type==="rectangle"){
          const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
          this._el("rect",{...common,x,y,width:w,height:h});
          this._hit(this._el("rect",{stroke:"transparent","stroke-width":8,fill:"transparent",x,y,width:w,height:h},),d.id,"fill");
        } else if(d.type==="fib"||d.type==="fibext"){
          const diff=d.b.price-d.a.price;
          const levels=d.levels||(d.type==="fibext"?FIBEXT_LEVELS:FIB_LEVELS);
          levels.forEach((l,i)=>{
            const price=d.a.price+diff*l,y=this.series.priceToCoordinate(price);if(y==null)return;
            const attrs={...common,opacity:l===0||l===1?.9:.55,x1:0,y1:y,x2:this.container.clientWidth,y2:y};
            this._el("line",attrs);
            this._hit(this._el("line",{stroke:"transparent","stroke-width":10,fill:"none",x1:0,y1:y,x2:this.container.clientWidth,y2:y}),d.id);
            const t=this._el("text",{x:Math.min(a.x+6,this.container.clientWidth-70),y:y-3,fill:d.color,"font-size":10,stroke:"none"});t.textContent=(l*100).toFixed(1)+"%";
          });
        } else if(d.type==="ellipse"){
          const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(b.x-a.x)/2,ry=Math.abs(b.y-a.y)/2;
          this._el("ellipse",{...common,cx,cy,rx,ry});
          this._hit(this._el("ellipse",{stroke:"transparent","stroke-width":8,fill:"transparent",cx,cy,rx,ry}),d.id);
        } else if(d.type==="arrow"){
          this._el("line",{...common,x1:a.x,y1:a.y,x2:b.x,y2:b.y});
          const ang=Math.atan2(b.y-a.y,b.x-a.x),len=10,spread=.5;
          const p1x=b.x-len*Math.cos(ang-spread),p1y=b.y-len*Math.sin(ang-spread);
          const p2x=b.x-len*Math.cos(ang+spread),p2y=b.y-len*Math.sin(ang+spread);
          this._el("polygon",{points:`${b.x},${b.y} ${p1x},${p1y} ${p2x},${p2y}`,fill:d.color,stroke:"none"});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:a.y,x2:b.x,y2:b.y}),d.id);
        } else if(d.type==="channel"){
          const c=this._xy(d.c||d.b);
          const off=(c&&c.y!=null)?c.y-a.y-(b.y-a.y)*((c.x-a.x)/((b.x-a.x)||1)):0;
          this._el("line",{...common,x1:a.x,y1:a.y,x2:b.x,y2:b.y});
          this._el("line",{...common,opacity:.7,x1:a.x,y1:a.y+off,x2:b.x,y2:b.y+off});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:a.y,x2:b.x,y2:b.y}),d.id);
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:a.y+off,x2:b.x,y2:b.y+off}),d.id);
        } else if(d.type==="text"){
          const t=this._el("text",{x:a.x,y:a.y,fill:d.color,"font-size":12,stroke:"none"});t.textContent=d.text||"Text";
          this._hit(this._el("rect",{x:a.x-8,y:a.y-16,width:Math.max(28,(d.text||"Text").length*7+8),height:20,fill:"transparent",stroke:"transparent"}),d.id,"fill");
        } else if(d.type==="measure"){
          this._el("line",{...common,"stroke-dasharray":"4 3",x1:a.x,y1:a.y,x2:b.x,y2:b.y});
          this._hit(this._el("line",{stroke:"transparent","stroke-width":12,fill:"none",x1:a.x,y1:a.y,x2:b.x,y2:b.y}),d.id);
          const t=this._el("text",{x:b.x+5,y:b.y-5,fill:d.color,"font-size":10,stroke:"none"});t.textContent=`Δ ${d.deltaPrice>=0?"+":""}${d.deltaPrice.toFixed(2)} (${d.deltaPct.toFixed(2)}%)`;
        }
        if(selected){
          const color=this.locked?"#777":d.color;
          this._el("circle",{cx:a.x,cy:a.y,r:5,fill:"none",stroke:color,"stroke-width":1.5});
          if(d.type!=="horizontal"&&d.type!=="vertical"&&d.type!=="text")this._el("circle",{cx:b.x,cy:b.y,r:5,fill:"none",stroke:color,"stroke-width":1.5});
        }
      }
      this.svg.style.pointerEvents=this.tool==="cursor"&&!this.locked?"none":"none";
    }

    select(id){if(!this._find(id))return false;this.selected=id;this.render();return true}

    _startDrag(e,id){
      const r=this.container.getBoundingClientRect();
      this._startDragFromPoint(e,id,e.clientX-r.left,e.clientY-r.top);
    }

    _startDragFromPoint(e,id,x,y){
      if(this.tool!=="cursor"||this.hidden)return;
      const d=this._find(id);if(!d||d.locked)return;
      e.preventDefault();e.stopPropagation();this.selected=id;this.render();
      const p=this._anchor(x,y);if(!p)return;
      this.drag={id,start:p,origA:{...d.a},origB:{...d.b},moved:false};this.container.classList.add("ntc-drawing-dragging");
    }

    _dragMove(e){
      if(!this.drag)return;
      const d=this._find(this.drag.id);if(!d){this._dragEnd();return;}
      if(this.locked)return;
      const r=this.container.getBoundingClientRect(),p=this._anchor(e.clientX-r.left,e.clientY-r.top);if(!p)return;
      const dt=p.time-this.drag.start.time,dp=p.price-this.drag.start.price;
      if(Math.abs(dt)+Math.abs(dp)>0){e.preventDefault();e.stopPropagation();this.drag.moved=true;}
      if(d.type==="horizontal"){
        d.a.price=this.drag.origA.price+dp;d.b.price=this.drag.origB.price+dp;
      } else if(d.type==="vertical"){
        d.a.time=this.drag.origA.time+dt;d.b.time=this.drag.origB.time+dt;
      } else {
        d.a={time:this.drag.origA.time+dt,price:this.drag.origA.price+dp};
        d.b={time:this.drag.origB.time+dt,price:this.drag.origB.price+dp};
      }
      this.render();
    }

    _dragEnd(){
      if(!this.drag)return;
      const moved=this.drag.moved;this.drag=null;this.container.classList.remove("ntc-drawing-dragging");
      if(moved){const d=this._find(this.selected);if(d&&d.type==="measure"){d.deltaPrice=d.b.price-d.a.price;d.deltaPct=d.a.price?d.deltaPrice/d.a.price*100:0;}this.save();this.onChange(this.drawings);this.render();}
    }

    deleteSelected(){
      if(!this.selected||this.locked)return false;
      const idx=this.drawings.findIndex(d=>d.id===this.selected);if(idx<0){this.selected=null;return false;}
      this.drawings.splice(idx,1);this.selected=null;this.save();this.onChange(this.drawings);this.render();return true;
    }

    load(symbol){try{const all=JSON.parse(localStorage.getItem(KEY())||"{}");this.drawings=Array.isArray(all[symbol])?all[symbol]:[];}catch(e){this.drawings=[]}this.selected=null;this.render()}
    save(){try{const all=JSON.parse(localStorage.getItem(KEY())||"{}");all[this.symbol]=this.drawings;localStorage.setItem(KEY(),JSON.stringify(all))}catch(e){}}
    setSymbol(symbol){this.symbol=symbol;this.points=[];this.selected=null;this.load(symbol)}
    setSeries(series){this.series=series;this.render()}
    clear(){this.drawings=[];this.selected=null;this.save();this.render();this.onChange(this.drawings)}
    hide(){this.hidden=!this.hidden;this.render();return this.hidden}
    lock(){this.locked=!this.locked;this.render();return this.locked}
    deleteLast(){if(this.drawings.length&&!this.locked){this.drawings.pop();this.selected=null;this.save();this.render();this.onChange(this.drawings)}}
    destroy(){
      try{this.chart.unsubscribeClick(this._chartClick)}catch(e){}
      this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this._move);
      this.container.removeEventListener("click",this._domClick,true);
      this.container.removeEventListener("pointerdown",this.documentPointerDown,true);
      document.removeEventListener("pointermove",this._pointerMove);
      document.removeEventListener("pointerup",this._pointerUp);
      this.svg.remove();
    }
  }
  global.NTC_DrawingEngine=DrawingEngine;
})(window);
