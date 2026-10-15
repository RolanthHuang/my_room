import * as THREE from 'three/webgpu';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import walnutUrl from '../assets/table/walnut-top.jpg';
import frontPhoto from '../assets/table/IMG_6218.jpg';
import sidePhoto from '../assets/table/IMG_6219.jpg';
import sizePhoto from '../assets/table/IMG_6220.jpg';

export const TABLE_SPEC={name:'胡桃木圓邊桌・小',width:.50,depth:.50,height:.50,source:'IMG_6220 尺寸牌'};
export const TABLE_PHOTOS=[{label:'圓桌桌面與輪廓',src:frontPhoto},{label:'桌腳與樹形支撐',src:sidePhoto},{label:'小款尺寸 50 × 50 × 50',src:sizePhoto}];

export function createWalnutTable(){
  const group=new THREE.Group();group.name='胡桃木圓邊桌';group.userData={...TABLE_SPEC,units:'metres',estimatedDetails:'桌板厚度、桌腳截面與支撐依照片還原'};
  const map=new THREE.TextureLoader().load(walnutUrl);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  const wood=new THREE.MeshStandardMaterial({map,color:'#f0d8b9',roughness:.41,metalness:0});wood.name='照片胡桃木木紋';
  const legWood=new THREE.MeshStandardMaterial({map,color:'#a98158',roughness:.48,metalness:0});
  // A turned bullnose rim follows the soft edge in the reference, rather than a sharp cylinder.
  const profile=[[0,.477],[.234,.477],[.243,.479],[.248,.483],[.25,.488],[.249,.494],[.245,.498],[.238,.5],[0,.5]].map(p=>new THREE.Vector2(...p));
  const topGeo=new THREE.LatheGeometry(profile,128);
  const pos=topGeo.attributes.position,norm=topGeo.attributes.normal,uv=topGeo.attributes.uv;
  for(let i=0;i<pos.count;i++)if(Math.abs(norm.getY(i))>.35)uv.setXY(i,.5+pos.getX(i)/.5,.5+pos.getZ(i)/.5);
  const top=new THREE.Mesh(topGeo,wood);top.name='茶幾桌面';top.castShadow=top.receiveShadow=true;group.add(top);
  function beam(name,from,to,width,depth,taper=false){
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),v=b.clone().sub(a),length=v.length();
    const geo=new RoundedBoxGeometry(width,length,depth,3,.004);
    if(taper){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const t=p.getY(i)/length+.5;p.setX(i,p.getX(i)*(.62+.38*t));p.setZ(i,p.getZ(i)*(.70+.30*t));}geo.computeVertexNormals();}
    const m=new THREE.Mesh(geo,legWood);m.name=name;m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());m.castShadow=m.receiveShadow=true;group.add(m);return m;
  }
  // Three tapered, outward-leaning legs with small forks immediately under the top.
  for(let i=0;i<3;i++){
    const angle=i*Math.PI*2/3+.30,s=Math.sin(angle),c=Math.cos(angle);
    beam('外撇實木桌腳',[s*.193,.008,c*.193],[s*.128,.477,c*.128],.047,.045,true);
    for(const sign of [-1,1]){
      const t=angle+sign*.44;
      beam('樹形分叉支撐',[s*.142,.345,c*.142],[Math.sin(t)*.185,.477,Math.cos(t)*.185],.023,.025);
    }
  }
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const content=new THREE.Group();content.name='圓桌結構';while(group.children.length)content.add(group.children[0]);group.add(content);
  content.scale.set(.5/size.x,.5/size.y,.5/size.z);content.position.set(-center.x*content.scale.x,-bounds.min.y*content.scale.y,-center.z*content.scale.z);
  group.updateMatrixWorld(true);return group;
}
