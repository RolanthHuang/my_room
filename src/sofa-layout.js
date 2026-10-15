import * as THREE from 'three/webgpu';
import {createSofa, SOFA_SPECS} from './sofas.js';
import {FABRICS, applyFabric, fabricById, loadFabric} from './fabrics.js';
import {SOFA_PHOTOS} from './sofa-photos.js';
import {TABLE_PHOTOS} from './walnut-table.js';
import {COLUMN_SPEC} from './room-fixtures.js';

export function createSofaLayout(roomWidth,column=COLUMN_SPEC){
  const holder=new THREE.Group();holder.name='兩張沙發擺設';
  const models={two:createSofa('two'),corner:createSofa('corner')};
  const two=models.two,corner=models.corner;
  two.position.set(roomWidth/2-.03-SOFA_SPECS.two.depth/2,0,-1.66);
  two.rotation.y=-Math.PI/2;
  // The corner's open +X/+Z sides face the bed; its backs face the wall and entry.
  // The former water trolley was on the TV side of the column, outside the entrance recess.
  corner.position.set(-roomWidth/2+.03+SOFA_SPECS.corner.depth/2,0,column.z-column.width/2-.04-SOFA_SPECS.corner.width/2);
  corner.rotation.y=Math.PI/2;
  holder.add(two,corner);holder.updateMatrixWorld(true);
  return {holder,models};
}

export function setupSofaLayout({root,colliders,room}) {
  const {holder,models}=createSofaLayout(room.width,room.column);root.add(holder);root.updateMatrixWorld(true);
  const geometry={};
  for(const model of Object.values(models)){
    const bounds=new THREE.Box3().setFromObject(model);
    colliders.push({name:model.name,minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z});
    geometry[model.userData.id]={visible:model.visible,size:bounds.getSize(new THREE.Vector3()).toArray(),position:model.position.toArray(),rotationY:model.rotation.y};
  }
  const state={fabric:'linen-gray'},savedKey='my-room-furniture-v2';
  try{const saved=JSON.parse(localStorage.getItem(savedKey));if(saved)state.fabric=fabricById(saved.fabric).id;}catch{}
  const persist=()=>{try{localStorage.setItem(savedKey,JSON.stringify(state));}catch{}};
  function refresh(){
    document.querySelectorAll('[data-fabric]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fabric===state.fabric));
    document.getElementById('fabricValue').textContent=fabricById(state.fabric).name;
    document.getElementById('selectionBadge').textContent='兩人座 ＋ 轉角單人 · 兩張同時擺放 · '+fabricById(state.fabric).name;
  }
  function chooseFabric(id){state.fabric=fabricById(id).id;Object.values(models).forEach(m=>applyFabric(m,state.fabric));refresh();persist();}
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
  return {state,models,holder,geometry,chooseFabric,ready:()=>loadFabric(state.fabric).ready};
}
