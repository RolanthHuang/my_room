import * as THREE from 'three/webgpu';
import {texture, uv, float, color, mix, positionLocal, sin} from 'three/tsl';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// All distances are metres. The bed is measured; room and other furniture are inferred.
const MODEL={room:{width:4.25,depth:6.18,height:2.65},bed:{length:1.88,width:1.52,baseHeight:.25,mattressHeight:.34,windowGap:1.95,x:1.105,z:.035},coffeeTable:{length:1.20,width:.60,height:.48,x:.95,z:-1.55}};
const canvas=document.getElementById('viewport');
const loader=document.getElementById('loader');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#dcded7');
const camera=new THREE.PerspectiveCamera(65,1,.025,60);
let renderer, controls;
let randomSeed=421;
function rand(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;}
function makeCanvas(w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];}
function texFrom(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;}
function woodTexture(){
  const [c,g]=makeCanvas(512,1024);g.fillStyle='#a9947e';g.fillRect(0,0,512,1024);
  for(let i=0;i<2800;i++){const x=rand()*512;g.strokeStyle=`rgba(${rand()>.5?'68,47,29':'228,214,193'},${.018+rand()*.09})`;g.lineWidth=.35+rand()*1.5;g.beginPath();g.moveTo(x,0);for(let y=0;y<=1024;y+=16)g.lineTo(x+Math.sin(y/130+i)*3+Math.sin(y/53+i)*.6,y);g.stroke();}
  for(let i=0;i<22;i++){const x=rand()*512,y=rand()*1024;g.strokeStyle='#67513c18';g.lineWidth=1;for(let s=1;s<8;s++){g.beginPath();g.ellipse(x,y,s*1.5,s*8,0,0,Math.PI*2);g.stroke();}}
  return texFrom(c);
}
function clothTexture(){const[c,g]=makeCanvas(512,512);g.fillStyle='#d0d0c6';g.fillRect(0,0,512,512);for(let y=0;y<512;y+=2){g.fillStyle=y%4?'#faf8ed22':'#666c6415';g.fillRect(0,y,512,1);}for(let x=0;x<512;x+=2){g.fillStyle=x%4?'#f4f3e822':'#5d665c14';g.fillRect(x,0,1,512);}for(let i=0;i<9000;i++){g.fillStyle=`rgba(70,78,65,${rand()*.035})`;g.fillRect(rand()*512,rand()*512,1,1);}return texFrom(c);}
function tileTexture(){
  const[c,g]=makeCanvas(2048,2048);g.fillStyle='#c4baa7';g.fillRect(0,0,2048,2048);const n=8,s=2048/n;
  for(let row=0;row<n;row++)for(let col=0;col<n;col++){
    const x=col*s,y=row*s;const shade=rand()*18;g.fillStyle=`rgb(${184+shade},${168+shade},${145+shade})`;g.fillRect(x+1,y+1,s-2,s-2);
    for(let line=0;line<260;line++){const ly=y+rand()*s;g.strokeStyle=`rgba(${rand()>.6?'242,225,199':'99,80,57'},${.015+rand()*.085})`;g.lineWidth=.4+rand()*.85;g.beginPath();g.moveTo(x+2,ly);for(let i=0;i<=s;i+=8)g.lineTo(x+i,ly+Math.sin(i/48+line)*2+Math.sin(i/17+line)*.6);g.stroke();}
    for(let i=0;i<3;i++){const kx=x+rand()*s,ky=y+rand()*s;g.strokeStyle='#67513b13';for(let q=1;q<6;q++){g.beginPath();g.ellipse(kx,ky,q*7,q*1.4,0,0,Math.PI*2);g.stroke();}}
  }const t=texFrom(c);t.repeat.set(MODEL.room.width/4.8,MODEL.room.depth/4.8);return t;
}
const woodTex=woodTexture(),clothTex=clothTexture(),floorTex=tileTexture();
const mats={};
function material(hex,roughness=.7,metalness=0){return new THREE.MeshStandardNodeMaterial({color:hex,roughness,metalness});}
function woodMat(hex='#d9c5ad',rough=.64){const m=material(hex,rough);m.colorNode=texture(woodTex,uv()).rgb.mul(color(hex));m.roughnessNode=float(rough).add(sin(positionLocal.y.mul(28)).mul(.035));return m;}
function clothMat(hex='#f5f3e9'){const m=material(hex,.94);m.colorNode=texture(clothTex,uv().mul(5)).rgb.mul(color(hex));m.bumpMap=clothTex;m.bumpScale=.006;return m;}
mats.wall=material('#e0e0d5',.92);mats.trim=material('#ecebdf',.86);mats.gray=material('#adafa7',.78);mats.grout=material('#959b93',.95);mats.wood=woodMat('#dcd5c8');mats.woodDark=woodMat('#c5b49e');mats.white=material('#e6e8df',.55);mats.metal=material('#a0a7a4',.35,.78);mats.black=material('#252a26',.65);mats.door=material('#383e34',.6);mats.sofa=material('#252b29',.42);mats.bedding=clothMat('#cbd0cc');mats.curtain=clothMat('#7e847d');mats.floor=material('#ffffff',.63);
mats.floor.colorNode=texture(floorTex,uv()).rgb;
mats.floor.roughnessNode=mix(float(.54),float(.72),texture(floorTex,uv()).r);
const root=new THREE.Group();scene.add(root);const wallGroups=[];const colliders=[];
function box(name,w,h,d,x,y,z,mat,parent=root,r=.0){const geo=r?new RoundedBoxGeometry(w,h,d,3,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cyl(name,r,h,x,y,z,mat,parent=root,segments=20){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function sphere(name,rx,ry,rz,x,y,z,mat,parent=root){const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);m.scale.set(rx,ry,rz);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function lineTube(points,r,mat,parent=root){const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(12,points.length*8),r,8,false),mat);m.castShadow=true;parent.add(m);return m;}
function obstacle(name,x,z,w,d){colliders.push({name,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});}
const[shadowC,shadowG]=makeCanvas(128,128);let grad=shadowG.createRadialGradient(64,64,12,64,64,64);grad.addColorStop(0,'rgba(35,30,22,.24)');grad.addColorStop(.65,'rgba(35,30,22,.12)');grad.addColorStop(1,'rgba(35,30,22,0)');shadowG.fillStyle=grad;shadowG.fillRect(0,0,128,128);const shadowT=texFrom(shadowC);
function contact(x,z,w,d){const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false});m.colorNode=color('#3e382d');m.opacityNode=texture(shadowT).a;const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);p.rotation.x=-Math.PI/2;p.position.set(x,.008,z);root.add(p);}
const W=MODEL.room.width,D=MODEL.room.depth,H=MODEL.room.height,BACK=-2.675,FRONT=BACK+D,CENTER=(BACK+FRONT)/2;
box('地板',W,.07,D,0,-.04,CENTER,mats.floor);
function wall(name,axis,sign){const g=new THREE.Group();g.name=name;root.add(g);wallGroups.push({g,axis,sign});return g;}
function paneling(parent,axis,pos,len,start=0){const alongX=axis==='z';const count=Math.ceil(len/.6);for(let i=0;i<count;i++){const seg=Math.min(.6,len-i*.6)-.003,center=start-len/2+i*.6+seg/2;const p=box('灰色下牆磚',alongX?seg:.017,.995,alongX?.017:seg,alongX?center:pos,.5,alongX?pos:center,mats.gray,parent);p.castShadow=false;
    // Subtle horizontal ceramic striations and vertical tile joints.
    for(let y=.14;y<.98;y+=.17)box('瓷磚細紋',alongX?seg:.002,.002,alongX?.002:seg,alongX?center:pos+(pos>0?-.01:.01),y,alongX?pos+(pos>0?-.01:.01):center,mats.grout,parent).castShadow=false;
  }box('下牆收邊',alongX?len:.022,.017,alongX?.022:len,alongX?start:pos,1.007,alongX?pos:start,mats.trim,parent);}
