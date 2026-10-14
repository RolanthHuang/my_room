import * as THREE from 'three/webgpu';
import f0 from '../assets/sofas/fabrics/linen-green.jpg';
import f1 from '../assets/sofas/fabrics/linen-gray.jpg';
import f2 from '../assets/sofas/fabrics/tundra-green.jpg';
import f3 from '../assets/sofas/fabrics/wheat-brown.jpg';
import f4 from '../assets/sofas/fabrics/cloud-beige.jpg';
import f5 from '../assets/sofas/fabrics/plain-yellow.jpg';
import f6 from '../assets/sofas/fabrics/photo-navy.jpg';
import f7 from '../assets/sofas/fabrics/photo-olive.jpg';
import f8 from '../assets/sofas/fabrics/photo-light-gray.jpg';
import f9 from '../assets/sofas/fabrics/photo-ivory.jpg';
import s0 from '../assets/sofas/fabrics/linen-green-swatch.jpg';
import s1 from '../assets/sofas/fabrics/linen-gray-swatch.jpg';
import s2 from '../assets/sofas/fabrics/tundra-green-swatch.jpg';
import s3 from '../assets/sofas/fabrics/wheat-brown-swatch.jpg';
import s4 from '../assets/sofas/fabrics/cloud-beige-swatch.jpg';
import s5 from '../assets/sofas/fabrics/plain-yellow-swatch.jpg';
import s6 from '../assets/sofas/fabrics/photo-navy-swatch.jpg';
import s7 from '../assets/sofas/fabrics/photo-olive-swatch.jpg';
import s8 from '../assets/sofas/fabrics/photo-light-gray-swatch.jpg';
import s9 from '../assets/sofas/fabrics/photo-ivory-swatch.jpg';

export const FABRICS = [
  {id:'linen-gray',name:'亞麻灰',color:'#a3a29b',url:f1,swatch:s1,kind:'細織紋',bump:.0015},
  {id:'linen-green',name:'亞麻綠',color:'#606344',url:f0,swatch:s0,kind:'細織紋',bump:.0015},
  {id:'photo-ivory',name:'米白織紋',color:'#c9c8bf',url:f9,swatch:s9,kind:'照片色名',bump:.0015},
  {id:'tundra-green',name:'苔原綠',color:'#9a9876',url:f2,swatch:s2,kind:'圈圈織紋',bump:.0038},
  {id:'wheat-brown',name:'麥田棕',color:'#ad8955',url:f3,swatch:s3,kind:'圈圈織紋',bump:.0038},
  {id:'cloud-beige',name:'雲朵米',color:'#d1c9b2',url:f4,swatch:s4,kind:'圈圈織紋',bump:.0038},
  {id:'plain-yellow',name:'平紋黃',color:'#c89e42',url:f5,swatch:s5,kind:'平紋',bump:.0010},
  {id:'photo-navy',name:'深藍',color:'#314864',url:f6,swatch:s6,kind:'照片色名',bump:.0010},
  {id:'photo-olive',name:'橄欖綠',color:'#8a8e63',url:f7,swatch:s7,kind:'照片色名',bump:.0010},
  {id:'photo-light-gray',name:'淺灰織紋',color:'#a9adb2',url:f8,swatch:s8,kind:'照片色名',bump:.0015},
];
const cache = new Map();
export function fabricById(id) { return FABRICS.find(f=>f.id===id) || FABRICS[0]; }
export function loadFabric(id) {
  const f = fabricById(id);
  if (!cache.has(f.id)) {
    let map;
    const ready = new Promise((resolve,reject)=>{
      map = new THREE.TextureLoader().load(f.url,resolve,undefined,reject);
    });
    map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
    cache.set(f.id,{map,ready});
  }
  return cache.get(f.id);
}
export function applyFabric(model,id) {
  const f=fabricById(id),{map,ready}=loadFabric(f.id);
  const seen=new Set();
  model.traverse(o=>{
    if(!o.isMesh || seen.has(o.material))return;
    const m=o.material;seen.add(m);
    if(m.name==='照片參考亞麻貓抓布'){
      m.color.set(f.color);m.map=m.bumpMap=map;m.bumpScale=f.bump;m.roughness=.97;m.needsUpdate=true;
    }else if(m.name==='布料車縫')m.color.set(f.color).multiplyScalar(.67);
  });
  model.userData.fabricId=f.id;model.userData.fabricName=f.name;
  return ready;
}
