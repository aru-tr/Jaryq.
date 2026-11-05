/* Dependency-free perspective renderer. All equipment uses world-space geometry. */
const LabScene=(()=>{
  let yaw=-.42,pitch=.5,zoom=1,drag=null,hits=[];
  const canvas=document.querySelector('#view');
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','3D оптикалық үстел. Құралды сүйреп жылжытыңыз; бос жерді сүйреп камераны бұрыңыз.');
  function project([x,y,z]){
    const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
    const v=y*Math.cos(pitch)+b*Math.sin(pitch),depth=-y*Math.sin(pitch)+b*Math.cos(pitch),scale=850/(1200+depth)*zoom;
    return {x:500+a*scale,y:300-v*scale,depth};
  }
  function screenPoint(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*520/r.height};}
  function redraw(){if(typeof draw==='function')draw();}
  function camera(preset){
    if(preset==='top'){pitch=Math.PI/2-.01;yaw=0;}
    if(preset==='front'){pitch=.04;yaw=-.1;}
    if(preset==='angle'){pitch=.5;yaw=-.42;}
    redraw();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||state.view!=='3d'||state.tab>2)return;
    const point=screenPoint(e),hit=hits.slice().reverse().find(h=>Math.hypot(point.x-h.p.x,point.y-h.p.y)<42);
    drag={x:e.clientX,y:e.clientY,point,item:hit?hit.i:null};
    if(hit){state.selected=hit.i;updateBench();}
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag)return;
    if(drag.item!==null){
      const p=state.positions[state.tab][drag.item],target=screenPoint(e),previous=drag.point;
      let x=(p.x-50)*10,z=(p.z-50)*4;
      const initial=project([x,30,z]),wanted={x:initial.x+target.x-previous.x,y:initial.y+target.y-previous.y};
      // Invert the perspective projection on the instrument's horizontal movement plane.
      for(let n=0;n<6;n++){
        const q=project([x,30,z]),dx=project([x+1,30,z]),dz=project([x,30,z+1]);
        const a=dx.x-q.x,b=dz.x-q.x,c=dx.y-q.y,d=dz.y-q.y,det=a*d-b*c;
        if(Math.abs(det)<1e-6)break;
        const u=wanted.x-q.x,v=wanted.y-q.y;x+=(u*d-v*b)/det;z+=(v*a-u*c)/det;
      }
      moveEquipment(drag.item,x/10+50,z/4+50);drag.point=target;
    }else{
      yaw+=(e.clientX-drag.x)*.007;pitch=Math.max(-1.45,Math.min(Math.PI/2-.01,pitch-(e.clientY-drag.y)*.007));redraw();
    }
    drag.x=e.clientX;drag.y=e.clientY;
  });
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{
    if(state.view!=='3d'||state.tab>2||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0','t'].includes(e.key))return;
    e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;
    if(e.key==='ArrowUp')pitch=Math.min(Math.PI/2-.01,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(-1.45,pitch-.1);
    if(e.key==='+'||e.key==='=')zoom=Math.min(1.6,zoom+.1);if(e.key==='-')zoom=Math.max(.65,zoom-.1);
    if(e.key==='0'){yaw=-.42;pitch=.5;zoom=1;}if(e.key==='t')camera('top');redraw();
  });
  function renderScene(ctx,state,names){
    const faces=[],labels=[],t=state.tab,placed=state.assembled[t];let originZ=0;hits=[];
    function polygon(points,color,stroke='#5e8b80'){const projected=points.map(([x,y,z])=>project([x,y,z+originZ]));faces.push({points:projected,color,stroke,depth:projected.reduce((a,p)=>a+p.depth,0)/points.length});}
    function box(x,y,z,w,h,d,color){const v=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];[[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7]].forEach((f,i)=>polygon(f.map(k=>v[k]),[color,color,'#28473f','#355b50','#527969'][i]));}
    box(0,-125,0,1080,25,360,'#203c35');
    for(let x=-480;x<=480;x+=60)polygon([[x,-99,-165],[x+1,-99,-165],[x+1,-99,165],[x,-99,165]],'#365349','#365349');
    for(let z=-150;z<=150;z+=60)polygon([[-520,-99,z],[520,-99,z],[520,-99,z+1],[-520,-99,z+1]],'#365349','#365349');
    const positions=state.positions[t].map(p=>({x:(p.x-50)*10,z:(p.z-50)*4})),I=ready()?LabPhysics.intensity(['interference','diffraction','polarization'][t],state):0;
    positions.forEach(({x,z:worldZ},i)=>{originZ=worldZ;
      if(!placed.includes(i))return;
      hits.push({i,p:project([x,30,worldZ])});
      box(x,-98,0,80,10,90,'#476a5c');box(x,-88,0,8,105,8,'#80a497');
      if(i===0){box(x,0,0,65,65,65,'#a59150');polygon([[x+34,8,-22],[x+34,57,-22],[x+34,57,22],[x+34,8,22]],'#ffe6a2','#ffe6a2');}
      else if((t===0&&(i===1||i===2))||(t===2&&(i===1||i===2))){
        const points=[],rotation=t===2&&i===2?state.alpha*Math.PI/180:0;
        for(let a=0;a<Math.PI*2+.1;a+=Math.PI/24){const y=Math.cos(a)*90,z=Math.sin(a)*90;points.push([x,30+y, z]);}
        polygon(points,t===0?'rgba(112,204,216,.28)':'rgba(93,154,130,.4)','#9adac9');
        const dy=82*Math.cos(rotation),dz=82*Math.sin(rotation);
        polygon([[x-1,30-dy,-dz-2],[x-1,30+dy,dz-2],[x-1,30+dy,dz+2],[x-1,30-dy,-dz+2]],'#c4f2d8','#c4f2d8');
      }else{
        box(x,-35,0,16,150,180,'#507568');
        if(t===1&&i===1){
          const n=state.grating?8:1;for(let a=0;a<n;a++){const z=(a-(n-1)/2)*12;polygon([[x-10,-25,z-2],[x-10,100,z-2],[x-10,100,z+2],[x-10,-25,z+2]],'#ffedaa','#ffedaa');}
        }else{
          polygon([[x-10,-23,-78],[x-10,101,-78],[x-10,101,78],[x-10,-23,78]],'#162720');
          const size=10+35*Math.sqrt(I),color=`rgba(249,224,116,${.08+.9*I})`;
          polygon([[x-11,30-size,-size],[x-11,30+size,-size],[x-11,30+size,size],[x-11,30-size,size]],color,color);
        }
      }
      labels.push({p:project([x,-145,90+worldZ]),text:names[i],color:'#d5e6dc'});
    });
    originZ=0;
    if(ready()){
      for(let i=0;i<3;i++){
        const a=positions[i].x+15,b=positions[i+1].x-10,za=positions[i].z,zb=positions[i+1].z,alpha=t===2&&i===2?.65*I:.24;
        polygon([[a,10,za-8],[b,10,zb-8],[b,50,zb+8],[a,50,za+8]],`rgba(255,231,134,${alpha})`,'transparent');
      }
    }
    faces.sort((a,b)=>b.depth-a.depth).forEach(f=>{ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.stroke;ctx.lineWidth=1;ctx.stroke();});
    ctx.font='15px Arial';ctx.textAlign='center';labels.forEach(l=>{ctx.fillStyle=l.color;ctx.fillText(l.text,l.p.x,l.p.y);});ctx.textAlign='left';
    ctx.fillStyle='#a6c9b9';ctx.font='14px Arial';ctx.fillText('3D · Құралды сүйреп жылжытыңыз · Бос жерді сүйреп камераны бұрыңыз',35,35);
    ctx.fillText(ready()?'Жарық жолы дайын · Датчик I/I₀ = '+I.toFixed(4):'Құралдарды жарық осіне туралаңыз',35,490);
    if(t<2&&ready()){
      ctx.fillStyle='#0a1517';ctx.fillRect(735,65,250,155);ctx.drawImage(patternSurface(),740,90,240,128);
      ctx.fillStyle='#d5e6dc';ctx.fillText('Экрандағы жарық көрінісі',745,82);
    }
  }
  return {draw:renderScene,camera,project};
})();