const leftWall=wall('電視側牆','x',-1),rightWall=wall('床側牆','x',1),frontWall=wall('入口側牆','z',1),backWall=wall('窗側牆','z',-1);
const entryZ=2.94,entryGap=.93,entryLeft=entryZ-entryGap/2,entryRight=entryZ+entryGap/2;
box('入口之前的左側牆',.13,H,entryLeft-BACK,-W/2-.065,H/2,(BACK+entryLeft)/2,mats.wall,leftWall);paneling(leftWall,'x',-W/2+.004,entryLeft-BACK,(BACK+entryLeft)/2);
box('入口之後的左側牆',.13,H,FRONT-entryRight,-W/2-.065,H/2,(FRONT+entryRight)/2,mats.wall,leftWall);paneling(leftWall,'x',-W/2+.004,FRONT-entryRight,(FRONT+entryRight)/2);
box('入口門楣',.13,H-2.14,entryGap,-W/2-.065,(H+2.14)/2,entryZ,mats.wall,leftWall);
box('右側牆',.13,H,D,W/2+.065,H/2,CENTER,mats.wall,rightWall);paneling(rightWall,'x',W/2-.004,D,CENTER);
const bathX=.53,bathGap=.85,bathLeft=bathX-bathGap/2,bathRight=bathX+bathGap/2;
box('浴室門左端牆',bathLeft+W/2,H,.13,(bathLeft-W/2)/2,H/2,FRONT+.07,mats.wall,frontWall);paneling(frontWall,'z',FRONT-.008,bathLeft+W/2,(bathLeft-W/2)/2);
box('浴室門右端牆',W/2-bathRight,H,.13,(bathRight+W/2)/2,H/2,FRONT+.07,mats.wall,frontWall);paneling(frontWall,'z',FRONT-.008,W/2-bathRight,(bathRight+W/2)/2);
box('浴室門楣',bathGap,H-2.12,.13,bathX,(H+2.12)/2,FRONT+.07,mats.wall,frontWall);
// Window wall is constructed around an opening, not a texture pasted over a solid wall.
const windowWidth=1.83,windowHeight=2.13,windowCenter=-.12;
box('窗左牆',1.10,H,.14,-1.60,H/2,BACK-.07,mats.wall,backWall);
box('窗右牆',1.23,H,.14,1.50,H/2,BACK-.07,mats.wall,backWall);
box('窗上牆',W,.45,.14,0,H-.225,BACK-.07,mats.wall,backWall);
box('窗下門檻',windowWidth,.06,.22,windowCenter,.03,BACK,mats.gray,backWall);
paneling(backWall,'z',BACK+.006,1.10,-1.60);paneling(backWall,'z',BACK+.006,1.23,1.50);
const ceiling=new THREE.Group();ceiling.name='天花板';root.add(ceiling);
box('天花板平面',W,.1,D,0,H+.05,CENTER,mats.trim,ceiling);
box('左側天花梁',.22,.29,D,-W/2+.11,H-.145,CENTER,mats.trim,leftWall);
box('右側天花梁',.22,.29,D,W/2-.11,H-.145,CENTER,mats.trim,rightWall);
box('窗側天花梁',W,.18,.38,0,H-.09,BACK+.19,mats.trim,backWall);
box('入口側天花梁',W,.23,.25,0,H-.115,FRONT-.125,mats.trim,frontWall);
// Shallow structural piers match the recesses visible in the reverse photograph.
box('電視牆前柱',.18,H,.40,-W/2+.09,H/2,2.33,mats.wall,leftWall);box('電視牆前柱下段',.188,1.0,.402,-W/2+.095,.50,2.33,mats.gray,leftWall);
box('床側前柱',.16,H,.30,W/2-.08,H/2,2.26,mats.wall,rightWall);box('床側前柱下段',.17,1,.31,W/2-.08,.5,2.26,mats.gray,rightWall);
function door(name,x,z,width,height,mat,parent,rotation=0){const g=new THREE.Group();g.name=name+'門組';g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);box(name+'門框',width+.13,height+.10,.10,0,(height+.10)/2,-.025,material('#39392f',.65),g);box(name+'門板',width,height,.065,0,height/2,-.095,mat,g,.012);for(let y=.4;y<height;y+=.39)box('門板橫接縫',width-.035,.006,.005,0,y,-.132,mats.black,g);sphere('門鎖',.022,.034,.015,width*.35,.97,-.16,mats.metal,g);lineTube([[width*.35,.99,-.17],[width*.35-.10,.99,-.17]],.012,mats.metal,g);if(name==='浴室'){box('浴室門百葉框',width-.08,.32,.008,0,.32,-.132,mats.black,g,.006);for(let y=.19;y<.46;y+=.034)box('浴室門百葉',width-.11,.011,.006,0,y,-.139,mat,g);}}
door('入口',-W/2-.1275,entryZ,.80,2.04,mats.door,leftWall,-Math.PI/2);door('浴室',bathX,FRONT+.1275,.72,2.02,material('#4b4e46',.72),frontWall);
box('浴室門檻',.82,.08,.2,.53,.04,FRONT-.18,mats.gray,frontWall);
box('配電箱',.31,.41,.028,-W/2+.20,1.54,2.26,mats.white,leftWall,.015).rotation.y=Math.PI/2;
const windowFrameMat=material('#333b38',.32,.58);
box('窗鋁框左',.045,windowHeight,.07,windowCenter-windowWidth/2,.06+windowHeight/2,BACK-.035,windowFrameMat,backWall);
box('窗鋁框右',.045,windowHeight,.07,windowCenter+windowWidth/2,.06+windowHeight/2,BACK-.035,windowFrameMat,backWall);
for(const y of [.08,2.20])box('窗橫框',windowWidth,.032,.07,windowCenter,y,BACK-.035,windowFrameMat,backWall);
box('窗中柱',.048,windowHeight,.075,windowCenter,.06+windowHeight/2,BACK-.0375,windowFrameMat,backWall);
const glassMat=new THREE.MeshPhysicalNodeMaterial({color:'#d5ecec',transparent:true,opacity:.23,roughness:.14,metalness:.1,depthWrite:false});
box('窗玻璃',windowWidth-.05,windowHeight-.03,.012,windowCenter,1.13,BACK-.030,glassMat,backWall).castShadow=false;
box('窗把手',.012,.13,.045,windowCenter+.065,1.13,BACK+.0175,mats.black,backWall,.005);
// Simplified neighbouring facade supplies depth outside the window.
const exterior=new THREE.Group();scene.add(exterior);const exteriorMat=material('#c5d5d7',.85);
box('窗外建築',5,4,.18,0,2,BACK-1.6,exteriorMat,exterior);for(let x=-2;x<2;x+=.85){box('窗外立柱',.08,3,.12,x,1.8,BACK-1.45,mats.white,exterior);box('對面窗',.66,1.5,.04,x+.4,1.8,BACK-1.45,material('#91bec6',.38),exterior);}exterior.traverse(o=>{if(o.isMesh)o.castShadow=false;});
function curtain(x,width){const group=new THREE.Group();backWall.add(group);const geo=new THREE.PlaneGeometry(width,2.18,44,54);const a=geo.attributes.position;for(let i=0;i<a.count;i++){const px=a.getX(i),py=a.getY(i);a.setZ(i,.045*Math.sin(px/width*Math.PI*16)+.013*Math.sin(px/width*Math.PI*32)+.006*Math.cos(py*4));a.setY(i,py+.005*Math.cos(px*48));}geo.computeVertexNormals();const mat=mats.curtain.clone();mat.side=THREE.DoubleSide;const m=new THREE.Mesh(geo,mat);m.position.set(x,1.13,BACK+.15);m.castShadow=true;m.receiveShadow=true;group.add(m);const rod=cyl('窗簾桿',.012,windowWidth+.95,windowCenter,2.28,BACK+.12,mats.black,backWall);rod.rotation.z=Math.PI/2;}
curtain(windowCenter-windowWidth/2-.20,.48);curtain(windowCenter+windowWidth/2+.20,.47);
const ac=new THREE.Group();backWall.add(ac);box('冷氣外殼',.95,.32,.21,windowCenter,2.40,BACK+.18,mats.white,ac,.04);box('冷氣出風口',.84,.036,.10,windowCenter,2.29,BACK+.30,mats.gray,ac,.008);for(let y=2.28;y<2.32;y+=.009)box('冷氣百葉',.82,.003,.09,windowCenter,y,BACK+.34,mats.white,ac);box('冷氣指示燈',.045,.012,.003,windowCenter+.31,2.35,BACK+.287,material('#a7b9aa',.4),ac);
// Measured bed: length runs from the headboard on the right wall toward the aisle.
const bed=new THREE.Group();bed.name='床';root.add(bed);const b=MODEL.bed;
box('床基座',b.length,.25,b.width,b.x,.125,b.z,mats.wood,bed,.016);
box('床基座踢腳',b.length-.08,.055,b.width-.07,b.x,.0275,b.z,mats.woodDark,bed,.008);
for(let z=b.z-b.width/2+.28;z<b.z+b.width/2;z+=.47)box('基座板接縫',.003,.23,.006,b.x-b.length/2-.001,.125,z,mats.woodDark,bed);
box('床墊',b.length,.34,b.width,b.x,.42,b.z,mats.bedding,bed,.052);
// Separate cloth surface adds small wrinkles instead of relying on a flat box.
function clothPlane(w,d,x,y,z,mat,amplitude=.012,segments=48){const geo=new THREE.PlaneGeometry(w,d,segments,segments);geo.rotateX(-Math.PI/2);const a=geo.attributes.position;for(let i=0;i<a.count;i++){const px=a.getX(i),pz=a.getZ(i);const ripple=Math.sin(px*21+pz*4)*Math.sin(pz*17-px*2)*.55+Math.sin(px*45-pz*7)*.18+Math.cos(pz*34+px*8)*.2;a.setY(i,ripple*amplitude);}geo.computeVertexNormals();const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;m.name='床單皺褶';root.add(m);return m;}
clothPlane(b.length-.03,b.width-.025,b.x,.595,b.z,mats.bedding,.017,70);
const hemMat=clothMat('#c6cbc5');box('床單邊緣',b.length+.014,.06,b.width+.014,b.x,.55,b.z,hemMat,bed,.015);
box('床頭右柱',.075,1.05,.065,2.075,.525,b.z+b.width/2+.04,mats.wood,bed,.012);box('床頭左柱',.075,1.05,.065,2.075,.525,b.z-b.width/2-.04,mats.wood,bed,.012);
for(const y of [.70,.89,1.035]){const board=box('床頭橫板',.048,.13,b.width+.11,2.06,y,b.z,mats.wood,bed,.009);board.rotation.z=-.10;}
for(const z of [b.z-.42,b.z+.35]){const geo=new THREE.SphereGeometry(1,40,24);const a=geo.attributes.position;for(let i=0;i<a.count;i++){for(const axis of ['X','Y','Z']){const v=a['get'+axis](i);a['set'+axis](i,Math.sign(v)*Math.pow(Math.abs(v),.46));}}geo.computeVertexNormals();const pillow=new THREE.Mesh(geo,clothMat('#d0d6cd'));pillow.scale.set(.21,.075,.29);pillow.position.set(b.x+b.length/2-.31,.67,z);pillow.rotation.y=z>b.z?.04:-.055;pillow.castShadow=true;pillow.receiveShadow=true;bed.add(pillow);}
const olive=clothMat('#7b775d');const shirt=clothPlane(.43,.29,b.x-.15,.611,b.z-.08,olive,.027,22);shirt.rotation.y=.18;
contact(b.x,b.z,b.length+.5,b.width+.5);obstacle('床',b.x,b.z,b.length,b.width);
// Sofa next to the window, along the right-hand wall.
const sofa=new THREE.Group();root.add(sofa);const sx=1.69,sz=-1.66;
box('沙發底座',.83,.22,1.30,sx,.21,sz,mats.sofa,sofa,.065);box('沙發靠背',.16,.69,1.42,2.035,.63,sz,mats.sofa,sofa,.055);
for(let i=0;i<2;i++){const z=sz-.34+i*.68;box('沙發座墊',.61,.16,.65,sx-.08,.40,z,mats.sofa,sofa,.047);box('沙發背墊',.13,.52,.65,1.94,.66,z,mats.sofa,sofa,.045);}
for(const z of [sz-.715,sz+.715])box('沙發扶手',.83,.36,.13,sx,.43,z,mats.sofa,sofa,.045);
for(const x of [sx-.29,sx+.29])for(const z of [sz-.59,sz+.59])cyl('沙發腳',.026,.13,x,.065,z,mats.black,sofa);
for(let i=0;i<6;i++)sphere('沙發扣點',.005,.010,.010,1.871,.69,sz-.55+i*.22,mats.black,sofa);
box('沙發花紋靠枕',.19,.32,.39,1.82,.62,sz+.20,clothMat('#b9b9a4'),sofa,.045).rotation.x=.1;
contact(sx,sz,1.2,1.9);obstacle('沙發',sx,sz,.85,1.55);
// Desk sits beside the headboard. No newly added clutter from the reverse photo.
const desk=new THREE.Group();root.add(desk);const dx=1.82,dz=1.315;
box('書桌桌面',.60,.038,.93,dx,.77,dz,mats.wood,desk,.009);
for(const z of [dz-.44,dz+.44])box('書桌側板',.53,.75,.035,dx,.375,z,mats.wood,desk,.008);
box('書桌背板',.025,.44,.85,2.08,.56,dz,mats.woodDark,desk);box('書桌抽屜',.48,.13,.79,dx,.675,dz,mats.wood,desk,.007);
box('抽屜把手',.04,.01,.21,dx-.26,.68,dz,mats.black,desk,.005);
const cx=1.23,cz=1.335;
box('椅子座面',.38,.045,.38,cx,.43,cz,clothMat('#c6c4b7'),desk,.022);
for(const x of [cx-.155,cx+.155])for(const z of [cz-.155,cz+.155])box('椅腳',.032,.42,.032,x,.21,z,mats.wood,desk,.007);
box('椅背',.045,.39,.37,cx+.165,.63,cz,mats.wood,desk,.012);
const coatMat=clothMat('#232826');box('椅背上的黑衣',.11,.54,.39,cx+.15,.64,cz,coatMat,desk,.04);sphere('黑衣袖褶',.05,.25,.07,cx+.06,.57,cz+.17,coatMat,desk);
box('桌上筆記本',.16,.016,.20,1.78,.804,1.125,mats.white,desk,.002);box('桌面小物',.055,.06,.05,1.90,.82,1.535,mats.black,desk,.007);
contact(dx,dz,.95,1.22);obstacle('書桌',dx,dz,.6,.94);obstacle('椅子',cx,cz,.42,.40);
const wardrobe=new THREE.Group();root.add(wardrobe);const wx=1.81,wz=2.83;
box('衣櫃主體',.60,2.13,1.18,wx,1.065,wz,mats.woodDark,wardrobe,.012);
for(const z of [wz-.294,wz+.294])box('衣櫃門',.035,1.36,.578,wx-.32,1.445,z,mats.wood,wardrobe,.005);
for(let row=0;row<3;row++)for(const z of [wz-.294,wz+.294]){box('衣櫃抽屜',.038,.23,.578,wx-.32,.65-row*.23,z,mats.wood,wardrobe,.006);box('抽屜黑把手',.024,.015,.105,wx-.35,.65-row*.23,z,mats.black,wardrobe,.006);}
for(const z of [wz-.07,wz+.07])box('衣櫃門把手',.027,.17,.018,wx-.35,1.40,z,mats.black,wardrobe,.008);
box('衣櫃踢腳',.54,.045,1.10,wx,.023,wz,mats.woodDark,wardrobe);contact(wx,wz,.95,1.5);obstacle('衣櫃',wx,wz,.67,1.22);
// TV and slim glass stand along the opposite wall.
const tvGroup=new THREE.Group();root.add(tvGroup);box('電視支架',.12,.30,.20,-2.08,1.47,-.99,mats.black,tvGroup,.012);
box('電視外框',.047,.55,.91,-2.035,1.51,-1.00,mats.black,tvGroup,.018);
const screenMat=material('#222c2e',.20,.28);screenMat.colorNode=mix(color('#121916'),color('#6e9291'),uv().x.mul(.35).add(uv().y.mul(.20)));
box('電視螢幕',.003,.505,.862,-2.009,1.513,-1.00,screenMat,tvGroup,.009);
const glassStandMat=new THREE.MeshPhysicalNodeMaterial({color:'#e1f3ed',roughness:.13,metalness:.18,transparent:true,opacity:.30,depthWrite:false});
box('電視下玻璃架',.35,.018,1.05,-1.91,.72,-1.01,glassStandMat,tvGroup,.004);
for(const x of [-2.06,-1.76])for(const z of [-1.47,-.55])cyl('玻璃架腳',.008,.70,x,.35,z,mats.metal,tvGroup);
obstacle('玻璃架',-1.91,-1.01,.36,1.06);
// One refrigerator: the adjacent smaller-looking surface in the photo is its open door.
function fridge(x,z,w,h,d,hex){const g=new THREE.Group();g.name='單一冰箱';root.add(g);const body=material(hex,.42,.22),inside=material('#c3ccc3',.65);
  box('冰箱背板',w,h,.035,x,h/2,z-d/2+.018,body,g,.01);
  for(const side of [-1,1])box('冰箱側板',.026,h,d,x+side*(w/2-.013),h/2,z,body,g,.01);
  for(const y of [.013,h-.013])box('冰箱頂底板',w,.026,d,x,y,z,body,g,.01);
  box('冰箱內背板',w-.053,h-.052,.01,x,h/2,z-d/2+.04,inside,g);
  for(const y of [.27,.60,.94])box('冰箱內層板',w-.055,.014,d-.07,x,y,z+.008,inside,g,.004);
  box('冰箱下層抽屜',w-.07,.16,.30,x,.10,z+.07,glassStandMat,g,.008);
  const doorGroup=new THREE.Group();doorGroup.name='打開的冰箱門';doorGroup.position.set(x+w/2,h/2,z+d/2);doorGroup.rotation.y=1.02;g.add(doorGroup);
  box('冰箱門板',w-.018,h-.030,.035,-w/2,0,.018,body,doorGroup,.018);
  box('冰箱門內側',w-.060,h-.070,.012,-w/2,0,-.009,inside,doorGroup,.012);
  for(const y of [-.40,-.06,.32])box('冰箱門置物架',w-.10,.046,.072,-w/2,y,-.047,inside,doorGroup,.007);
  box('冰箱門把手',.11,.018,.024,-w*.80,.04,.052,mats.black,doorGroup,.006);
  root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(doorGroup);const c=bounds.getCenter(new THREE.Vector3()),s=bounds.getSize(new THREE.Vector3());obstacle('打開的冰箱門',c.x,c.z,s.x,s.z);
  contact(x,z,w+.26,d+.3);obstacle('冰箱',x,z,w,d);return g;}
