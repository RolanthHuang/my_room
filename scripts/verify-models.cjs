const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const THREE=require('three');
const root=path.resolve(__dirname,'..');
const bundle=path.join(os.tmpdir(),'my-room-sofas-'+crypto.randomUUID()+'.cjs');
const makeImage=()=>({width:512,height:256,listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},removeEventListener(k){delete this.listeners[k];},set src(v){this._src=v;queueMicrotask(()=>this.listeners.load?.call(this));},get src(){return this._src;}});
globalThis.document={createElementNS:()=>makeImage()};
esbuild.buildSync({entryPoints:[path.join(root,'src/sofas.js')],bundle:true,platform:'node',format:'cjs',outfile:bundle,loader:{'.jpg':'dataurl'}});
const {createSofa,SOFA_SPECS}=require(bundle);
const results=[];
for(const id of ['two','corner']){
 const sofa=createSofa(id),spec=SOFA_SPECS[id];sofa.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(sofa),s=b.getSize(new THREE.Vector3());
 for(const [actual,wanted,name] of [[s.x,spec.width,'width'],[s.y,spec.height,'height'],[s.z,spec.depth,'depth']])assert.ok(Math.abs(actual-wanted)<1e-6,id+' '+name+' differs from DM');
 assert.ok(Math.abs(b.min.y)<1e-6,'feet must be on floor');
 const seats=[];let vertices=0;
 sofa.traverse(o=>{if(!o.isMesh)return;for(const name of ['position','normal','uv']){const a=o.geometry.attributes[name];if(a)for(const v of a.array)assert.ok(Number.isFinite(v),id+' contains an invalid '+name);}vertices+=o.geometry.attributes.position.count;
 if(o.name.includes('座墊')&&!o.name.includes('車縫')&&!o.name.includes('接縫')){const bb=new THREE.Box3().setFromObject(o);seats.push({top:bb.max.y,depth:bb.max.z-bb.min.z});assert.ok(Math.abs(bb.max.y-.44)<.001,'seat top should be 44cm');assert.ok(Math.abs(bb.max.z-bb.min.z-spec.seatDepth)<.001,'seat depth should match stated DM depth');}});
 let armBulge=null;
 if(id==='two'){
  const arm=sofa.getObjectByName('長抱枕造型鼓起扶手'),a=arm.geometry.attributes.position,b=arm.geometry.boundingBox;
  const h=b.max.y-b.min.y,d=b.max.z-b.min.z;let middle=0,rim=0;
  for(let i=0;i<a.count;i++){const x=Math.abs(a.getX(i)),y=Math.abs(a.getY(i)),z=Math.abs(a.getZ(i));if(y<h*.1&&z<d*.1)middle=Math.max(middle,x);if(y<h*.1&&z>d*.38)rim=Math.max(rim,x);}
  assert.ok(middle-rim>.025,'arm middle must visibly swell relative to its tied ends');armBulge={middleThicknessCm:middle*200,endThicknessCm:rim*200};
 }
 results.push({id,widthCm:s.x*100,depthCm:s.z*100,heightCm:s.y*100,seats,armBulge,vertices});
}
fs.unlinkSync(bundle);
console.log(JSON.stringify({passed:true,models:results},null,2));
