import * as THREE from 'three/webgpu';
import {attribute, texture, mix, float, sin} from 'three/tsl';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Construction and grain adapted from the user's Wooden_3_tier_shelf project.
// Keep its proportions and fixed foot pads; the original model has no casters.
export const SHELF_SPEC={width:.48,depth:.43,height:.96,measured:false};
export function createWoodenShelf({woodMap:suppliedWoodMap}={}){
  // Dimensions are inferred proportions in scene units, not a measured product specification.
  const W = 0.48, D = 0.43, H = 0.96, leg = 0.036;
  const shelfTops = [0.135, 0.545, 0.96];
  const rack = new THREE.Group();
  rack.name = '三層木架';
  rack.userData={...SHELF_SPEC,source:'RolanthHuang/Wooden_3_tier_shelf',photoEstimated:true};

  function hash(x, y) {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b-a)*fx + (c-a)*fy + (a-b-c+d)*fx*fy;
  }
  function woodTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 2048;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const v = y / c.height;
      for (let x = 0; x < c.width; x++) {
        const u = x / c.width;
        const broad = noise(u * 7.5 + 31, v * 3.0 + 12);
        const warp = (noise(u * 3.5, v * 6) - 0.5) * 0.085;
        const knotX = u - 0.43, knotY = (v - 0.56) * 5.5;
        const knot = Math.exp(-(knotX*knotX*55 + knotY*knotY*2.5));
        const flow = u + warp + knot * 0.11;
        const rings = Math.sin(flow * 245 + noise(u*13,v*6)*5);
        const fine = Math.pow(Math.max(0, Math.sin(flow*1050 + noise(u*30,v*10)*7)), 15);
        const pores = noise(u*240,v*90);
        const streak = noise(flow*50,v*2.5);
        const shade = (broad-.5)*25 + (streak-.5)*12 + rings*1.8 - fine*4 - knot*14 + (pores-.5)*4;
        const i = (y*c.width+x)*4;
        img.data[i] = 117 + shade;
        img.data[i+1] = 69 + shade*.72;
        img.data[i+2] = 39 + shade*.43;
        img.data[i+3] = 255;
      }
    }
    ctx.putImageData(img,0,0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }
  const woodMap = suppliedWoodMap || woodTexture();
  const grain = attribute('grainUV', 'vec2');
  const texel = texture(woodMap, grain);
  const wood = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.39, clearcoat: 0.24, clearcoatRoughness: 0.35, metalness: 0 });
  // TSL evaluates the mapped grain, per-board tint, and varnish roughness on WebGL2.
  wood.colorNode = texel.rgb.mul(attribute('boardTint', 'vec3'));
  wood.roughnessNode = mix(float(0.36), float(0.5), texel.r).add(sin(grain.x.mul(710)).mul(0.013));
  let boardIndex = 0;
  function board(name, width, length, depth, position, direction = 'y', radius = 0.0009) {
    const g = new RoundedBoxGeometry(width, length, depth, 2, radius);
    const p = g.attributes.position, n = g.attributes.normal;
    const guv = [], tint = [];
    const seed = ++boardIndex;
    const offsetU = hash(seed,17)*0.8, offsetV = hash(seed,43)*0.7;
    const tone = 0.88 + hash(seed,71)*0.27;
    for (let i=0; i<p.count; i++) {
      const isEnd = Math.abs(n.getY(i)) > 0.95;
      const transverse = Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? p.getZ(i) : p.getX(i);
      const u = isEnd ? p.getX(i)*17 + offsetU : transverse*6 + offsetU;
      const v = isEnd ? p.getZ(i)*17 + offsetV : p.getY(i)*0.9 + offsetV;
      guv.push(u,v);
      const endTint = isEnd ? 0.84 : 1;
      tint.push(tone*endTint, tone*endTint, tone*endTint);
    }
    g.setAttribute('grainUV',new THREE.Float32BufferAttribute(guv,2));
    g.setAttribute('boardTint',new THREE.Float32BufferAttribute(tint,3));
    const mesh = new THREE.Mesh(g,wood);
    mesh.name=name;
    mesh.position.set(...position);
    if(direction==='x') mesh.rotation.z = -Math.PI/2;
    if(direction==='z') mesh.rotation.x = Math.PI/2;
    mesh.castShadow=true; mesh.receiveShadow=true;
    rack.add(mesh); return mesh;
  }
  const xs = [-W/2+leg/2,W/2-leg/2], zs = [-D/2+leg/2,D/2-leg/2];
  for(const x of xs) for(const z of zs) board('Full-height corner post',leg,H,leg,[x,H/2,z],'y',.0012);
  const padMat = new THREE.MeshStandardNodeMaterial({color:0x353837,roughness:.88});
  for(const x of xs) for(const z of zs) {
    const pad = new THREE.Mesh(new RoundedBoxGeometry(.033,.004,.033,2,.0008),padMat);
    pad.name='原專案固定腳墊';pad.position.set(x,.002,z); rack.add(pad);
  }
  for(let level=0;level<3;level++) {
    const top=shelfTops[level], innerWidth=W-2*leg, count=9, gap=.009;
    const slatW=(innerWidth-gap*(count-1))/count;
    for(const x of xs) board('Side frame rail',.04,D-2*leg,leg,[x,top-.020,zs[0]+(D-leg)/2],'z');
    for(const z of zs) board('Transverse support rail',.040,innerWidth,.025,[0,top-.033,z],'x');
    for(let i=0;i<count;i++) {
      const x=-innerWidth/2+slatW/2+i*(slatW+gap);
      board(`Shelf ${level+1} / slat ${i+1}`,slatW,D,.014,[x,top-.007,0],'z',.0008);
    }
    // Dark countersunk fasteners are modelled as a recessed head, rim and hex socket.
    for(const x of xs) for(const z of zs) {
      const side=Math.sign(z), y=top-.039;
      const socketMat = new THREE.MeshStandardNodeMaterial({color:0x111514,roughness:.67,metalness:.30});
      const recess = new THREE.Mesh(new THREE.CylinderGeometry(.0058,.0058,.0008,24),socketMat);
      recess.rotation.x=Math.PI/2; recess.position.set(x,y,side*(D/2+.0001)); rack.add(recess);
      const ringMat=new THREE.MeshStandardNodeMaterial({color:0x4a493e,roughness:.43,metalness:.65});
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.0047,.00065,6,24),ringMat);
      rim.position.set(x,y,side*(D/2+.0005)); rack.add(rim);
      const head=new THREE.Mesh(new THREE.CircleGeometry(.0039,24),ringMat);
      if(side<0) head.rotation.y=Math.PI;
      head.position.set(x,y,side*(D/2+.00055));rack.add(head);
      const hex=new THREE.Mesh(new THREE.CircleGeometry(.0018,6),socketMat);
      if(side<0) hex.rotation.y=Math.PI;
      hex.position.set(x,y,side*(D/2+.00065));rack.add(hex);
    }
  }

  return rack;
}
