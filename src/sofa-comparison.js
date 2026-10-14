import * as THREE from 'three/webgpu';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createSofa, SOFA_SPECS} from './sofas.js';
import {FABRICS, applyFabric, fabricById, loadFabric} from './fabrics.js';
import {SOFA_PHOTOS} from './sofa-photos.js';

const cm = v => Math.round(v * 1000) / 10;
const rect = b => ({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z});
function clearance(a,b) {
  const x=Math.max(a.minX-b.maxX,b.minX-a.maxX),z=Math.max(a.minZ-b.maxZ,b.minZ-a.maxZ);
  if(x>0||z>0)return Math.hypot(Math.max(0,x),Math.max(0,z));
  return -Math.min(Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX),Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ));
}
function dimensionLabel(text) {
  const c=document.createElement('canvas');c.width=320;c.height=88;const g=c.getContext('2d');
  g.fillStyle='#f9f7efee';g.beginPath();g.roundRect(0,0,320,88,16);g.fill();
  g.fillStyle='#4d6450';g.textAlign='center';g.textBaseline='middle';g.font='500 54px sans-serif';g.fillText(text,160,44);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,transparent:true}));s.scale.set(.57,.157,1);s.renderOrder=10;return s;
}
function dimensions(spec) {
  const g=new THREE.Group();g.name='DM 尺寸標註';
  const w=spec.width,d=spec.depth,h=spec.height,points=[];
  const segment=(a,b)=>points.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
  segment([-w/2,.02,d/2+.10],[w/2,.02,d/2+.10]);
  for(const x of [-w/2,w/2])segment([x,.02,d/2+.065],[x,.02,d/2+.14]);
  segment([-w/2-.10,.02,-d/2],[-w/2-.10,.02,d/2]);
  for(const z of [-d/2,d/2])segment([-w/2-.14,.02,z],[-w/2-.065,.02,z]);
  segment([w/2+.10,0,-d/2],[w/2+.10,h,-d/2]);
  for(const y of [0,h])segment([w/2+.065,y,-d/2],[w/2+.14,y,-d/2]);
  const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#6a8268',depthTest:false}));line.renderOrder=9;g.add(line);
  const width=dimensionLabel(cm(w)+' cm');width.position.set(0,.05,d/2+.20);g.add(width);
  const depth=dimensionLabel(cm(d)+' cm');depth.position.set(-w/2-.22,.05,0);g.add(depth);
  const height=dimensionLabel(cm(h)+' cm');height.position.set(w/2+.14,h/2,-d/2);g.add(height);
  return g;
}

