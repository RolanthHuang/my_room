import * as THREE from 'three/webgpu';
import {createSofa, SOFA_SPECS} from './sofas.js';
import {FABRICS, applyFabric, fabricById, loadFabric} from './fabrics.js';
import {SOFA_PHOTOS} from './sofa-photos.js';
import {TABLE_PHOTOS} from './walnut-table.js';

const cm=v=>Math.round(v*1000)/10;

export function setupSofaComparison({root,colliders,room}) {
  const holder=new THREE.Group();holder.name='新沙發';root.add(holder);
  const models={two:createSofa('two'),corner:createSofa('corner')};
  Object.values(models).forEach(m=>holder.add(m));
  const state={sofa:'two',fabric:'linen-gray'},savedKey='my-room-furniture-v2';
  // Only furniture choices are restored; older bed and table offsets no longer apply.
  try{const saved=JSON.parse(localStorage.getItem(savedKey));if(saved){
    if(SOFA_SPECS[saved.sofa])state.sofa=saved.sofa;
    state.fabric=fabricById(saved.fabric).id;
  }}catch{}
  const persist=()=>{try{localStorage.setItem(savedKey,JSON.stringify(state));}catch{}};
  function refresh(){
    const spec=SOFA_SPECS[state.sofa];
    Object.entries(models).forEach(([id,m])=>m.visible=id===state.sofa);
    holder.position.set(room.width/2-.03-spec.depth/2,0,-1.66);holder.rotation.y=-Math.PI/2;
    root.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(models[state.sofa]);
    let collider=colliders.find(c=>c.name==='新沙發');
    if(!collider){collider={name:'新沙發'};colliders.push(collider);}
    Object.assign(collider,{minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z});
    document.querySelectorAll('[data-sofa]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sofa===state.sofa));
    document.querySelectorAll('[data-fabric]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fabric===state.fabric));
    document.getElementById('fabricValue').textContent=fabricById(state.fabric).name;
    document.getElementById('sofaDetails').textContent=spec.construction;
    document.getElementById('seatDepth').textContent=cm(spec.seatDepth)+' cm（DM）';
    document.getElementById('seatHeight').textContent=(spec.seatHeightMeasured?'':'約 ')+cm(spec.seatHeight)+' cm'+(spec.seatHeightMeasured?'（DM）':'（同系列推定）');
    document.getElementById('selectionBadge').textContent=spec.name+' · '+cm(spec.width)+' × '+cm(spec.depth)+' × '+cm(spec.height)+' cm · '+fabricById(state.fabric).name;
  }
  function chooseSofa(id){if(!SOFA_SPECS[id])return;state.sofa=id;refresh();persist();}
  function chooseFabric(id){state.fabric=fabricById(id).id;Object.values(models).forEach(m=>applyFabric(m,state.fabric));refresh();persist();}
  document.querySelectorAll('[data-sofa]').forEach(b=>b.onclick=()=>chooseSofa(b.dataset.sofa));
  const picker=document.getElementById('fabricPicker');
  FABRICS.forEach(f=>{
    const b=document.createElement('button');b.type='button';b.className='fabric-choice';b.dataset.fabric=f.id;b.title=f.name+' · '+f.kind;b.setAttribute('aria-label',f.name);
    const img=document.createElement('img');img.src=f.swatch;img.alt='';
    const label=document.createElement('span');label.textContent=f.name;b.append(img,label);b.onclick=()=>chooseFabric(f.id);picker.append(b);
  });
  const gallery=document.getElementById('referencePhotos');
  [...TABLE_PHOTOS,...SOFA_PHOTOS].forEach(p=>{
    const b=document.createElement('button'),img=document.createElement('img');img.src=p.src;img.alt=p.label;img.loading='lazy';
    const label=document.createElement('span');label.textContent=p.label;b.append(img,label);
    b.onclick=()=>{document.getElementById('largePhoto').src=p.src;document.getElementById('largePhoto').alt=p.label;document.getElementById('downloadImage').hidden=true;document.getElementById('photoModal').hidden=false;};gallery.append(b);
  });
  Object.values(models).forEach(m=>applyFabric(m,state.fabric));refresh();
  return {state,models,holder,chooseSofa,chooseFabric,ready:()=>loadFabric(state.fabric).ready};
}
