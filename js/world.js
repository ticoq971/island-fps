import * as THREE from 'three';

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sstep=t=>t*t*(3-2*t);
function hash(ix,iz,s){let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function noise2(x,z,s){const ix=Math.floor(x),iz=Math.floor(z);const fx=sstep(x-ix),fz=sstep(z-iz);const a=hash(ix,iz,s),b=hash(ix+1,iz,s),c=hash(ix,iz+1,s),d=hash(ix+1,iz+1,s);return a+(b-a)*fx+(c-a)*fz+(a-b-c+d)*fx*fz}
function fbm(x,z,s){let v=0,a=.5,f=1;for(let i=0;i<4;i++){v+=a*noise2(x*f,z*f,s+i*17);a*=.5;f*=2}return v}

export function heightAt(x,z,s){
  const d=Math.hypot(x,z)/190;
  const warp=(fbm(x*.01+50,z*.01+50,s)-.5)*.35;
  const m=1-sstep(clamp((d+warp-.45)/.4,0,1));
  const hills=fbm(x*.018,z*.018,s+3);
  const mount=Math.max(0,fbm(x*.012+200,z*.012,s+9)-.42)*2.6;
  return -4+m*(7+hills*8+mount*mount*60);
}
export function biomeAt(x,z,s){
  const h=heightAt(x,z,s);
  if(h<.9)return h<-.3?'water':'beach';
  if(h>15)return'rock';
  const t=z/150+(fbm(x*.012+9,z*.012+9,s+5)-.5)*.6;
  if(t<-.35)return'snow';
  if(t>.5)return'desert';
  const m=fbm(x*.03+77,z*.03+3,s+8);
  if(h<4&&m>.55)return'swamp';
  return'forest';
}

const STY={
  oak:{trunk:[.22,.34,3,6],tc:0x6b4a2b,tY:1.5,crown:()=>new THREE.IcosahedronGeometry(1.9,0),cc:0x2f7d32,cY:4.2},
  pine:{trunk:[.18,.3,3,6],tc:0x5b4026,tY:1.5,crown:()=>new THREE.ConeGeometry(1.5,4.5,7),cc:0x1f5a2d,cY:4.6},
  spine:{trunk:[.18,.3,3,6],tc:0x5b4026,tY:1.5,crown:()=>new THREE.ConeGeometry(1.5,4.5,7),cc:0xdde8ee,cY:4.6},
  dead:{trunk:[.12,.28,4.5,5],tc:0x4a4338,tY:2.2,crown:()=>new THREE.IcosahedronGeometry(.7,0),cc:0x4d5a2e,cY:4},
  cactus:{trunk:[.28,.3,2.6,7],tc:0x3d8a4a,tY:1.3,crown:()=>new THREE.SphereGeometry(.34,6,5),cc:0x3d8a4a,cY:2.6},
  rock:{trunk:null,crown:()=>new THREE.IcosahedronGeometry(1,0),cc:0x8a8a8a,cY:.5,sy:.75},
  iron:{trunk:null,crown:()=>new THREE.IcosahedronGeometry(1,0),cc:0xa8683c,cY:.5,sy:.75},
};
const HP={tree:60,rock:90,iron:110};
const STEP=.7;
const PC={wood:0x9c6b3c,stone:0x8e8e8e};

function pieceBoxes(p){
  const o=[],T=.3;
  if(p.type==='floor')o.push({x:p.x,y:p.y-1.5,z:p.z,w:4,h:3,d:4});
  else if(p.type==='roof')o.push({x:p.x,y:p.y+.15,z:p.z,w:4.2,h:.3,d:4.2});
  else if(p.type==='table')o.push({x:p.x,y:p.y+.45,z:p.z,w:1.4,h:.9,d:.8});
  else{
    const ax=p.axis==='x';
    const mk=(off,len,y0,hh)=>o.push({x:p.x+(ax?off:0),y:p.y+y0+hh/2,z:p.z+(ax?0:off),w:ax?len:T,h:hh,d:ax?T:len});
    if(p.type==='wall')mk(0,4,0,3);else{mk(-1.35,1.3,0,3);mk(1.35,1.3,0,3);mk(0,1.4,2.2,.8)}
  }
  return o;
}
const pk=s=>[s.type,s.x.toFixed(1),s.y.toFixed(1),s.z.toFixed(1),s.axis||''].join('|');

export function createWorld(scene,seed){
  seed|=0;
  const W={seed,nodes:[],nodeMap:new Map(),boxes:[],pieces:[],caves:[],struct:new THREE.Group()};
  scene.add(W.struct);
  const rng=mulberry32(seed^0x9e3779b9);

  // ---- grottes (choisies sur la hauteur de base) puis terrain aplani autour
  const cand=[];
  for(let a=0;a<2500;a++){const x=(rng()-.5)*300,z=(rng()-.5)*300;const h=heightAt(x,z,seed);if(h>3)cand.push({x,z,h})}
  cand.sort((p,q)=>q.h-p.h);
  const caveList=[];
  for(const p of cand){
    if(caveList.length>=5)break;
    if(caveList.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>55)){
      let s=0,n=0;for(let i=-6;i<=6;i+=3)for(let j=-6;j<=6;j+=3){s+=heightAt(p.x+i,p.z+j,seed);n++}
      caveList.push({x:p.x,z:p.z,y0:s/n});
    }
  }
  W.caves=caveList;
  const hAt=(x,z)=>{
    let h=heightAt(x,z,seed);
    for(const c of caveList){
      const dx=x-c.x,dz=z-c.z;
      if(dx*dx+dz*dz<256){const d=Math.sqrt(dx*dx+dz*dz);const w=1-sstep(clamp((d-8)/8,0,1));h=h*(1-w)+c.y0*w}
    }
    return h;
  };
  W.heightAt=hAt;
  W.biomeAt=(x,z)=>biomeAt(x,z,seed);

  // ---- terrain
  const N=160,SZ=400;
  const geo=new THREE.PlaneGeometry(SZ,SZ,N,N);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;const colA=new Float32Array(pos.count*3);
  const C={beach:0xe0cf94,water:0xb8a878,forest:0x417d36,snow:0xf1f5f9,desert:0xd8b05c,swamp:0x4f5d37,rock:0x7b7b7b};
  const c=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    pos.setY(i,hAt(x,z));
    let b=biomeAt(x,z,seed);
    c.set(C[b]);
    for(const cv of caveList)if(Math.hypot(x-cv.x,z-cv.z)<8)c.set(0x555555);
    c.multiplyScalar(.9+fbm(x*.15,z*.15,seed+40)*.2);
    colA[i*3]=c.r;colA[i*3+1]=c.g;colA[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colA,3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true})));
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x2a6fb0,transparent:true,opacity:.78}));
  sea.position.y=-.05;scene.add(sea);

  // ---- boîtes de collision / structures
  function addBox(x,y,z,w,h,d,color,walk){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));
    m.position.set(x,y,z);W.struct.add(m);
    W.boxes.push({minx:x-w/2,maxx:x+w/2,miny:y-h/2,maxy:y+h/2,minz:z-d/2,maxz:z+d/2,walk});
  }

  // ---- éléments à placer (arbres, rochers, minerai)
  const items=[];
  const addItem=(kind,style,x,y,z,s,r)=>items.push({kind,style,x,y,z,s,r,rot:rng()*6.28});
  const nearCave=(x,z)=>caveList.some(q=>Math.hypot(q.x-x,q.z-z)<14);
  const occ=new Set();let treeN=0;
  const PT={forest:.75,snow:.4,swamp:.3,desert:.025,rock:.03,beach:0,water:0};
  for(let a=0;a<24000&&treeN<2600;a++){
    const x=(rng()-.5)*380,z=(rng()-.5)*380;const h=hAt(x,z);
    if(h<.9)continue;
    const b=biomeAt(x,z,seed);
    if(rng()>PT[b])continue;
    if(nearCave(x,z))continue;
    const k=Math.round(x/2.4)+','+Math.round(z/2.4);
    if(occ.has(k))continue;occ.add(k);
    const style=b==='snow'?'spine':b==='desert'?'cactus':b==='swamp'?'dead':(rng()<.4?'pine':'oak');
    addItem('tree',style,x,h,z,.8+rng()*.6,.55);treeN++;
  }
  let rockN=0,ironN=0;
  for(let a=0;a<8000&&(rockN<260||ironN<40);a++){
    const x=(rng()-.5)*380,z=(rng()-.5)*380;const h=hAt(x,z);
    if(h<.9||nearCave(x,z))continue;
    const b=biomeAt(x,z,seed);
    if(b==='rock'&&ironN<40&&rng()<.05){const s=.7+rng()*.7;addItem('iron','iron',x,h,z,s,s*.9);ironN++;continue}
    if(rockN<260&&rng()<(b==='rock'?.12:.012)){const s=.7+rng()*1.1;addItem('rock','rock',x,h,z,s,s*.95);rockN++}
  }

  // ---- grottes : murs, toit, lumière, minerai
  for(const cv of caveList){
    const cx=cv.x,cz=cv.z,y0=cv.y0;
    const dirs=[[0,1],[1,0],[0,-1],[-1,0]];let k=0,best=1e9;
    dirs.forEach((d,i)=>{const hh=heightAt(cx+d[0]*9,cz+d[1]*9,seed);if(hh<best){best=hh;k=i}});
    const T=(lx,lz)=>k===0?[lx,lz]:k===1?[lz,-lx]:k===2?[-lx,-lz]:[-lz,lx];
    const add=(lx,lz,w,d,yb,hh)=>{const[dx,dz]=T(lx,lz);const odd=k%2===1;addBox(cx+dx,yb+hh/2,cz+dz,odd?d:w,hh,odd?w:d,0x6c6c6c,true)};
    add(0,-5,10,1,y0-2,6.5);add(-5,0,1,10,y0-2,6.5);add(5,0,1,10,y0-2,6.5);
    add(-3.25,5,3.5,1,y0-2,6.5);add(3.25,5,3.5,1,y0-2,6.5);
    add(0,0,11,11,y0+4.5,1);
    const L=new THREE.PointLight(0xffd7a0,50,18,2);L.position.set(cx,y0+2.5,cz);scene.add(L);
    for(const[lx,lz]of[[-3,-3],[3,-3.5],[-3.5,.5]]){const[dx,dz]=T(lx,lz);addItem('iron','iron',cx+dx,hAt(cx+dx,cz+dz),cz+dz,.9,.85)}
  }

  // ---- instanciation
  const grid=new Map();const gk=(a,b)=>(a+64)*128+(b+64);
  const gridAdd=n=>{const key=gk(Math.floor(n.x/8),Math.floor(n.z/8));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(n)};
  const groups={};for(const it of items)(groups[it.style]||(groups[it.style]=[])).push(it);
  const Z=new THREE.Matrix4().makeScale(0,0,0);
  const q=new THREE.Quaternion(),m4=new THREE.Matrix4(),v=new THREE.Vector3(),sc=new THREE.Vector3(),col=new THREE.Color(),UP=new THREE.Vector3(0,1,0);
  let id=0;
  for(const[style,list]of Object.entries(groups)){
    const D=STY[style];const meshes=[];
    if(D.trunk){const g=new THREE.CylinderGeometry(...D.trunk);g.translate(0,D.tY,0);meshes.push({m:new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial(),list.length),c:D.tc,y:1})}
    {const g=D.crown();g.translate(0,D.cY,0);meshes.push({m:new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial(),list.length),c:D.cc,y:D.sy||1})}
    list.forEach((it,i)=>{
      const node={id:id++,kind:it.kind,x:it.x,y:it.y,z:it.z,r:it.r,hp:HP[it.kind],alive:true,parts:[]};
      q.setFromAxisAngle(UP,it.rot);
      for(const M of meshes){
        v.set(it.x,it.y,it.z);sc.set(it.s,it.s*M.y,it.s);m4.compose(v,q,sc);
        M.m.setMatrixAt(i,m4);col.set(M.c).multiplyScalar(.85+rng()*.3);M.m.setColorAt(i,col);
        node.parts.push({m:M.m,i});
      }
      W.nodes.push(node);W.nodeMap.set(node.id,node);gridAdd(node);
    });
    for(const M of meshes){M.m.instanceMatrix.needsUpdate=true;if(M.m.instanceColor)M.m.instanceColor.needsUpdate=true;M.m.frustumCulled=false;scene.add(M.m)}
  }
  W.removeNode=nid=>{const n=W.nodeMap.get(nid);if(!n||!n.alive)return null;n.alive=false;for(const p of n.parts){p.m.setMatrixAt(p.i,Z);p.m.instanceMatrix.needsUpdate=true}return n};
  W.nearNodes=(x,z,rad,fn)=>{
    const x0=Math.floor((x-rad)/8),x1=Math.floor((x+rad)/8),z0=Math.floor((z-rad)/8),z1=Math.floor((z+rad)/8);
    for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){const l=grid.get(gk(a,b));if(l)for(const n of l)fn(n)}
  };

  // ---- collisions et sol
  W.collide=(p,r,feet)=>{
    W.nearNodes(p.x,p.z,r+2,n=>{
      if(!n.alive)return;
      const dx=p.x-n.x,dz=p.z-n.z,m=r+n.r,d2=dx*dx+dz*dz;
      if(d2<m*m){const d=Math.sqrt(d2)||1e-3;p.x=n.x+dx/d*m;p.z=n.z+dz/d*m}
    });
    for(const b of W.boxes){
      if(p.x<b.minx-r||p.x>b.maxx+r||p.z<b.minz-r||p.z>b.maxz+r)continue;
      if(feet>=b.maxy-STEP||feet+1.8<=b.miny)continue;
      const cx=clamp(p.x,b.minx,b.maxx),cz=clamp(p.z,b.minz,b.maxz);
      const dx=p.x-cx,dz=p.z-cz,d2=dx*dx+dz*dz;
      if(d2>=r*r)continue;
      if(d2>0){const d=Math.sqrt(d2);p.x=cx+dx/d*r;p.z=cz+dz/d*r}
      else{
        const l=p.x-b.minx,rr=b.maxx-p.x,t=p.z-b.minz,bt=b.maxz-p.z,m=Math.min(l,rr,t,bt);
        if(m===l)p.x=b.minx-r;else if(m===rr)p.x=b.maxx+r;else if(m===t)p.z=b.minz-r;else p.z=b.maxz+r;
      }
    }
    const rad=Math.hypot(p.x,p.z);if(rad>205){p.x*=205/rad;p.z*=205/rad}
  };
  W.groundAt=(x,z,feet)=>{
    let g=hAt(x,z);
    for(const b of W.boxes){if(x<b.minx||x>b.maxx||z<b.minz||z>b.maxz)continue;if(b.maxy-feet<=STEP&&b.maxy>g)g=b.maxy}
    return Math.max(g,-1.2);
  };

  // ---- rayons
  const ray=new THREE.Raycaster();
  W.terrainRay=(o,d,max)=>{
    let prev=0;
    for(let t=.5;t<=max;t+=.5){
      if(o.y+d.y*t<hAt(o.x+d.x*t,o.z+d.z*t)){
        let a=prev,b=t;
        for(let i=0;i<6;i++){const m=(a+b)/2;if(o.y+d.y*m<hAt(o.x+d.x*m,o.z+d.z*m))b=m;else a=m}
        return b;
      }
      prev=t;
    }
    return Infinity;
  };
  W.rayWorld=(o,d,max)=>{
    let t=W.terrainRay(o,d,max);
    ray.set(o,d);ray.far=max;
    const h=ray.intersectObjects(W.struct.children,false)[0];
    if(h&&h.distance<t)t=h.distance;
    return isFinite(t)?{t,point:new THREE.Vector3().copy(o).addScaledVector(d,t)}:null;
  };

  // ---- construction
  const floors=new Map(),pkeys=new Set();
  W.hasPiece=s=>pkeys.has(pk(s));
  W.addPiece=s=>{
    if(pkeys.has(pk(s)))return false;
    pkeys.add(pk(s));W.pieces.push(s);
    for(const b of pieceBoxes(s))addBox(b.x,b.y,b.z,b.w,b.h,b.d,s.type==='table'?0x7a4f2a:PC[s.mat||'wood'],true);
    if(s.type==='floor')floors.set(s.x+','+s.z,s.y);
    return true;
  };
  W.ghost=(s,ok)=>{
    const g=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:ok?0x44ff66:0xff4444,transparent:true,opacity:.45,depthWrite:false});
    for(const b of pieceBoxes(s)){const m=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,b.d),mat);m.position.set(b.x,b.y,b.z);g.add(m)}
    return g;
  };
  W.snap=(type,hit)=>{
    const cx=Math.round(hit.x/4)*4,cz=Math.round(hit.z/4)*4;
    const floorAt=(x,z)=>floors.get(x+','+z);
    const tmax=(x,z,hw)=>{let m=-99;for(const[i,j]of[[-hw,-hw],[hw,-hw],[-hw,hw],[hw,hw],[0,0]])m=Math.max(m,hAt(x+i,z+j));return m};
    const neigh=(x,z)=>{for(const[i,j]of[[4,0],[-4,0],[0,4],[0,-4]]){const f=floorAt(x+i,z+j);if(f!==undefined)return f}return undefined};
    if(type==='floor')return{type,x:cx,y:neigh(cx,cz)??(tmax(cx,cz,2)+.1),z:cz};
    if(type==='roof'){
      const f=floorAt(cx,cz)??neigh(cx,cz)??(tmax(cx,cz,2)+.1);
      const lvl=clamp(Math.floor((hit.y-f)/3),0,2);
      return{type,x:cx,y:f+3*(lvl+1),z:cz};
    }
    if(type==='table')return{type,x:hit.x,y:hit.y,z:hit.z};
    const dx=hit.x-cx,dz=hit.z-cz;let ex,ez,ax,nx,nz;
    if(Math.abs(dx)>Math.abs(dz)){const s=Math.sign(dx)||1;ex=cx+s*2;ez=cz;ax='z';nx=cx+s*4;nz=cz}
    else{const s=Math.sign(dz)||1;ex=cx;ez=cz+s*2;ax='x';nx=cx;nz=cz+s*4}
    let base=floorAt(cx,cz)??floorAt(nx,nz);
    if(base===undefined){base=-99;for(const o of[-2,0,2])base=Math.max(base,ax==='x'?hAt(ex+o,ez):hAt(ex,ez+o))}
    const lvl=clamp(Math.floor((hit.y-base)/3),0,2);
    return{type,x:ex,y:base+lvl*3,z:ez,axis:ax};
  };
  W.nearTable=(x,z,r=6)=>W.pieces.some(p=>p.type==='table'&&Math.hypot(p.x-x,p.z-z)<r);

  // ---- points de spawn
  W.spawnPoint=i=>{
    const a=i*Math.PI+.5;
    for(let r=195;r>20;r-=3){
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(hAt(x,z)>1.4&&biomeAt(x,z,seed)!=='rock'){const rr=Math.max(r-8,0);return{x:Math.cos(a)*rr,z:Math.sin(a)*rr}}
    }
    return{x:0,z:0};
  };
  W.randLand=(rnd,pred)=>{
    for(let k=0;k<300;k++){const x=(rnd()-.5)*300,z=(rnd()-.5)*300,h=hAt(x,z);if(h>1.2&&(!pred||pred(x,z,h)))return{x,z}}
    return{x:0,z:0};
  };
  return W;
}