fridge(-1.61,-2.31,.57,1.24,.53,'#a5aca6');
const purifier=new THREE.Group();root.add(purifier);box('空氣清淨機',.25,.64,.20,-1.78,.32,-.27,mats.white,purifier,.025);box('清淨機出風口',.20,.07,.012,-1.78,.58,-.158,mats.gray,purifier,.008);for(let i=0;i<10;i++)box('清淨機格柵',.002,.05,.005,-1.87+i*.02,.58,-.15,mats.white,purifier);contact(-1.78,-.27,.45,.4);obstacle('清淨機',-1.78,-.27,.25,.20);
// Measured coffee table: 120 cm along the sofa, 60 cm across, wood top and black frame.
const small=new THREE.Group();small.name='茶幾';root.add(small);const ct=MODEL.coffeeTable;
box('茶幾桌面',ct.width,.025,ct.length,ct.x,ct.height,ct.z,mats.woodDark,small,.007);
box('茶幾下層木架',ct.width-.04,.022,ct.length-.035,ct.x,.16,ct.z,mats.woodDark,small,.005);
for(const x of [ct.x-ct.width/2+.025,ct.x+ct.width/2-.025])for(const z of [ct.z-ct.length/2+.025,ct.z+ct.length/2-.025])box('茶幾黑鐵腳',.025,ct.height-.025,.025,x,(ct.height-.025)/2,z,mats.black,small,.004);
for(const x of [ct.x-ct.width/2+.015,ct.x+ct.width/2-.015])box('茶幾黑鐵橫框',.025,.035,ct.length-.018,x,ct.height-.034,ct.z,mats.black,small,.003);
for(let i=0;i<2;i++)cyl('桌上杯子',.025,.065,ct.x-.09,.526,ct.z-.25+i*.13,mats.white,small);
box('桌上書本',.20,.024,.15,ct.x+.08,ct.height+.025,ct.z+.20,mats.white,small,.003);obstacle('茶幾',ct.x,ct.z,ct.width,ct.length);contact(ct.x,ct.z,ct.width+.30,ct.length+.30);
// Original trolley provides a recognisable foreground detail.
const trolley=new THREE.Group();root.add(trolley);const tx=-1.77,tz=1.83;
for(const x of [tx-.14,tx+.14])lineTube([[x,.15,tz],[x,.17,tz-.14],[x,1.02,tz-.12],[x,1.12,tz-.09]],.012,mats.metal,trolley);
lineTube([[tx-.14,1.12,tz-.09],[tx+.14,1.12,tz-.09]],.017,mats.black,trolley);
box('推車底板',.32,.025,.26,tx,.16,tz,mats.metal,trolley,.01);
for(const x of [tx-.19,tx+.19]){const wheel=cyl('推車輪',.072,.034,x,.075,tz+.10,mats.black,trolley,24);wheel.rotation.z=Math.PI/2;}
const bottleMat=new THREE.MeshPhysicalNodeMaterial({color:'#adcbd7',roughness:.22,metalness:.1,transparent:true,opacity:.63,depthWrite:false});
for(const x of [tx-.065,tx+.065])for(const z of [tz-.045,tz+.085]){cyl('瓶裝水',.047,.28,x,.32,z,bottleMat,trolley);cyl('水瓶蓋',.018,.022,x,.475,z,material('#44729b',.6),trolley);}
contact(tx,tz,.6,.55);obstacle('推車',tx,tz,.40,.35);
// Recessed ceiling fixtures and lighting.
const fixtures=[];const ceilingLights=[];
const lampMat=new THREE.MeshBasicNodeMaterial({color:'#faf3d9'});
for(const x of [-1.10,1.10])for(const z of [-1.90,.45,2.77]){
  const trim=cyl('崁燈外環',.071,.015,x,H-.008,z,mats.white,ceiling,32);const face=cyl('崁燈',.057,.004,x,H-.018,z,lampMat,ceiling,32);face.castShadow=false;trim.castShadow=false;
  const l=new THREE.PointLight('#fff0d4',1.8,4.8,2);l.position.set(x,H-.09,z);scene.add(l);ceilingLights.push(l);fixtures.push(face);
}
const hemi=new THREE.HemisphereLight('#d9e7ea','#b4aa92',1.1);scene.add(hemi);
const ambient=new THREE.AmbientLight('#eee9d8',.35);scene.add(ambient);
const sun=new THREE.DirectionalLight('#d5e7ed',2.6);sun.position.set(-1.8,4.6,-5.8);sun.target.position.set(1.1,.0,.6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.camera.near=.1;sun.shadow.camera.far=15;sun.shadow.bias=-.0002;sun.shadow.normalBias=.022;sun.shadow.radius=3;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#ebe6d6',.45);fill.position.set(-3,2.5,3);scene.add(fill);
// Back wall and ceiling must not prevent light entering through the real opening.
ceiling.traverse(o=>{if(o.isMesh)o.castShadow=false;});backWall.traverse(o=>{if(o.name.includes('玻璃'))o.castShadow=false;});

const presets={entry:{position:[-1.81,1.70,2.85],target:[.45,1.0,-1.17],fov:65},window:{position:[.40,1.65,-1.33],target:[-.40,1.0,2.35],fov:68},overview:{position:[-4.0,7.2,6.4],target:[0,.25,CENTER],fov:47}};
let mode='orbit',warm=false,yaw=0,pitch=0,walkDrag=null,lastTime=0,transition=null;const held=new Set();let renderedFrames=0;let toastTimer;const collisionHits={};
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2500);}
function lookAngles(){const dir=camera.getWorldDirection(new THREE.Vector3());yaw=Math.atan2(-dir.x,-dir.z);pitch=Math.asin(THREE.MathUtils.clamp(dir.y,-1,1));}
function applyAngles(){camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
function isClear(x,z,r=.16){if(x< -W/2+r||x>W/2-r||z< BACK+r||z>FRONT-r)return false;return !colliders.some(c=>x>c.minX-r&&x<c.maxX+r&&z>c.minZ-r&&z<c.maxZ+r);}
function setMode(next){
  transition=null;held.clear();mode=next;controls.enabled=mode==='orbit';document.getElementById('walkToggle').textContent=mode==='walk'?'返回旋轉觀看':'走進房間';document.getElementById('walkToggle').setAttribute('aria-pressed',mode==='walk');document.getElementById('crosshair').hidden=mode!=='walk';document.getElementById('touchPad').hidden=mode!=='walk';
  document.getElementById('help').innerHTML=mode==='walk'?'<strong>拖曳轉頭 · WASD／方向鍵移動</strong><span>也可使用右側方向按鈕；Esc 返回旋轉觀看。</span>':'<strong>拖曳旋轉 · 滾輪縮放</strong><span>右鍵拖曳平移；雙指縮放及平移。</span>';
  if(mode==='walk'){
    if(!isClear(camera.position.x,camera.position.z)){camera.position.set(-.72,1.62,1.80);camera.lookAt(.5,1.1,-1.5);}camera.position.y=1.62;camera.fov=65;camera.updateProjectionMatrix();lookAngles();applyAngles();toast('可以在家具間的空地移動');
  }else{const dir=camera.getWorldDirection(new THREE.Vector3());controls.target.copy(camera.position).add(dir.multiplyScalar(2));controls.update();}
}
function setView(name,instant=false){if(mode==='walk')setMode('orbit');const p=presets[name],target=new THREE.Vector3(...p.target),position=new THREE.Vector3(...p.position);if(name==='overview')position.sub(target).multiplyScalar(Math.max(1,.98/camera.aspect)).add(target);document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',b.dataset.view===name);});if(instant){camera.position.copy(position);controls.target.copy(target);camera.fov=p.fov;camera.updateProjectionMatrix();controls.update();return;}transition={start:performance.now(),fromP:camera.position.clone(),fromT:controls.target.clone(),fromF:camera.fov,toP:position,toT:target,toF:p.fov};}
function updateShell(){const inside=camera.position.x>=-W/2&&camera.position.x<=W/2&&camera.position.z>=BACK&&camera.position.z<=FRONT&&camera.position.y<H;for(const {g,axis,sign} of wallGroups)g.visible=mode==='walk'||inside||camera.position[axis]*sign<(axis==='x'?W/2:(sign>0?FRONT:-BACK));ceiling.visible=mode==='walk'||inside;exterior.visible=backWall.visible;}
function setWarm(on){warm=on;document.getElementById('lightToggle').textContent=on?'切換日光':'切換暖光';document.getElementById('lightToggle').setAttribute('aria-pressed',on);hemi.intensity=on?.60:1.1;hemi.color.set(on?'#d9d7c1':'#d9e7ea');ambient.intensity=on?.42:.35;sun.intensity=on?.35:2.6;sun.color.set(on?'#b8c9d6':'#d5e7ed');ceilingLights.forEach(l=>{l.intensity=on?6.8:1.8;l.color.set(on?'#ffe2ac':'#fff0d4');});scene.background.set(on?'#bcbdb6':'#dcded7');}
function recordCollision(x,z){const c=colliders.find(c=>x>c.minX-.16&&x<c.maxX+.16&&z>c.minZ-.16&&z<c.maxZ+.16);const name=c?.name||'房間邊界';collisionHits[name]=(collisionHits[name]||0)+1;}
function handleMovement(dt){const speed=held.has('shift')?1.8:1.12;let f=0,s=0;if(held.has('w')||held.has('arrowup')||held.has('forward'))f+=1;if(held.has('s')||held.has('arrowdown')||held.has('back'))f-=1;if(held.has('d')||held.has('arrowright')||held.has('right'))s+=1;if(held.has('a')||held.has('arrowleft')||held.has('left'))s-=1;if(!f&&!s)return;const scale=speed*dt/Math.max(1,Math.hypot(f,s));const dx=(-Math.sin(yaw)*f+Math.cos(yaw)*s)*scale,dz=(-Math.cos(yaw)*f-Math.sin(yaw)*s)*scale;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.04));for(let i=0;i<steps;i++){let x=camera.position.x+dx/steps,z=camera.position.z+dz/steps;if(isClear(x,camera.position.z))camera.position.x=x;else recordCollision(x,camera.position.z);if(isClear(camera.position.x,z))camera.position.z=z;else recordCollision(camera.position.x,z);}camera.position.y=1.62;}
function animate(t){const dt=Math.min(.04,(t-lastTime)/1000||.016);lastTime=t;if(transition){let p=Math.min(1,(t-transition.start)/700);p=p*p*(3-2*p);camera.position.lerpVectors(transition.fromP,transition.toP,p);controls.target.lerpVectors(transition.fromT,transition.toT,p);camera.fov=THREE.MathUtils.lerp(transition.fromF,transition.toF,p);camera.updateProjectionMatrix();if(p===1)transition=null;}if(mode==='orbit')controls.update();else handleMovement(dt);updateShell();renderer.render(scene,camera);renderedFrames++;if(renderedFrames===2){loader.hidden=true;window.roomDebug.ready=true;}if(renderedFrames%20===0){document.getElementById('diagnostic').textContent=JSON.stringify({ready:window.roomDebug.ready,backend:window.roomDebug.backend,nodeMaterials:window.roomDebug.tslMaterials,errors:window.roomDebug.errors,bedGeometry:window.roomDebug.geometry,roomDepth:D,roomBounds:[BACK,FRONT],mode,warm,position:camera.position.toArray(),yaw,pitch,fov:camera.fov,frames:renderedFrames,isClear:isClear(camera.position.x,camera.position.z),collisionHits,drawCalls:renderer.info.render.drawCalls});}}
function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();if(mode==='orbit'&&!transition&&document.querySelector('[data-view="overview"].active'))setView('overview',true);}
window.roomDebug={ready:false,model:MODEL,backend:null,tslMaterials:0,errors:[],getState:()=>({mode,warm,position:camera.position.toArray(),target:controls?.target.toArray(),fov:camera.fov,frames:renderedFrames,colliders:colliders.length,meshes:0}),setView:n=>setView(n,true),setWalk:on=>setMode(on?'walk':'orbit'),isClear,move:(seconds,key)=>{held.add(key);handleMovement(seconds);held.delete(key);return camera.position.toArray();}};
window.addEventListener('error',e=>window.roomDebug.errors.push(e.message));window.addEventListener('unhandledrejection',e=>window.roomDebug.errors.push(String(e.reason)));
async function start(){
  try{
    renderer=new THREE.WebGPURenderer({canvas,antialias:true,forceWebGL:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;await renderer.init();window.roomDebug.backend=renderer.backend.isWebGLBackend?'WebGL2':'unexpected';
    controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.35;controls.maxDistance=25;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,.8,-.5);controls.addEventListener('start',()=>{transition=null;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});});setView('entry',true);resize();
    const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement);root.traverse(o=>{if(o.isMesh&&o.material.isNodeMaterial)window.roomDebug.tslMaterials++;});
    renderer.setAnimationLoop(animate);
    document.getElementById('walkToggle').onclick=()=>setMode(mode==='orbit'?'walk':'orbit');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));document.getElementById('lightToggle').onclick=()=>setWarm(!warm);
    document.getElementById('infoToggle').onclick=()=>{const d=document.getElementById('drawer');d.hidden=!d.hidden;document.getElementById('infoToggle').setAttribute('aria-expanded',!d.hidden);};
    document.getElementById('exposure').oninput=e=>{renderer.toneMappingExposure=Number(e.target.value);document.getElementById('exposureValue').value=Number(e.target.value).toFixed(2);};
    document.getElementById('saveImage').onclick=()=>{try{renderer.render(scene,camera);const data=canvas.toDataURL('image/png');document.getElementById('largePhoto').src=data;document.getElementById('largePhoto').alt='目前的房間 3D 畫面';const a=document.getElementById('downloadImage');a.href=data;a.hidden=false;document.getElementById('photoModal').hidden=false;}catch(e){toast('無法輸出畫面，請使用瀏覽器截圖');window.roomDebug.errors.push(String(e));}};
    canvas.addEventListener('pointerdown',e=>{if(mode!=='walk')return;walkDrag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(mode!=='walk'||!walkDrag||walkDrag.id!==e.pointerId)return;yaw-=(e.clientX-walkDrag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-walkDrag.y)*.0035,-1.3,1.3);walkDrag.x=e.clientX;walkDrag.y=e.clientY;applyAngles();});canvas.addEventListener('pointerup',()=>walkDrag=null);canvas.addEventListener('pointercancel',()=>walkDrag=null);
    canvas.addEventListener('wheel',e=>{if(mode==='walk'){e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.025,35,82);camera.updateProjectionMatrix();}},{passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault());
    window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const key=e.key.toLowerCase();if(key==='escape'){if(!document.getElementById('photoModal').hidden)document.getElementById('photoModal').hidden=true;else if(mode==='walk')setMode('orbit');return;}if(mode==='walk'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();held.add(key);if(!e.repeat)handleMovement(.08);}});window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
    document.querySelectorAll('[data-move]').forEach(b=>{const k=b.dataset.move;b.addEventListener('pointerdown',e=>{e.preventDefault();held.add(k);handleMovement(.10);b.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>held.delete(k));});
    document.getElementById('closePhoto').onclick=()=>document.getElementById('photoModal').hidden=true;

    window.roomDebug.renderer=renderer;window.roomDebug.camera=camera;window.roomDebug.scene=scene;window.roomDebug.controls=controls;window.roomDebug.setWarm=setWarm;window.roomDebug.collisionBoxes=colliders;root.updateMatrixWorld(true);const boundsOf=name=>new THREE.Box3().setFromObject(root.getObjectByName(name));const sizeOf=name=>boundsOf(name).getSize(new THREE.Vector3()).toArray();const mattressBounds=boundsOf('床墊'),windowBounds=boundsOf('窗鋁框左'),bathBounds=boundsOf('浴室門板');window.roomDebug.geometry={bedBase:sizeOf('床基座'),bedMattress:sizeOf('床墊'),mattressTop:Math.round(mattressBounds.max.y*1000)/1000,floor:sizeOf('地板'),coffeeTable:sizeOf('茶幾桌面'),windowToBed:mattressBounds.min.z-windowBounds.max.z,windowToBath:bathBounds.min.z-windowBounds.max.z,entryDoorWall:'電視側牆',fridgeCount:root.children.filter(o=>o.name==='單一冰箱').length};
  }catch(e){window.roomDebug.errors.push(String(e));document.getElementById('loadStatus').textContent='房間載入失敗：'+e.message;document.querySelector('.spinner').hidden=true;console.error(e);}
}
start();
