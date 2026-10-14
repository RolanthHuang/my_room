import * as THREE from 'three/webgpu';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import fabricUrl from '../assets/sofas/linen-weave.jpg';

// Metres. Outer dimensions are transcribed from IMG_6201/6204/6205.
// The corner module's seat height is not separately stated in its DM row.
export const SOFA_SPECS = {
  two: {
    id: 'two', name: 'MOCHI 兩人座', width: 1.92, depth: .99, height: .77,
    seatDepth: .66, seatHeight: .44, seatHeightMeasured: true,
    color: '#a3a29b', colorName: '亞麻灰（照片配色）', modules: 2,
    sources: ['IMG_6201', 'IMG_6205'],
    construction: '左、右窄扶手模組各 96cm；兩塊厚座墊、分段靠背、同高圓弧扶手、內縮黑色底座。',
  },
  corner: {
    id: 'corner', name: 'MOCHI 轉角單人', width: .95, depth: .95, height: .77,
    seatDepth: .62, seatHeight: .44, seatHeightMeasured: false,
    color: '#b7b6aa', colorName: '淺米灰（照片配色）', modules: 1,
    sources: ['IMG_6204'],
    construction: '95cm 方形轉角模組；兩個相鄰側面有同高靠背、厚方形座墊、圓弧外背與接縫。',
  },
};

let fabricTexture;
export let fabricReady;
function getFabricTexture() {
  if (!fabricTexture) {
    fabricReady = new Promise((resolve, reject) => {
      fabricTexture = new THREE.TextureLoader().load(fabricUrl, resolve, undefined, reject);
      fabricTexture.colorSpace = THREE.SRGBColorSpace;
      fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping;
      fabricTexture.anisotropy = 8;
    });
  }
  return fabricTexture;
}

function upholstery(hex) {
  // Standard PBR materials preserve the photo weave in portable GLB exports.
  const map = getFabricTexture();
  const m = new THREE.MeshStandardMaterial({color: hex, map, bumpMap: map, bumpScale: .0018, roughness: .98});
  m.name = '照片參考亞麻貓抓布';
  return m;
}

function puffGeometry(w, h, d, radius, shape = {}) {
  // Uniform subdivision puts vertices in the middle of each fabric panel.
  // RoundedBoxGeometry concentrates its vertices at the rim and leaves large flat centre quads.
  const base=new THREE.BoxGeometry(w,h,d,32,32,40);
  const geo=base.toNonIndexed();base.dispose();
  const a = geo.attributes.position;
  const originalNormals = geo.attributes.normal;
  const r=Math.min(radius,w/2.05,h/2.05,d/2.05),ix=w/2-r,iy=h/2-r,iz=d/2-r;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    const cx=THREE.MathUtils.clamp(x,-ix,ix),cy=THREE.MathUtils.clamp(y,-iy,iy),cz=THREE.MathUtils.clamp(z,-iz,iz);
    const n=new THREE.Vector3(x-cx,y-cy,z-cz).normalize();
    a.setXYZ(i,cx+n.x*r,cy+n.y*r,cz+n.z*r);originalNormals.setXYZ(i,n.x,n.y,n.z);
  }
  const tension = (u,v) => Math.pow(Math.max(0,1-u*u),.65)*Math.pow(Math.max(0,1-v*v),.65);
  for (let i = 0; i < a.count; i++) {
    let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
    const nx = x / (w / 2), ny = y / (h / 2), nz = z / (d / 2);
    const vx=originalNormals.getX(i),vy=originalNormals.getY(i),vz=originalNormals.getZ(i);
    const faceX=Math.sign(vx)*Math.pow(Math.abs(vx),5),faceY=Math.sign(vy)*Math.pow(Math.abs(vy),5),faceZ=Math.sign(vz)*Math.pow(Math.abs(vz),5);
    // Foam pushes against a taut cover: face centres swell while perimeter seams stay tight.
    // Each panel is then fitted back to its stated dimensions, keeping the widest bulge at 1:1.
    if (shape.seat) {
      x += faceX*.037*tension(ny,nz);
      y += faceY*(vy>0?.060:.014)*tension(nx,nz);
      z += faceZ*.045*tension(nx,ny);
    }
    if (shape.back) {
      x += faceX*.027*tension(ny,nz);
      y += faceY*.043*tension(nx,nz);
      z += faceZ*(vz>0?.080:.040)*tension(nx,ny);
      z -= .095 * ny;
    }
    if (shape.arm) {
      // The arm is an elongated pillow, with a pronounced belly in its middle.
      x += faceX*.100*tension(ny,nz);
      y += faceY*.049*tension(nx,nz);
      z += faceZ*.057*tension(nx,ny);
      x += (shape.sign || 1) * .024 * ny;
      y -= .026 * Math.max(0, nz) ** 2;
    }
    a.setXYZ(i, x, y, z);
  }
  geo.computeBoundingBox();
  const bounds = geo.boundingBox, size = bounds.getSize(new THREE.Vector3()), c = bounds.getCenter(new THREE.Vector3());
  for (let i = 0; i < a.count; i++) a.setXYZ(i,
    (a.getX(i) - c.x) * w / size.x,
    (a.getY(i) - c.y) * h / size.y,
    (a.getZ(i) - c.z) * d / size.z);
  // RoundedBoxGeometry is non-indexed. Weld positions solely for normal calculation,
  // otherwise recomputing normals gives each triangle a flat, faceted appearance.
  const positionsOnly=new THREE.BufferGeometry();positionsOnly.setAttribute('position',a.clone());
  const welded=mergeVertices(positionsOnly,1e-5);welded.computeVertexNormals();
  const wp=welded.attributes.position,wn=welded.attributes.normal,normalMap=new Map();
  const key=(x,y,z)=>[Math.round(x*1e5),Math.round(y*1e5),Math.round(z*1e5)].join(',');
  for(let i=0;i<wp.count;i++)normalMap.set(key(wp.getX(i),wp.getY(i),wp.getZ(i)),[wn.getX(i),wn.getY(i),wn.getZ(i)]);
  const smooth=new Float32Array(a.count*3);
  for(let i=0;i<a.count;i++)smooth.set(normalMap.get(key(a.getX(i),a.getY(i),a.getZ(i))),i*3);
  geo.setAttribute('normal',new THREE.BufferAttribute(smooth,3));
  positionsOnly.dispose();welded.dispose();
  // Project the weave in physical coordinates instead of stretching it on each panel.
  const uvs = geo.attributes.uv;
  // Keep the face parameterisation continuous across its entire quilted surface.
  for (const group of geo.groups) {
    const face=group.materialIndex;
    for(let i=group.start;i<group.start+group.count;i++) {
      const u=face<2?a.getZ(i):a.getX(i);
      const v=face>=2&&face<4?a.getZ(i):a.getY(i);
      uvs.setXY(i,u*5.0,v*5.0);
    }
  }
  geo.computeBoundingBox();
  return geo;
}

