const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../lab-physics.js');
const p={gap:0,angle:0,wavelength:550,light:'mono',position:0,slit:.5,distance:1,grating:false,alpha:0,imax:100};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('thin-film phase reversal gives dark zero and bright quarter wavelength',()=>{
 near(P.intensity('interference',p),0);
 near(P.intensity('interference',{...p,gap:.1375}),1);
 near(P.intensity('interference',{...p,gap:.275}),0);
 near(P.intensity('interference',{...p,gap:.275,angle:60}),1);
});
test('single slit center, exact first minimum, symmetry and distance dependence',()=>{
 near(P.intensity('diffraction',p),1);
 const sine=550e-9/(.5e-3),x=1000*sine/Math.sqrt(1-sine*sine);
 near(P.intensity('diffraction',{...p,position:x}),0);
 near(P.intensity('diffraction',{...p,position:-x}),0);
 near(P.intensity('diffraction',{...p,position:x*2,distance:2}),0);
 assert.ok(P.intensity('diffraction',{...p,position:x,distance:2})>.3);
});
test('grating central limit, diffraction orders and spectral averaging',()=>{
 near(P.intensity('diffraction',{...p,grating:true}),1);
 const sine=550e-9/1e-5,x=1000*sine/Math.sqrt(1-sine*sine);
 assert.ok(P.intensity('diffraction',{...p,grating:true,position:x})>.8);
 for(const kind of ['interference','diffraction'])for(const r of P.sweep(kind,{...p,light:'white'}))assert.ok(Number.isFinite(r.ratio)&&r.ratio>=0&&r.ratio<=1);
});
test('Malus law and sweep endpoints, exact count, independent snapshots',()=>{
 for(const [alpha,ratio]of [[0,1],[90,0],[180,1],[270,0],[360,1]])near(P.intensity('polarization',{...p,alpha}),ratio);
 for(const kind of ['interference','diffraction','polarization']){
   const rows=P.sweep(kind,p);assert.equal(rows.length,25);near(rows[0].u,0);near(rows[24].u,1);
   assert.notEqual(rows[0],rows[1]);
 }
 const row=P.sample('polarization',{...p,alpha:60,imax:80});near(row.i,20);near(row.sq,.25);
});

test('recorded samples exclude application state and remain serializable',()=>{
 const application={...p,data:[[],[],[]],rows:[]};
 const row=P.sample('polarization',application);application.rows.push(row);application.data[2]=application.rows;
 assert.doesNotThrow(()=>JSON.stringify(application.data));
 assert.equal('data' in row,false);assert.equal('rows' in row,false);
});