export function setupSofaComparison(o) {
  const {root,scene,camera,controls,bed,desk,coffeeTable,bedShadow,deskShadow,tableShadow,colliders,room,setMode,toast}=o;
  const base=colliders.map(c=>({...c}));
  if(bedShadow)bed.attach(bedShadow);
  if(deskShadow)desk.attach(deskShadow);
  const tablePivot=new THREE.Group();tablePivot.name='可移動茶幾';tablePivot.position.set(room.table.x,0,room.table.z);root.add(tablePivot);tablePivot.attach(coffeeTable);if(tableShadow)tablePivot.attach(tableShadow);
  const holder=new THREE.Group();holder.name='新沙發';root.add(holder);
  const models={two:createSofa('two'),corner:createSofa('corner')};
  const marks={two:dimensions(SOFA_SPECS.two),corner:dimensions(SOFA_SPECS.corner)};
  Object.values(models).forEach(m=>holder.add(m));Object.values(marks).forEach(m=>holder.add(m));
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshStandardMaterial({color:'#dfdfd7',roughness:.95}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;floor.visible=false;scene.add(floor);
  const ghost=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(room.bed.length,.002,room.bed.width)),new THREE.LineBasicMaterial({color:'#a48759',transparent:true,opacity:.55}));ghost.name='床原始位置';ghost.position.set(room.bed.x,.018,room.bed.z);root.add(ghost);
  const state={sofa:'two',placement:'original',bedShift:0,tableShift:0,deskFollow:false,fabric:'linen-gray',mirrored:false,dimensions:true};
  let studio=false,savedCamera,visibility;
  const savedKey='my-room-sofa-comparison-v1';
  try {const saved=JSON.parse(localStorage.getItem(savedKey));if(saved&&SOFA_SPECS[saved.sofa]){
    Object.assign(state,saved);state.bedShift=Math.max(0,Math.min(50,Number(state.bedShift)||0));state.tableShift=Math.max(0,Math.min(70,Number(state.tableShift)||0));
    if(!['original','adjusted','entry'].includes(state.placement))state.placement='original';state.fabric=fabricById(state.fabric).id;
  }}catch{}
  const persist=()=>{try{localStorage.setItem(savedKey,JSON.stringify(state));}catch{}};
  const active=()=>models[state.sofa];
  const record=name=>colliders.find(c=>c.name===name);
  function updateRecords() {
    for(const original of base){const c=record(original.name);if(!c)continue;Object.assign(c,original);
      if(c.name==='床'){c.minZ+=state.bedShift/100;c.maxZ+=state.bedShift/100;}
      if((c.name==='書桌'||c.name==='椅子')&&state.deskFollow){c.minZ+=state.bedShift/100;c.maxZ+=state.bedShift/100;}
    }
    const s=rect(new THREE.Box3().setFromObject(active()));
    let sofaCollider=record('新沙發');if(!sofaCollider){sofaCollider={name:'新沙發'};colliders.push(sofaCollider);}Object.assign(sofaCollider,s);
    const tc=record('茶幾');
    if(tc){const p=tablePivot.position;const w=room.table.width,d=room.table.length;Object.assign(tc,{minX:p.x-w/2,maxX:p.x+w/2,minZ:p.z-d/2,maxZ:p.z+d/2});}
  }
  function stats() {
    root.updateMatrixWorld(true);const s=record('新沙發'),b=record('床'),t=record('茶幾'),de=record('書桌'),wa=record('衣櫃');
    return {sofa:state.sofa,fabric:state.fabric,placement:state.placement,bedShiftCm:state.bedShift,tableShiftCm:state.tableShift,deskFollow:state.deskFollow,
      nominal:{width:SOFA_SPECS[state.sofa].width,depth:SOFA_SPECS[state.sofa].depth,height:SOFA_SPECS[state.sofa].height},bounds:{...s},
      sofaToBedCm:cm(clearance(s,b)),sofaToTableCm:cm(clearance(s,t)),bedToDeskCm:cm(clearance(b,de)),deskToWardrobeCm:cm(clearance(de,wa)),windowMarginCm:cm(s.minZ-room.back),
      collisions:colliders.filter(c=>c!==s&&c.name!=='新沙發'&&clearance(s,c)<-.0001).map(c=>c.name),
      studio,mirrored:state.mirrored,
    };
  }
  function gapText(label,value) {
    const overlap=value<0;return '<div class="'+(overlap?'conflict':'gap')+'">'+label+'：'+(overlap?'重疊 '+Math.abs(value):value)+' cm</div>';
  }
  function refresh() {
    const spec=SOFA_SPECS[state.sofa];
    Object.entries(models).forEach(([id,m])=>{m.visible=id===state.sofa;m.scale.x=id==='corner'&&state.mirrored?-1:1;});
    Object.entries(marks).forEach(([id,m])=>m.visible=state.dimensions&&id===state.sofa);
    if(state.placement==='entry'){
      holder.position.set(0,0,2.10);holder.rotation.y=Math.PI;
    }else{
      holder.position.set(room.width/2-.03-spec.depth/2,0,-1.66);holder.rotation.y=-Math.PI/2;
    }
    // Tables have independent controls and never follow a sofa placement change.
    tablePivot.position.set(room.table.x-state.tableShift/100,0,room.table.z);tablePivot.rotation.y=0;
    bed.position.z=state.bedShift/100;desk.position.z=state.deskFollow?state.bedShift/100:0;
    ghost.visible=!studio&&state.bedShift>0;
    floor.position.x=holder.position.x;floor.position.z=holder.position.z;
    root.updateMatrixWorld(true);updateRecords();
    document.querySelectorAll('[data-sofa]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sofa===state.sofa));
    document.querySelectorAll('[data-placement]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.placement===state.placement));
    document.querySelectorAll('[data-fabric]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fabric===state.fabric));
    document.getElementById('fabricValue').textContent=fabricById(state.fabric).name;
    document.getElementById('bedShift').value=state.bedShift;document.getElementById('tableShift').value=state.tableShift;document.getElementById('deskFollow').checked=state.deskFollow;
    document.getElementById('bedShiftValue').value=state.bedShift+' cm';document.getElementById('tableShiftValue').value=state.tableShift+' cm';
    document.getElementById('sofaDetails').textContent=spec.construction;
    document.getElementById('seatDepth').textContent=cm(spec.seatDepth)+' cm（DM）';
    document.getElementById('seatHeight').textContent=(spec.seatHeightMeasured?'':'約 ')+cm(spec.seatHeight)+' cm'+(spec.seatHeightMeasured?'（DM）':'（同系列推定）');
    document.getElementById('mirrorCorner').hidden=state.sofa!=='corner';
    document.getElementById('mirrorCorner').textContent=state.mirrored?'轉角靠背：床側':'轉角靠背：窗側';
    document.getElementById('dimensionToggle').textContent=state.dimensions?'隱藏沙發尺寸':'顯示沙發尺寸';document.getElementById('dimensionToggle').setAttribute('aria-pressed',state.dimensions);
    document.getElementById('selectionBadge').textContent=spec.name+' · '+cm(spec.width)+' × '+cm(spec.depth)+' × '+cm(spec.height)+' cm · '+fabricById(state.fabric).name;
    const st=stats();let summary=gapText('沙發與床',st.sofaToBedCm)+gapText('沙發與茶幾',st.sofaToTableCm)+gapText('床與書桌',st.bedToDeskCm);
    if(st.deskToWardrobeCm<0)summary+=gapText('書桌與衣櫃',st.deskToWardrobeCm);
    document.getElementById('placementStatus').innerHTML=summary;
    let note=state.placement==='entry'?'入口前空區讓沙發朝窗，床與桌子維持原位。兩人座離衣櫃較近，需確認櫃門開啟。':'窗邊延續原本面向電視的方向。兩人座佔用 192cm，原窗至床邊只有 195cm，可用床平移增加餘裕。';
    if(state.sofa==='corner'&&state.placement!=='entry')note='轉角單人放在原位置，床側空間比兩人座多；茶幾可向走道微移，留出坐下與起身空間。';
    if(st.bedToDeskCm<0)note+=' 床已碰到書桌，可勾選桌椅跟著平移。';
    if(st.collisions.length)note+=' 目前模型重疊：'+st.collisions.join('、')+'。';
    document.getElementById('placementNote').textContent=note;
    document.getElementById('modelHint').textContent=studio?'外尺寸按 DM · 曲面與布料依照片還原':'床平移 '+state.bedShift+' cm · 茶幾平移 '+state.tableShift+' cm'+(state.deskFollow?' · 桌椅跟床移動':'');
  }
  function fitStudio() {
    const target=holder.position.clone().add(new THREE.Vector3(0,.38,0));
    const direction=new THREE.Vector3(2.35,1.20,2.35).applyAxisAngle(new THREE.Vector3(0,1,0),holder.rotation.y);
    direction.multiplyScalar(Math.max(1,.96/camera.aspect));camera.position.copy(target).add(direction);controls.target.copy(target);camera.fov=43;camera.updateProjectionMatrix();controls.update();
  }
  function setStudio(on,restoreCamera=true) {
    if(on===studio)return;
    if(on){setMode('orbit');savedCamera={position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov};visibility=new Map(root.children.map(c=>[c,c.visible]));root.children.forEach(c=>c.visible=c===holder);o.exterior.visible=false;studio=true;floor.visible=true;fitStudio();}
    else{studio=false;floor.visible=false;for(const [c,v] of visibility)c.visible=v;holder.visible=true;o.exterior.visible=true;if(restoreCamera&&savedCamera){camera.position.copy(savedCamera.position);controls.target.copy(savedCamera.target);camera.fov=savedCamera.fov;camera.updateProjectionMatrix();controls.update();}}
    document.getElementById('studioToggle').textContent=studio?'返回房間':'單獨看沙發';document.getElementById('studioToggle').setAttribute('aria-pressed',studio);
    if(studio)document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
    refresh();
  }
  function chooseSofa(id) {if(!SOFA_SPECS[id])return;state.sofa=id;refresh();persist();}
  function chooseFabric(id) {state.fabric=fabricById(id).id;Object.values(models).forEach(m=>applyFabric(m,state.fabric));refresh();persist();}
  function choosePlacement(id) {
    if(!['original','adjusted','entry'].includes(id))return;
    state.placement=id;state.mirrored=false;
    state.bedShift=id==='adjusted'&&state.sofa==='two'?10:0;
    refresh();persist();if(studio)fitStudio();
  }
  async function exportSofa(id=state.sofa) {
    await loadFabric(state.fabric).ready;
    const model=models[id].clone(true);model.position.set(0,0,0);model.rotation.set(0,0,0);model.visible=true;
    model.scale.set(id==='corner'&&state.mirrored?-1:1,1,1);model.updateMatrixWorld(true);
    return new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true,maxTextureSize:1024});
  }
  document.querySelectorAll('[data-sofa]').forEach(b=>b.onclick=()=>chooseSofa(b.dataset.sofa));
  document.querySelectorAll('[data-placement]').forEach(b=>b.onclick=()=>choosePlacement(b.dataset.placement));
  document.getElementById('bedShift').oninput=e=>{state.bedShift=Number(e.target.value);refresh();persist();};
  document.getElementById('tableShift').oninput=e=>{state.tableShift=Number(e.target.value);refresh();persist();};
  document.getElementById('deskFollow').onchange=e=>{state.deskFollow=e.target.checked;refresh();persist();};
  document.getElementById('studioToggle').onclick=()=>setStudio(!studio);
  document.getElementById('mirrorCorner').onclick=()=>{state.mirrored=!state.mirrored;refresh();persist();};
  document.getElementById('dimensionToggle').onclick=()=>{state.dimensions=!state.dimensions;refresh();persist();};
  document.getElementById('exportModel').onclick=async()=>{const b=document.getElementById('exportModel');b.disabled=true;b.textContent='正在輸出…';try{
    const data=await exportSofa();const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));const a=document.createElement('a');a.href=url;a.download='MOCHI-'+state.sofa+'-'+state.fabric+'.glb';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){toast('模型輸出失敗：'+e.message);o.debug.errors.push(String(e));}finally{b.disabled=false;b.textContent='下載沙發 GLB';}};
  const picker=document.getElementById('fabricPicker');FABRICS.forEach(f=>{const b=document.createElement('button');b.type='button';b.className='fabric-choice';b.dataset.fabric=f.id;b.title=f.name+' · '+f.kind;b.setAttribute('aria-label',f.name);const img=document.createElement('img');img.src=f.swatch;img.alt='';const label=document.createElement('span');label.textContent=f.name;b.append(img,label);b.onclick=()=>chooseFabric(f.id);picker.append(b);});
  const gallery=document.getElementById('referencePhotos');SOFA_PHOTOS.forEach(p=>{const b=document.createElement('button');const img=document.createElement('img');img.src=p.src;img.alt=p.label;img.loading='lazy';const label=document.createElement('span');label.textContent=p.label;b.append(img,label);b.onclick=()=>{document.getElementById('largePhoto').src=p.src;document.getElementById('largePhoto').alt=p.label;document.getElementById('downloadImage').hidden=true;document.getElementById('photoModal').hidden=false;};gallery.append(b);});
  Object.values(models).forEach(m=>applyFabric(m,state.fabric));refresh();
  return {get studio(){return studio;},state,stats,models,holder,chooseSofa,chooseFabric,choosePlacement,setStudio,fitStudio,refresh,exportSofa,
    setBedShift:(n,follow=state.deskFollow)=>{state.bedShift=Math.max(0,Math.min(50,n));state.deskFollow=follow;refresh();},
    setTableShift:n=>{state.tableShift=Math.max(0,Math.min(70,n));refresh();},
    ready:()=>loadFabric(state.fabric).ready,
  };
}