function plush(parent, name, size, position, mat, radius, shape) {
  const mesh = new THREE.Mesh(puffGeometry(...size, radius, shape), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function stitch(parent, name, points, mat, radius = .0011, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 7), radius, 5, closed), mat);
  mesh.name = name;
  mesh.castShadow = true;
  parent.add(mesh);
}

function projectToFace(mesh, parent, targets, axis, sign) {
  mesh.updateWorldMatrix(true,false);parent.updateWorldMatrix(true,false);
  const bounds=mesh.geometry.boundingBox,ray=new THREE.Raycaster(),result=[];
  for(const p of targets) {
    const target=parent.localToWorld(new THREE.Vector3(...p));mesh.worldToLocal(target);
    target[axis]=(sign>0?bounds.max[axis]:bounds.min[axis])+sign;
    const origin=mesh.localToWorld(target),direction=new THREE.Vector3();direction[axis]=-sign;direction.transformDirection(mesh.matrixWorld);
    ray.set(origin,direction);const hit=ray.intersectObject(mesh,false)[0];
    if(hit){const v=hit.point.clone();const n=hit.face.normal.clone().transformDirection(mesh.matrixWorld);v.addScaledVector(n,.0013);parent.worldToLocal(v);result.push(v.toArray());}
  }
  return result;
}
function armEndSeam(parent, mesh, mat) {
  const b=mesh.geometry.boundingBox,s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),targets=[];
  for(let i=0;i<28;i++){
    const t=i/28*Math.PI*2,co=Math.cos(t),si=Math.sin(t);
    targets.push([mesh.position.x+c.x+Math.sign(co)*Math.pow(Math.abs(co),.52)*s.x*.40,mesh.position.y+c.y+Math.sign(si)*Math.pow(Math.abs(si),.52)*s.y*.40,mesh.position.z+s.z/2]);
  }
  const points=projectToFace(mesh,parent,targets,'z',1);
  if(points.length>3)stitch(parent,'繃緊布套端面車縫',points,mat,.0013,true);
}

function seatSeams(parent, seat, x, z, w, d, mat) {
  const hw = w / 2, hd = d / 2, r = .048, y = .395;
  // Soft upholstery welt around the upper front and open side edges.
  const front=projectToFace(seat,parent,[
    [x - hw + r, y, z + hd - .002], [x - hw + .13, y + .004, z + hd],
    [x, y + .006, z + hd], [x + hw - .13, y + .004, z + hd], [x + hw - r, y, z + hd - .002],
  ],'z',1);
  if(front.length>1)stitch(parent, '座墊前緣車縫',front,mat,.0014);
  for (const s of [-1, 1]) {const edge=projectToFace(seat,parent,[
    [x + s * (hw - .001), .11, z + hd - r], [x + s * hw, .22, z + hd - .008],
    [x + s * (hw - .006), .34, z + hd - .004], [x + s * (hw - r), .41, z + hd - r],
  ],'x',s);if(edge.length>1)stitch(parent,'座墊側邊接縫',edge,mat,.0012);}
}

