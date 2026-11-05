/* Dependency-free perspective renderer. All equipment uses world-space geometry. */
const LabScene=(()=>{
  let yaw=-.42,pitch=.32,zoom=1,drag=null;
  const canvas=document.querySelector('#view');
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','3D оптикалық үстел. Бұру: сүйреу немесе бағыт пернелері. Масштаб: + және −.');
  function redraw(){if(typeof draw==='function')draw();}
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.007;pitch=Math.max(.08,Math.min(1.1,pitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY};redraw();});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')pitch=Math.min(1.1,pitch+.07);if(e.key==='ArrowDown')pitch=Math.max(.08,pitch-.07);if(e.key==='+'||e.key==='=')zoom=Math.min(1.4,zoom+.1);if(e.key==='-')zoom=Math.max(.65,zoom-.1);if(e.key==='0'){yaw=-.42;pitch=.32;zoom=1;}redraw();});
  function renderScene(ctx,state,names){
    const faces=[],labels=[],t=state.tab,placed=state.assembled[t];
    function project([x,y,z]){
      const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
      const v=y*Math.cos(pitch)-b*Math.sin(pitch),depth=y*Math.sin(pitch)+b*Math.cos(pitch),scale=850/(1200+depth)*zoom;
      return {x:500+a*scale,y:300-v*scale,depth};
    }
    function polygon(points,color,stroke='#5e8b80'){const projected=points.map(project);faces.push({points:projected,color,stroke,depth:projected.reduce((a,p)=>a+p.depth,0)/points.length});}
    function box(x,y,z,w,h,d,color){const v=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];[[0,1,2,3],[4,5,6,7],[0,4,7,3],[1,5,6,2],[3,2,6,7]].forEach((f,i)=>polygon(f.map(k=>v[k]),[color,color,'#28473f','#355b50','#527969'][i]));}
    box(0,-125,0,1080,25,360,'#203c35');
    for(let x=-480;x<=480;x+=60)polygon([[x,-99,-165],[x+1,-99,-165],[x+1,-99,165],[x,-99,165]],'#365349','#365349');
    for(let z=-150;z<=150;z+=60)polygon([[-520,-99,z],[520,-99,z],[520,-99,z+1],[-520,-99,z+1]],'#365349','#365349');
    const positions=[-400,-140,130,400],I=LabPhysics.intensity(['interference','diffraction','polarization'][t],state);
    positions.forEach((x,i)=>{
      if(!placed.includes(i)){
        polygon([[x-55,-97,-60],[x+55,-97,-60],[x+55,-97,60],[x-55,-97,60]],'#182d29','#597466');
        labels.push({p:project([x,-65,0]),text:(i+1)+' · бос орын',color:'#8da99d'});return;
      }
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
      labels.push({p:project([x,-145,90]),text:names[i],color:'#d5e6dc'});
    });
    if(placed.length===4){
      for(let i=0;i<3;i++){
        const a=positions[i]+15,b=positions[i+1]-10,alpha=t===2&&i===2?.65*I:.24;
        polygon([[a,10,-8],[b,10,-8],[b,50,8],[a,50,8]],`rgba(255,231,134,${alpha})`,'transparent');
      }
    }
    faces.sort((a,b)=>b.depth-a.depth).forEach(f=>{ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.stroke;ctx.lineWidth=1;ctx.stroke();});
    ctx.font='15px Arial';ctx.textAlign='center';labels.forEach(l=>{ctx.fillStyle=l.color;ctx.fillText(l.text,l.p.x,l.p.y);});ctx.textAlign='left';
    ctx.fillStyle='#a6c9b9';ctx.font='14px Arial';ctx.fillText('3D · Сүйреп бұрыңыз · Бағыт пернелері · + / − масштаб · 0 қалпына келтіру',35,35);
    ctx.fillText(placed.length===4?'Жарық жолы дайын · Датчик I/I₀ = '+I.toFixed(4):'Құралдарды жоғарыдағы орындарға орналастырыңыз',35,490);
  }
  return {draw:renderScene};
})();
