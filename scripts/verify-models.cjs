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
const tableBundle=path.join(os.tmpdir(),'my-room-table-'+crypto.randomUUID()+'.cjs');
esbuild.buildSync({entryPoints:[path.join(root,'src/walnut-table.js')],bundle:true,platform:'node',format:'cjs',outfile:tableBundle,loader:{'.jpg':'dataurl'}});
const {createWalnutTable,TABLE_SPEC}=require(tableBundle),table=createWalnutTable();
table.updateMatrixWorld(true);
const tableBounds=new THREE.Box3().setFromObject(table),tableSize=tableBounds.getSize(new THREE.Vector3());
for(const actual of tableSize.toArray())assert.ok(Math.abs(actual-.5)<1e-6,'round table must be 50 x 50 x 50 cm');
assert.ok(Math.abs(tableBounds.min.y)<1e-6,'table feet must meet the floor');
assert.ok(Math.abs(tableBounds.max.y-TABLE_SPEC.height)<1e-6,'tabletop must reach the stated height');
assert.ok(Math.abs(tableBounds.min.x+tableBounds.max.x)<1e-6&&Math.abs(tableBounds.min.z+tableBounds.max.z)<1e-6,'table must be centred at its fixed placement origin');
assert.equal(table.getObjectsByProperty('name','外撇實木桌腳').length,3);
assert.equal(table.getObjectsByProperty('name','樹形分叉支撐').length,6);
table.traverse(o=>{if(!o.isMesh)return;for(const attr of Object.values(o.geometry.attributes))for(const value of attr.array)assert.ok(Number.isFinite(value),'table contains invalid geometry');});
const roomSource=fs.readFileSync(path.join(root,'src/room.js'),'utf8');
assert.ok(roomSource.includes('x:.95,z:-1.55'),'replacement must retain original table centre');
for(const removed of ['桌上杯子','桌上書本','茶幾下層木架','茶幾黑鐵腳','推車','瓶裝水','水瓶蓋','電視下玻璃架','玻璃架腳','清淨機'])assert.ok(!roomSource.includes(removed),'removed furniture detail remains: '+removed);
const template=fs.readFileSync(path.join(root,'src/template.html'),'utf8');
for(const removed of ['bedShift','tableShift','data-placement','deskFollow','dimensionToggle','exportModel','studioToggle','data-sofa','seatDepth','seatHeight'])assert.ok(!template.includes(removed),'retired control remains: '+removed);
fs.unlinkSync(tableBundle);
const layoutBundle=path.join(os.tmpdir(),'my-room-layout-'+crypto.randomUUID()+'.cjs');
esbuild.buildSync({entryPoints:[path.join(root,'src/sofa-layout.js')],bundle:true,platform:'node',format:'cjs',outfile:layoutBundle,loader:{'.jpg':'dataurl'}});
const {createSofaLayout}=require(layoutBundle),layout=createSofaLayout(4.25),placements={};
assert.equal(layout.holder.children.length,2,'both sofas must be installed together');
for(const [id,model] of Object.entries(layout.models)){
 assert.equal(model.visible,true,'both sofas must remain visible');
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),spec=SOFA_SPECS[id];
 assert.ok(Math.abs(size.x-spec.depth)<1e-6&&Math.abs(size.z-spec.width)<1e-6&&Math.abs(size.y-spec.height)<1e-6,'placement must preserve the measured sofa dimensions');
 assert.ok(bounds.min.x>=-2.125+.029&&bounds.max.x<=2.125-.029,'sofas must fit inside the side walls');
 placements[id]={position:model.position.toArray(),size:size.toArray(),visible:model.visible};
}
assert.ok(Math.abs(layout.models.two.position.x-1.6)<1e-6&&Math.abs(layout.models.two.position.z+1.66)<1e-6,'two-seater must retain its original location');
assert.equal(layout.models.corner.position.z,1.83,'corner sofa must replace the trolley location');
assert.ok(new THREE.Box3().setFromObject(layout.models.corner).min.x>=-2.125+.28+.029,'corner sofa must clear the wall column');
const opening=new THREE.Vector3(1,0,1).normalize().applyQuaternion(layout.models.corner.quaternion);
const toBed=new THREE.Vector3(1.105,0,.035).sub(layout.models.corner.position).normalize();
const facingBed=opening.dot(toBed);
assert.ok(facingBed>.95,'the corner sofa opening must face the bed');
fs.unlinkSync(layoutBundle);
console.log(JSON.stringify({passed:true,models:results,table:{widthCm:tableSize.x*100,depthCm:tableSize.z*100,heightCm:tableSize.y*100,position:{x:.95,z:-1.55},legs:3,forks:6},layout:{placements,cornerFacingBed:facingBed},simplifiedControls:true},null,2));
