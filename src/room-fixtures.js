import * as THREE from 'three/webgpu';

// The two photos locate both structural piers behind the small desk, mirrored across the room.
// Width and projection remain photo estimates; their shared Z follows the desk centre.
export const COLUMN_SPEC={projection:.28,width:.70,z:1.225,measured:false};

function box(parent,name,w,h,d,x,y,z,mat){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function createWallColumns(roomWidth,roomHeight,mats){
  const group=new THREE.Group();group.name='左右對稱結構柱';const columns={};
  const {projection:p,width:w,z}=COLUMN_SPEC;
  for(const side of [-1,1]){
    const column=new THREE.Group();column.name=side<0?'電視側結構柱':'小桌子後方結構柱';
    column.position.set(side*(roomWidth/2-p/2),0,z);group.add(column);
    const body=box(column,side<0?'電視與入口間嵌牆柱':'小桌子後方嵌牆柱',p,roomHeight,w,0,roomHeight/2,0,mats.wall);
    box(column,'嵌牆柱下段灰磚',p+.004,1,w+.004,0,.5,0,mats.gray);
    const face=-side*(p/2+.006);
    box(column,'柱面灰磚收邊',.022,.017,w+.012,face,1.007,0,mats.trim);
    for(const edge of [-1,1])box(column,'柱側灰磚收邊',p,.017,.022,0,1.007,edge*w/2,mats.trim);
    for(const y of [.14,.31,.48,.65,.82,.99])box(column,'柱面瓷磚細紋',.002,.002,w-.004,face-side*.008,y,0,mats.grout).castShadow=false;
    box(column,'柱面灰磚接縫',.002,.995,.003,face-side*.008,.5,.17,mats.grout).castShadow=false;
    columns[side<0?'tv':'desk']={group:column,body};
  }
  group.updateMatrixWorld(true);return {group,columns};
}

export function createCoatStand(mats){
  const group=new THREE.Group();group.name='門旁木製衣帽架';group.userData={photoEstimated:true};
  function rod(name,a,b,r1=.017,r2=r1){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,direction.length(),16),mats.wood);
    mesh.name=name;mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  rod('衣帽架木柱',[0,.04,0],[0,1.78,0],.025,.021);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+.3;
    rod('衣帽架三腳底座',[0,.20,0],[Math.cos(a)*.20,.018,Math.sin(a)*.20],.023,.018);
    const foot=new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),mats.wood);foot.scale.y=.75;foot.position.set(Math.cos(a)*.20,.0135,Math.sin(a)*.20);foot.castShadow=true;group.add(foot);
  }
  for(const [height,rise,radius,count,offset] of [[1.48,.20,.23,4,.3],[1.17,.10,.18,3,1.1],[.89,.07,.15,2,.5]]){
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count+offset;
      rod('分叉木掛鉤',[0,height,0],[Math.cos(a)*radius,height+rise,Math.sin(a)*radius],.014,.012);
    }
  }
  group.updateMatrixWorld(true);
  const floor=new THREE.Box3().setFromObject(group).min.y;
  for(const child of group.children)child.position.y-=floor;
  group.updateMatrixWorld(true);return group;
}