function plinth(parent, w, d) {
  const mat = new THREE.MeshStandardMaterial({color: '#2c2b28', roughness: .9});
  plush(parent, '內縮低底座', [w - .14, .045, d - .14], [0, .0225, 0], mat, .018, {});
  for (const x of [-w / 2 + .13, w / 2 - .13]) for (const z of [-d / 2 + .13, d / 2 - .13]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.026, .029, .032, 16), mat);
    foot.name = '隱藏黑色矮腳'; foot.position.set(x, .016, z); parent.add(foot);
  }
}

function buildTwo(parent, fabric, seam) {
  plinth(parent, 1.92, .99);
  const armWidth = .245, backDepth = .325, moduleWidth = .958;
  for (const s of [-1, 1]) {
    const module = new THREE.Group(); module.name = s < 0 ? '左窄扶手模組' : '右窄扶手模組'; parent.add(module);
    plush(module, '整體軟包靠背', [moduleWidth, .72, backDepth], [s * .48, .41, -.3325], fabric, .075, {back: true});
    const arm=plush(module, '長抱枕造型鼓起扶手', [armWidth, .72, .989], [s * (.96 - armWidth / 2), .41, 0], fabric, .085, {arm: true, sign: s});
    const sw = .713, sd = .66, x = s * .3585, z = .162;
    const seat=plush(module, '厚實獨立座墊', [sw, .39, sd], [x, .245, z], fabric, .052, {seat: true});
    seatSeams(module,seat,x,z,sw,sd,seam);
    armEndSeam(module,arm,seam);
  }
  const zipMat = new THREE.MeshStandardMaterial({color: '#77766f', roughness: 1});
  plush(parent, '中央模組接合陰影', [.004, .34, .018], [0, .235, .412], zipMat, .001, {});
}

function buildCorner(parent, fabric, seam) {
  plinth(parent, .95, .95);
  // Two full-height adjacent backrests: this is a corner module, not a chair with two arms.
  const back=plush(parent, '轉角後靠背', [.949, .72, .325], [0, .41, -.3125], fabric, .090, {back: true});
  const side = plush(parent, '轉角側靠背', [.325, .72, .744], [-.3125, .41, .103], fabric, .10, {arm: true, sign: -1});
  side.userData.role = 'second-full-height-backrest';
  armEndSeam(parent,side,seam);
  const seat=plush(parent, '轉角單塊厚座墊', [.62, .39, .62], [.163, .245, .163], fabric, .055, {seat: true});
  seatSeams(parent,seat,.163,.163,.62,.62,seam);
  const join=projectToFace(back,parent,[
    [-.205, .43, -.20], [-.225, .53, -.265], [-.265, .65, -.321], [-.303, .756, -.362],
  ],'z',1);if(join.length>1)stitch(parent,'相鄰靠背接縫',join,seam,.0011);
}

export function createSofa(id) {
  const spec = SOFA_SPECS[id];
  if (!spec) throw new Error('Unknown sofa ' + id);
  const outer = new THREE.Group(); outer.name = spec.name;
  const content = new THREE.Group(); content.name = '軟包與底座'; outer.add(content);
  const fabric = upholstery(spec.color);
  const seam = new THREE.MeshStandardMaterial({color: new THREE.Color(spec.color).multiplyScalar(.67), roughness: 1});
  seam.name = '布料車縫';
  if (id === 'two') buildTwo(content, fabric, seam); else buildCorner(content, fabric, seam);
  outer.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(content), size = bounds.getSize(new THREE.Vector3()), c = bounds.getCenter(new THREE.Vector3());
  content.scale.set(spec.width / size.x, spec.height / size.y, spec.depth / size.z);
  content.position.set(-c.x * content.scale.x, -bounds.min.y * content.scale.y, -c.z * content.scale.z);
  outer.userData = {
    id, units: 'metres', width: spec.width, depth: spec.depth, height: spec.height,
    seatDepth: spec.seatDepth, seatHeight: spec.seatHeight,
    dimensionsSource: spec.sources, cornerSeatHeightAssumed: !spec.seatHeightMeasured,
    estimatedDetails: '曲面、布料光色、車縫與內縮腳座依照片重建；不作製造圖。',
  };
  outer.updateMatrixWorld(true);
  return outer;
}
