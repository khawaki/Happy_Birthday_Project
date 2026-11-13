import * as THREE from "https://esm.sh/three@0.136.0";
import { OrbitControls } from "https://esm.sh/three@0.136.0/examples/jsm/controls/OrbitControls";
import { OBJLoader } from 'https://esm.sh/three@0.136.0/examples/jsm/loaders/OBJLoader';
import { MeshSurfaceSampler } from 'https://esm.sh/three@0.136.0/examples/jsm/math/MeshSurfaceSampler';
import * as BufferGeometryUtils from 'https://esm.sh/three@0.136.0/examples/jsm/utils/BufferGeometryUtils';

import { EffectComposer } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// ====== GLSL SHADER CHUNKS FOR CYBER/ETHNO SCENE ======
let darkenMaterial = `
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0), globalBloom);
`;
let splitPars = `
  uniform vec2 resolution;
  uniform vec3 split;
`;
let split = `
  vec2 sUv = gl_FragCoord.xy / resolution - split.xy;
  sUv.x += sUv.y * split.z / (resolution.x / resolution.y);
  float fsUv = fwidth(sUv.x);
`;
let fbm = `
  #define NUM_OCTAVES 5

  float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

  float noise(vec3 p){
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d * d * (3.0 - 2.0 * d);

      vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);

      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);

      vec4 o1 = fract(k3 * (1.0 / 41.0));
      vec4 o2 = fract(k4 * (1.0 / 41.0));

      vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
      vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

      return o4.y * d.y + o4.x * (1.0 - d.y);
  }

  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100);
    for (int i = 0; i < NUM_OCTAVES; ++i) {
      v += a * noise(x);
      x = x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }  
`;
let noise = `
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }
`;

// ====== CYBER/ETHNO 3D SCENE INITIALIZATION ======
let cyberInitialized = false;
let cyberRenderer = null;
let isSpinningUp = false;
let spinStartTime = null;
let cyberClock = null;
let cyberLoopRunning = false;
let cyberEntranceActive = false;

window.stopCyberEthno = function() {
  if (cyberRenderer) {
    cyberRenderer.setAnimationLoop(null);
    cyberLoopRunning = false;
  }
};

window.triggerCyberWarp = function(onCrossfadeStart, onComplete) {
  if (isSpinningUp) return;
  isSpinningUp = true;
  if (cyberClock) {
    spinStartTime = cyberClock.getElapsedTime();
  }
  setTimeout(() => {
    if (onCrossfadeStart) onCrossfadeStart();
  }, 1250);
  setTimeout(() => {
    if (onComplete) onComplete();
  }, 3650);
};

window.startCyberEthnoEntrance = function() {
  if (!cyberInitialized) {
    window.initCyberEthno();
  }
  if (cyberClock) {
    cyberClock.start();
  }
  cyberEntranceActive = true;
};

window.initCyberEthno = function(prewarmOnly = false) {
  if (cyberInitialized) return;
  cyberInitialized = true;

  const container = document.getElementById('cyber-ethno-container');

  let scene = new THREE.Scene();
  let isPortraitMobile = innerWidth < 768 || innerWidth < innerHeight;
  let baseCyberFov = isPortraitMobile ? 54 : 45;
  let camera = new THREE.PerspectiveCamera(baseCyberFov, innerWidth / innerHeight, 0.1, 2500);
  camera.position.set(-1.25, 2, 5).setLength(isPortraitMobile ? 15.5 : 14);
  let renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: "high-performance"});
  cyberRenderer = renderer;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x244832);
  container.appendChild(renderer.domElement);

  let controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.8, 0);
  controls.autoRotateSpeed *= 0.125;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxDistance = 22;
  controls.minDistance = 5;
  controls.minPolarAngle = Math.PI / 3;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(95);

  let light = new THREE.HemisphereLight(0xffffff, 0xaaaaaa);
  scene.add(light);

  let v3 = new THREE.Vector3();
  let c = new THREE.Color();

  function getResponsiveTextScale() {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 0.85) {
      return Math.max(0.68, Math.min(0.95, aspect * 1.48));
    }
    return 1.0;
  }

  let gu = {
    globalBloom: {value: 0},
    time: {value: 0},
    resolution: {value: new THREE.Vector2(innerWidth, innerHeight)},
    split: {value: new THREE.Vector3(0.5, 0.25, Math.sin(Math.PI / 12))},
    treeTextMorph: {value: 0.0},
    treeTextSecondMorph: {value: 0.0},
    galaxyWarp: {value: 0.0},
    textScale: {value: getResponsiveTextScale()},
    camRight: {value: new THREE.Vector3(1, 0, 0)},
    camUp: {value: new THREE.Vector3(0, 1, 0)},
    camForward: {value: new THREE.Vector3(0, 0, 1)}
  };

  function generateCyberTreeTextPoints(line1, line2, font1, font2, y1 = 0.34, y2 = 0.68) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = font1;
    ctx.fillText(line1, c.width / 2, c.height * y1);

    ctx.font = font2;
    ctx.fillText(line2, c.width / 2, c.height * y2);

    const imgData = ctx.getImageData(0, 0, c.width, c.height).data;
    const pts = [];

    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        const alpha = imgData[(y * c.width + x) * 4];
        if (alpha > 140) {
          const px = (x - c.width / 2) * 0.0088;
          const py = -(y - c.height / 2) * 0.0088;
          const pz = (Math.random() - 0.5) * 0.04;
          pts.push(px, py, pz);
        }
      }
    }
    return pts;
  }

  // <BACKGROUND>
  let bgG = new THREE.SphereGeometry(1, 36, 18);
  let bgM = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.uniforms.galaxyWarp = gu.galaxyWarp;
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        uniform float galaxyWarp;
        ${splitPars}
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        float d = ss(0.2, 0.8, vUv.y);
        vec3 col = mix(vec3(0, 1, 1) * 0.25, vec3(0, 0.75, 1), d);
        
        ${split}
        
        col = mix(vec3(0), col, ss(-fsUv, fsUv, sUv.x));
        vec3 spaceNight = vec3(0.004, 0.004, 0.01);
        col = mix(col, spaceNight, ss(0.0, 0.72, galaxyWarp));
        vec4 diffuseColor = vec4( col, opacity );`
      ).replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
        ${darkenMaterial}
        `
      );
    }
  });
  bgM.defines = {"USE_UV" : ""};
  let bg = new THREE.Mesh(bgG, bgM);
  bg.scale.setScalar(1000);
  scene.add(bg);

  // <SUPERSTRUCTURE>
  let sstructG = new THREE.IcosahedronGeometry(900, 20);
  let ssCenters = [];
  let ssPhase = [];
  let ssPos = sstructG.attributes.position;
  let vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  for(let i = 0; i < ssPos.count / 3; i++){
    vA.fromBufferAttribute(ssPos, i * 3 + 0);
    vB.fromBufferAttribute(ssPos, i * 3 + 1);
    vC.fromBufferAttribute(ssPos, i * 3 + 2);
    v3.addVectors(vA, vB).add(vC).divideScalar(3);
    ssCenters.push(v3.x, v3.y, v3.z, v3.x, v3.y, v3.z, v3.x, v3.y, v3.z);
    let rnd = Math.random();
    ssPhase.push(rnd, rnd, rnd);
  }
  sstructG.setAttribute("centers", new THREE.Float32BufferAttribute(ssCenters, 3));
  sstructG.setAttribute("phase", new THREE.Float32BufferAttribute(ssPhase, 1));
  let sstructM = new THREE.MeshBasicMaterial({
    wireframe: true, 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.25,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.time = gu.time;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
        uniform float time;
        attribute vec3 centers;
        attribute float phase;
        varying float vHVal;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          
          float t = time;
          vec3 dir = position - centers;
          float dirLen = length(dir);
          float hVal =  0.6 + pow(sin((centers.y * 0.05 + phase) * PI2 - t),1.) * 0.4;
          vHVal = hVal;
          transformed = centers + normalize(dir) * dirLen * hVal;
        `
      );
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        varying float vHVal;
        ${splitPars}
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity )`,
        `
        ${split}
        float spl = ss(-fsUv, fsUv, sUv.x);
        vec3 darkSide = mix(vec3(1, 0, 1), vec3(0.5, 0.5, 1), vHVal);
        vec3 col = mix(darkSide, diffuse, spl);
        vec4 diffuseColor = vec4( col, opacity );`
      ).replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
        ${darkenMaterial}
        `
      );
    }
  });
  let sstruct = new THREE.Mesh(sstructG, sstructM);
  scene.add(sstruct);

  // <THINGS>
  function CapsuleGeometry(R, L){
    let r = R;
    let R1 = R - r;
    let a = Math.asin(R1 / L);
    let path = new THREE.Path();
    path.absarc(0, -L * 0.5, R, Math.PI * 1.5, a);
    path.absarc(0,  L * 0.5, r, a, Math.PI * 0.5);
    let pts = path.getPoints(5);
    let g = new THREE.LatheBufferGeometry(pts);
    return g;
  }

  let thingG = BufferGeometryUtils.mergeBufferGeometries([
    CapsuleGeometry(1, 20), 
    new THREE.TorusGeometry(4, 0.25, 16, 72).rotateX(-Math.PI * 0.5).translate(0, 2.25, 0), 
    new THREE.TorusGeometry(4, 0.25, 16, 72).rotateX(-Math.PI * 0.5).translate(0, -2.25, 0)
  ]);
  let thingM = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.time = gu.time;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
        uniform float time;
        attribute float instData;
        varying vec3 vPos;
        ${shader.vertexShader}
      `.replace(
        `include <begin_vertex>`,
        `include <begin_vertex>
          float t = mod(time * 0.1, 10.) * PI2 + instData * PI2;
          vPos = position;
          transformed.y += sin(t) * 5.;
        `
      );
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        ${splitPars}
        varying vec3 vPos;
        ${shader.fragmentShader}
      `.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
          ${split}
          
          float splt = ss(-fsUv, fsUv, sUv.x);
          
          vec3 col = mix(gl_FragColor.rgb * 0.5, gl_FragColor.rgb, splt);
          
          float y = abs(vPos.y);
          float stripe = ss(5.25, 4.75, y);
          col = mix(col, vec3(1, 0.875, 1), stripe );
          float thinStripeRad = step(3., length(vPos.xz));
          vec3 colStripe = mix(vec3(0, 0, 1), vec3(0.75, 1, 0.875), splt);
          col = mix(col, colStripe, thinStripeRad);
          gl_FragColor.rgb = col;
          
          ${darkenMaterial}
          vec3 bloomColor = mix(vec3(1), col, globalBloom * (1. - splt) * thinStripeRad);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, bloomColor, (1. - splt) * thinStripeRad);
        `
      );
    }
  });
  thingM.defines = {"USE_UV" : ""};
  let thing = new THREE.InstancedMesh(thingG, thingM, 7);
  let dummy = new THREE.Object3D();
  let instData = [];
  for(let i = 0; i < 7; i++){
    dummy.position.setFromCylindricalCoords(100, Math.PI * 2 / 7 * i + Math.PI * 0.5, 10);
    dummy.updateMatrix();
    thing.setMatrixAt(i, dummy.matrix);
    instData.push(Math.random());
  }
  thingG.setAttribute("instData", new THREE.InstancedBufferAttribute(new Float32Array(instData), 1));
  scene.add(thing);

  let r = Math.sqrt(2) * 5;

  // <GROUND>
  let groundG = new THREE.IcosahedronGeometry(r + 0.15, 2);
  let gPos = groundG.attributes.position;
  for(let i = 0; i < gPos.count; i++){
    v3.fromBufferAttribute(gPos, i);
    if (v3.y >= 0) {
      gPos.setY(i, 0);
    }
  }
  groundG.computeVertexNormals();
  let groundM = new THREE.MeshLambertMaterial({
    color: "aqua",
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
        varying float vY;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          vY = position.y;
        `
      );
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        ${splitPars}
        varying float vY;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        ${split}
        vec3 col1 = mix(vec3(0, 1, 1) * 0.175, diffuse * 0.5, ss(0., -5., vY));
        vec3 col2 = mix(vec3(0.125), diffuse * 0.5, ss(0., -5., vY));
        vec3 col = mix(col2, col1, ss(-fsUv, fsUv, sUv.x));
        vec4 diffuseColor = vec4( col, opacity );`
      ).replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
          ${darkenMaterial}
          `
      );
    }
  });
  let ground = new THREE.Mesh(groundG, groundM);
  scene.add(ground);

  // <GRASS>
  let g = new THREE.InstancedBufferGeometry().setFromPoints(new Array(6).fill().map((v, i) => {return new THREE.Vector3(0, i * 0.2, 0)}));
  let instPos = [];

  for(let i = 0; i < 50000; i++){
    v3.setFromCylindricalCoords(Math.sqrt(Math.random() * r * r), Math.random() * Math.PI * 2, 0);
    instPos.push(v3.x, v3.y, v3.z, 0.8 + Math.random() * 0.2);
  }
  g.setAttribute("instPos", new THREE.InstancedBufferAttribute(new Float32Array(instPos), 4));
  let m = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.time = gu.time;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
        uniform float time;
        attribute vec4 instPos;
        attribute float lineDistance;
        
        varying float vLineDistance;
        varying float vNoise;
        ${noise}
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          vLineDistance = lineDistance;
          transformed.y *= instPos.w;
          
          float t = time * 0.1;
          vec3 wind = vec3(1, 0, 1);
          vec2 instUV = instPos.xz / 20.;
          instUV.y *= 0.875;
          instUV.x -= t;
          float n  = snoise(vec3( instUV * 5., t));
          float n2 = snoise(vec3( (instUV + vec2(2.)) * 5., 0.));
          n = n * 0.5 + 0.5;
          vNoise = n;
          transformed.y *= 0.5 + (1. - n) * 0.5;
          transformed += wind * vec3(0.5, 1, 0.25) * vec3(n, 1, n2) * pow(position.y, 2.7);
          transformed += instPos.xyz;
        `
      );
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        uniform float time;
        ${splitPars}
        varying float vLineDistance;
        varying float vNoise;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
        ${split}
        float sf = ss(-fsUv, fsUv, sUv.x);
        float ld = vLineDistance;
        vec3 col = mix(diffuse * 0.25, diffuse, pow(ld, 2.7));
        col = mix(mix(vec3(0.5), vec3(0.75),  pow(ld, 2.7)), col, sf);
        
        float pin = ss(0.9, 0.95, ld) - ss(0.95, 1., ld);
        col = mix(col, mix(vec3(0.5, 1, 0), vec3(0, 0.5, 1), 1. - vNoise), pin * sf);
        
        vec4 diffuseColor = vec4( col, opacity );
        `
      ).replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
          ${darkenMaterial}
          `
      );
    }
  });
  let l = new THREE.Line(g, m);
  l.computeLineDistances();
  scene.add(l);

  // <BEETLES>
  let beetlePts = [
    [-1, 1], [0, 0], [1, 1],
    [-0.5, -1], [0, -0.5], [0.5, -1]
  ].map(p => {return new THREE.Vector2(p[0], p[1])});
  let beetleG = new THREE.InstancedBufferGeometry().setFromPoints(beetlePts).rotateX(Math.PI * - 0.5).rotateY(Math.PI * -0.5);
  beetleG.setIndex([0, 1, 1, 2, 3, 4, 4, 5, 3, 0, 4, 1, 5, 2]);
  let instPosBeetle = [];
  let instPhaseBeetle = [];
  let instColor = [];
  new Array(250).fill().forEach(p => {
    v3.random().subScalar(0.5).multiplyScalar(14).setY(1 + Math.random());
    instPosBeetle.push(v3.x, v3.y, v3.z);
    instPhaseBeetle.push(Math.random());
    c.setHSL(Math.random(), 1, 0.5);
    instColor.push(c.r, c.g, c.b);
  });
  beetleG.setAttribute("instPos", new THREE.InstancedBufferAttribute(new Float32Array(instPosBeetle), 3));
  beetleG.setAttribute("instPhase", new THREE.InstancedBufferAttribute(new Float32Array(instPhaseBeetle), 1));
  beetleG.setAttribute("color", new THREE.InstancedBufferAttribute(new Float32Array(instColor), 3));
  let beetleM = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    onBeforeCompile: shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.time = gu.time;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
        uniform float time;
        attribute vec3 instPos;
        attribute float instPhase;
        varying float vInstRadius;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          vec3 iPos = instPos;
          iPos.x = -7. + mod(instPos.x - (-7.) + time * 0.75, 14.);
          iPos.y += sin(iPos.x + instPhase * 7.) * (0.5 * instPhase + 0.5);
          iPos.z += sin(iPos.x * 0.5) * (instPhase - 0.5) * 2.;
          
          vec3 sclPos = position * (1. - instPhase * 0.5);
          float t = (mod(time, 20.) + instPhase + sclPos.x * 0.1) * PI2 * 5. * (1. + instPhase * 0.5);
          float tVal = sin(t) * 0.5 + 0.5;
          float angle = (-PI / 6.) + (PI * 2. / 3.) * tVal;
          vec3 swayPos = vec3(sclPos.x, sin(angle) * abs(sclPos.z), cos(angle) * sclPos.z);
          
          transformed = swayPos * 0.075 + iPos;
          vInstRadius = length(iPos);
        `
      );
      shader.fragmentShader = `
        #define ss(a, b, c) smoothstep(a, b, c)
        uniform float globalBloom;
        varying float vInstRadius;
        ${splitPars}
        ${shader.fragmentShader}
      `.replace(
        `#include <color_fragment>`,
        `#include <color_fragment>
        
        ${split}
        
        float a = ss(7., 6.75, vInstRadius);
        float splt = ss(-fsUv, fsUv, sUv.x);
        vec3 col = mix(vec3(0.25, 0.25, 0), diffuseColor.rgb, splt);
        
        diffuseColor.rgb = col;
        diffuseColor.a *= a;
        `
      ).replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>
          ${darkenMaterial}
          vec3 bloomColor = mix(vec3(1), col, globalBloom * (1. - splt));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, bloomColor, 1. - splt);
          `
      );
    }
  });
  let beetle = new THREE.LineSegments(beetleG, beetleM);
  scene.add(beetle);

  let treeMeshRef = null;
  let treeLinesRef = null;

  // <TREE>
  const loader = new OBJLoader();
  loader.load( 'https://threejs.org/examples/models/obj/tree.obj', function ( object ) {
    let tree = object.children[0];
    treeMeshRef = tree;
    
    let lines = new THREE.LineSegments(new THREE.EdgesGeometry(tree.geometry, 20), new THREE.LineBasicMaterial({
      color: 0x88ffaa, 
      transparent: true, 
      opacity: 0.75,
      onBeforeCompile: shader => {
        shader.uniforms.globalBloom = gu.globalBloom;
        shader.uniforms.resolution = gu.resolution;
        shader.uniforms.split = gu.split;
        shader.fragmentShader = `
          #define ss(a, b, c) smoothstep(a, b, c)
          uniform float globalBloom;
          ${splitPars}
          ${shader.fragmentShader}
        `.replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `
          ${split}
          float splt = ss(-fsUv, fsUv, sUv.x);
          vec4 col = mix(vec4(0.5, 0, 0.5, 1), vec4(diffuse, opacity), splt);
          vec4 diffuseColor = col;`
        ).replace(
          `#include <dithering_fragment>`,
          `#include <dithering_fragment>
            ${darkenMaterial}
            vec3 bloomColor = mix(vec3(1), col.rgb, globalBloom * (1. - splt));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, bloomColor, 1. - splt);
          `
        );
      }
    }));
    treeLinesRef = lines;
    tree.add(lines);
    
    tree.material.color.set(0x00eeff);
    tree.material.side = THREE.DoubleSide;
    tree.material.transparent = true;
    tree.material.defines = {"USE_UV": ""};
    tree.material.polygonOffset = true;
    tree.material.polygonOffsetFactor = 1;
    tree.material.onBeforeCompile = shader => {
      shader.uniforms.globalBloom = gu.globalBloom;
      shader.uniforms.time = gu.time;
      shader.uniforms.resolution = gu.resolution;
      shader.uniforms.split = gu.split;
      shader.vertexShader = `
          varying vec3 vPos;
          ${shader.vertexShader}
        `.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
          vPos = vec3(modelMatrix * vec4(position, 1.));
          `
        );
      shader.fragmentShader = `
          uniform float globalBloom;
          uniform float time;
          ${splitPars}
          varying vec3 vPos;
          
          #define ss(a, b, c) smoothstep(a, b, c)
          
          ${fbm}
          ${shader.fragmentShader}
        `.replace(
          `#include <dithering_fragment>`,
          `#include <dithering_fragment>
          float t = time * 0.2;
          float d = clamp(fbm((vPos - vec3(0, 1, 0) * t) * 2.5), 0., 1.);
          float dissolve = 0.5;
          
          ${split}
          
          if((sUv.x > 0.) && (vPos.y < 0.5 || d < dissolve) ) discard;
          
          float solidify = ss(dissolve + 0.2, dissolve, d);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.75, 1, 0.875), solidify);
          gl_FragColor.rgb = mix(vec3(0.25, 0.25, 0.5), gl_FragColor.rgb, ss(-fsUv, fsUv, sUv.x));
          
          ${darkenMaterial}
          `
        );
    };
    tree.scale.multiplyScalar( 7 );
    scene.add( tree );
    
    // <TREE_POINTS>
    let treePts = [];
    let treeNor = [];
    let treeIsText = [];
    let treeTargetPos = [];
    let treeTargetPos2 = [];
    let treeRandom = [];

    const cyberTextPts1 = generateCyberTreeTextPoints(
      'Hello',
      'Aye Myat Mon',
      '900 105px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      '900 112px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      0.34,
      0.68
    );
    const cyberTextPts2 = generateCyberTreeTextPoints(
      'Sending lots of prayers',
      'your way',
      '900 78px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      '900 102px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      0.35,
      0.68
    );

    const numCyberTextPts1 = cyberTextPts1.length / 3;
    const numCyberTextPts2 = cyberTextPts2.length / 3;
    let cyberTextCounter = 0;

    const sampler = new MeshSurfaceSampler( tree ).build();
    
    let _position = new THREE.Vector3();
    let _normal = new THREE.Vector3();
    
    let foliageCounter = 0;
    while(foliageCounter < 75000){
      sampler.sample( _position, _normal);
      if (_position.length() > 0.45){
        treePts.push(_position.clone().multiplyScalar(7));
        if (Math.random() < 0.33) _normal.randomDirection();
        treeNor.push(_normal.x, _normal.y, _normal.z, Math.random());
        treeRandom.push(Math.random(), Math.random(), Math.random());

        if (foliageCounter % 4 === 0 && cyberTextCounter < 18000 && numCyberTextPts1 > 0 && numCyberTextPts2 > 0) {
          treeIsText.push(1.0);
          const idx1 = (cyberTextCounter % numCyberTextPts1) * 3;
          treeTargetPos.push(
            cyberTextPts1[idx1] + (Math.random() - 0.5) * 0.012,
            cyberTextPts1[idx1 + 1] + (Math.random() - 0.5) * 0.012,
            cyberTextPts1[idx1 + 2] + (Math.random() - 0.5) * 0.025
          );

          const idx2 = ((cyberTextCounter * 13 + 7) % numCyberTextPts2) * 3;
          treeTargetPos2.push(
            cyberTextPts2[idx2] + (Math.random() - 0.5) * 0.012,
            cyberTextPts2[idx2 + 1] + (Math.random() - 0.5) * 0.012,
            cyberTextPts2[idx2 + 2] + (Math.random() - 0.5) * 0.025
          );
          cyberTextCounter++;
        } else {
          treeIsText.push(0.0);
          treeTargetPos.push(0, 0, 0);
          treeTargetPos2.push(0, 0, 0);
        }

        foliageCounter++;
      }
    }
    
    let treePointsG = new THREE.BufferGeometry().setFromPoints(treePts);
    treePointsG.setAttribute("treeNor", new THREE.Float32BufferAttribute(treeNor, 4));
    treePointsG.setAttribute("aIsText", new THREE.Float32BufferAttribute(treeIsText, 1));
    treePointsG.setAttribute("aTargetPos", new THREE.Float32BufferAttribute(treeTargetPos, 3));
    treePointsG.setAttribute("aTargetPos2", new THREE.Float32BufferAttribute(treeTargetPos2, 3));
    treePointsG.setAttribute("aRandom", new THREE.Float32BufferAttribute(treeRandom, 3));

    let treePointsM = new THREE.PointsMaterial({
      color: 0x88ffaa,
      sizeAttenuation: false,
      size: 5,
      transparent: true,
      onBeforeCompile: shader => {
        shader.uniforms.globalBloom = gu.globalBloom;
        shader.uniforms.time = gu.time;
        shader.uniforms.resolution = gu.resolution;
        shader.uniforms.split = gu.split;
        shader.uniforms.treeTextMorph = gu.treeTextMorph;
        shader.uniforms.treeTextSecondMorph = gu.treeTextSecondMorph;
        shader.uniforms.galaxyWarp = gu.galaxyWarp;
        shader.uniforms.textScale = gu.textScale;
        shader.uniforms.camRight = gu.camRight;
        shader.uniforms.camUp = gu.camUp;
        shader.uniforms.camForward = gu.camForward;
        shader.vertexShader = `
          uniform float time;
          uniform float treeTextMorph;
          uniform float treeTextSecondMorph;
          uniform float galaxyWarp;
          uniform float textScale;
          uniform vec3 camRight;
          uniform vec3 camUp;
          uniform vec3 camForward;
          attribute vec4 treeNor;
          attribute float aIsText;
          attribute vec3 aTargetPos;
          attribute vec3 aTargetPos2;
          attribute vec3 aRandom;
          varying float distRatio;
          varying float vHeight;
          varying float vIsTextMorph;
          varying float vScatterEnvelope;
          varying float vGalaxyWarp;
          varying float vRndX;
          ${noise}
          ${shader.vertexShader}
        `.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
            float easedMorph = treeTextMorph < 0.5
              ? 4.0 * treeTextMorph * treeTextMorph * treeTextMorph
              : 1.0 - pow(-2.0 * treeTextMorph + 2.0, 3.0) / 2.0;

            float isTextPart = step(0.5, aIsText);
            float isFoliage = 1.0 - isTextPart;
            float fillFactor = easedMorph * isFoliage;

            float dist = treeNor.w;
            vec3 newPos = treeNor.xyz * treeNor.w * 1.5;
            newPos.y -= pow(dist, 2.7 * 2.7) * 2.;

            vec3 fillOffset = normalize(treeNor.xyz + aRandom - 0.5) * (sin(aRandom.x * 62.8 + time * 0.8) * 0.42) * fillFactor;
            transformed += newPos * (1.0 + fillFactor * 0.16) + fillOffset;
            
            distRatio = dist;
            
            float t = time * 0.05;
            vec3 sway = vec3(2, 0.5, 0.5) * (0.75 + fillFactor * 0.18);
            vec2 instUV = position.xz / 20.;
            instUV.y *= 0.875;
            instUV.x -= t;
            float n  = snoise(vec3( instUV * 5., t));
            float n2 = snoise(vec3( (instUV + vec2(2.)) * 5., t));
            float n3 = snoise(vec3( (instUV + vec2(-2)) * 10., t));
            n = n * 0.5 + 0.5;
            transformed += sway * dist * vec3(n, n2, n3) * pow(dist, 2.7);

            float stagger = aRandom.x * 0.25 + clamp((aTargetPos.x + 4.5) / 9.0, 0.0, 1.0) * 0.15;
            float localSecond = clamp((treeTextSecondMorph * 1.4 - stagger) / 1.0, 0.0, 1.0);
            float easedSecond = localSecond < 0.5
              ? 4.0 * localSecond * localSecond * localSecond
              : 1.0 - pow(max(0.0, -2.0 * localSecond + 2.0), 3.0) / 2.0;

            vec3 activeTarget = mix(aTargetPos, aTargetPos2, easedSecond);

            float rawSin = max(0.0, sin(localSecond * 3.14159265));
            float scatterEnv = pow(rawSin + 0.00001, 1.15) * step(0.0001, rawSin);

            float theta = aRandom.x * 6.2831853 + localSecond * 4.2;
            float phi = (aRandom.y - 0.5) * 3.14159265;
            float radius = (0.65 + aRandom.z * 1.55) * scatterEnv;

            vec3 fluffyDispersion = vec3(
              cos(theta) * cos(phi) * radius * 1.35 + sin(time * 3.2 + aRandom.y * 12.0) * 0.28 * scatterEnv,
              sin(phi) * radius * 1.15 + scatterEnv * (0.35 + aRandom.x * 0.55),
              sin(theta) * cos(phi) * radius * 0.95
            );

            vec3 textCenter = vec3(0.0, 3.55, 0.0) + camForward * 2.85;
            float microX = sin(time * (2.2 + aRandom.x * 2.0) + aRandom.y * 6.28) * 0.008;
            float microY = cos(time * (2.0 + aRandom.y * 2.0) + aRandom.z * 6.28) * 0.008;
            float waveY = sin(time * 1.6 + activeTarget.x * 1.1) * 0.022;

            vec3 localOffset = (activeTarget + fluffyDispersion) * textScale;

            vec3 textWorldPos = textCenter
              + camRight * (localOffset.x + microX)
              + camUp * (localOffset.y + microY + waveY)
              + camForward * localOffset.z;

            float textMorphAmt = easedMorph * isTextPart;
            float swirlArc = sin(treeTextMorph * 3.14159265) * isTextPart;
            vec3 arcOffset = vec3(cos(aRandom.x * 6.28) * 1.1, 0.85, sin(aRandom.y * 6.28) * 1.1) * swirlArc;

            transformed = mix(transformed, textWorldPos, textMorphAmt) + arcOffset;

            float wProg = smoothstep(0.0, 1.0, galaxyWarp);
            float wCurve = wProg * wProg * (3.0 - 2.0 * wProg);
            float spiralAngle = aRandom.x * 6.2831853 + wCurve * (3.8 + aRandom.y * 2.5);
            float spiralRadius = mix(length(transformed.xz) + 0.4, 2.2 + aRandom.z * 11.5, wCurve);
            vec3 galaxyDiscPos = vec3(
              cos(spiralAngle) * spiralRadius,
              mix(transformed.y, 2.9 + (aRandom.y - 0.5) * 3.8 * (1.0 - 0.45 * wCurve), wCurve),
              sin(spiralAngle) * spiralRadius
            );
            vec3 cosmicBreeze = vec3(
              cos(aRandom.z * 6.28 + time * 1.8),
              sin(aRandom.x * 6.28 + time * 1.5) * 0.5,
              sin(aRandom.y * 6.28 + time * 1.8)
            ) * sin(wProg * 3.14159265) * 0.75;

            transformed = mix(transformed, galaxyDiscPos, wCurve) + cosmicBreeze;

            vHeight = mix(transformed.y, 1.0, textMorphAmt);
            vIsTextMorph = textMorphAmt;
            vScatterEnvelope = scatterEnv * isTextPart;
            vGalaxyWarp = wCurve;
            vRndX = aRandom.x;
          `
        ).replace(
          `gl_PointSize = size;`,
          `float d = 1. - dist;
            d = pow(d, 2.7);
            float foliageSize = size * (0.75 + 0.25 * d) * (1.0 + fillFactor * 0.22);
            float scatterSparkle = 1.0 + vScatterEnvelope * (0.35 * sin(time * 14.0 + aRandom.z * 40.0));
            float textPtSize = size * (0.58 + 0.08 * sin(time * 3.5 + aRandom.x * 20.0)) * scatterSparkle;
            float basePtSize = mix(foliageSize, textPtSize, vIsTextMorph);
            float starSize = size * (0.55 + 0.45 * sin(time * 5.0 + vRndX * 40.0));
            gl_PointSize = mix(basePtSize, starSize, vGalaxyWarp);`
        );
        
        shader.fragmentShader = `
          #define ss(a, b, c) smoothstep(a, b, c)
          uniform float globalBloom;
          uniform float time;
          ${splitPars}
          varying float distRatio;
          varying float vHeight;
          varying float vIsTextMorph;
          varying float vScatterEnvelope;
          varying float vGalaxyWarp;
          varying float vRndX;

          vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
            return a + b * cos( 6.28318 * (c * t + d) );
          }
          ${shader.fragmentShader}
        `.replace(
          `#include <clipping_planes_fragment>`,
          `#include <clipping_planes_fragment>
            vec2 uv = gl_PointCoord * 2. -  1.;
            float dist = length(uv);
            if(dist > 1.) discard;
          `
        ).replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `
          ${split}
          
          float d = pow(ss(0., 1., dist), 2.7);
          vec3 col = mix(1. - diffuse * 0.5, diffuse, ss(-fsUv, fsUv, sUv.x));
          col = col * (0.75 + 0.25 * pow(distRatio, 2.7));

          vec3 galaxySwarmCol = palette(vRndX * 0.8 + time * 0.04, vec3(0.75, 0.55, 0.85), vec3(0.35, 0.3, 0.45), vec3(1.0, 1.0, 1.0), vec3(0.15, 0.35, 0.68));
          vec3 crispTextCol = mix(galaxySwarmCol * 1.15, vec3(1.0, 0.96, 1.0), ss(0.55, 0.0, dist) * 0.4 + vScatterEnvelope * 0.28);
          col = mix(col, crispTextCol, vIsTextMorph);

          vec3 cosmicGalaxyCol = palette(vRndX * 0.8 + time * 0.06, vec3(0.75, 0.55, 0.85), vec3(0.35, 0.3, 0.45), vec3(1.0, 1.0, 1.0), vec3(0.15, 0.35, 0.68));
          col = mix(col, cosmicGalaxyCol * 1.15, vGalaxyWarp);
          
          float od = fwidth(dist);
          float or = ss(1., 1. - od, dist);
          float oh = mix(ss(0.25, 0.75, vHeight), 1.0 - vScatterEnvelope * 0.2, vIsTextMorph);
          float finalAlpha = (or * oh) * (1.0 - smoothstep(0.68, 1.0, vGalaxyWarp));
          
          vec4 diffuseColor = vec4(col, finalAlpha);`
        ).replace(
          `#include <premultiplied_alpha_fragment>`,
          `#include <premultiplied_alpha_fragment>
          ${darkenMaterial}
          `
        );
      }
    });
    let treePoints = new THREE.Points(treePointsG, treePointsM);
    scene.add(treePoints);
  });

  // <POSTPROCESSING>
  const params = {
    bloomStrength: 5,
    bloomThreshold: 0,
    bloomRadius: 1
  };

  const renderScene = new RenderPass( scene, camera );

  const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;

  const bloomComposer = new EffectComposer( renderer );
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass( renderScene );
  bloomComposer.addPass( bloomPass );

  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial( {
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture }
      },
      vertexShader: document.getElementById( 'vertexshader' ).textContent,
      fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
      defines: {}
    } ), 'baseTexture'
  );
  finalPass.needsSwap = true;

  const finalComposer = new EffectComposer( renderer );
  finalComposer.addPass( renderScene );
  finalComposer.addPass( finalPass );

  window.addEventListener("resize", () => {
    isPortraitMobile = innerWidth < 768 || innerWidth < innerHeight;
    baseCyberFov = isPortraitMobile ? 54 : 45;
    camera.fov = baseCyberFov;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    bloomComposer.setSize( innerWidth, innerHeight );
    finalComposer.setSize( innerWidth, innerHeight );
    gu.resolution.value.set(innerWidth, innerHeight);
    gu.textScale.value = getResponsiveTextScale();
  });

  let clock = new THREE.Clock();
  cyberClock = clock;
  let treeMorphStart = null;
  let treeSecondMorphStart = null;
  let entranceProgress = 0;
  const treeMorphDelay = 2.0;
  const treeMorphDuration = 3.4;
  const treeSecondMorphDelay = 7.4;
  const treeSecondMorphDuration = 3.8;

  renderer.setAnimationLoop( _ => {
    let t = cyberEntranceActive ? clock.getElapsedTime() : 0.01;

    if (cyberEntranceActive && entranceProgress < 1.0 && !isSpinningUp) {
      entranceProgress = Math.min(1.0, t / 2.4);
      let easeOutCubic = 1.0 - Math.pow(1.0 - entranceProgress, 3.0);
      camera.fov = (baseCyberFov + 22) - 22 * easeOutCubic;
      camera.updateProjectionMatrix();
      scene.rotation.y = (1.0 - easeOutCubic) * -0.45;
    }

    if (cyberEntranceActive && t > treeMorphDelay) {
      if (treeMorphStart === null) treeMorphStart = t;
      gu.treeTextMorph.value = Math.min(1.0, (t - treeMorphStart) / treeMorphDuration);
    }

    if (cyberEntranceActive && t > treeSecondMorphDelay) {
      if (treeSecondMorphStart === null) treeSecondMorphStart = t;
      gu.treeTextSecondMorph.value = Math.min(1.0, (t - treeSecondMorphStart) / treeSecondMorphDuration);
    }

    if (isSpinningUp && spinStartTime !== null) {
      let warpElapsed = t - spinStartTime;
      let warpDuration = 3.5;
      let wNorm = Math.min(1.0, warpElapsed / warpDuration);
      let smoothWarp = wNorm * wNorm * (3.0 - 2.0 * wNorm);
      gu.galaxyWarp.value = smoothWarp;

      let envFade = Math.max(0.0, 1.0 - Math.min(1.0, warpElapsed / 1.8));
      ground.position.y = -smoothWarp * 5.5;
      l.position.y = -smoothWarp * 5.5;
      thing.position.y = -smoothWarp * 18.0;
      beetleM.opacity = envFade;
      sstructM.opacity = 0.25 * envFade;
      if (treeMeshRef) {
        treeMeshRef.material.opacity = envFade;
      }
      if (treeLinesRef) {
        treeLinesRef.material.opacity = 0.75 * envFade;
      }

      c.setHex(0x244832).lerp(new THREE.Color(0x010102), Math.min(1.0, warpElapsed / 2.0));
      renderer.setClearColor(c);

      scene.rotation.y = smoothWarp * 2.2;
      scene.position.y = -smoothWarp * 1.1;
      controls.target.y = 2.8 + smoothWarp * 1.4;

      gu.time.value = t + smoothWarp * 3.5;

      // Zoom-out ပြန်ဖြစ်သွားခြင်းကို ကာကွယ်ရန် FOV ကို တိုးမည့်အစား အနည်းငယ် လျှော့ချ၍ အတွင်းသို့ တစ်သမတ်တည်း Zoom-in ဆွဲဝင်ပျောက်ကွယ်စေခြင်း
      camera.fov = Math.max(14, baseCyberFov - smoothWarp * 26);
      camera.updateProjectionMatrix();

      bloomPass.strength = 5.0 - smoothWarp * 1.6;
    } else {
      gu.time.value = t;
    }

    gu.split.value.y = 0.5 + Math.sin(t) * 0.1;
    gu.split.value.z = (Math.PI / 24) * Math.sin(t * 0.314);
    controls.update();

    camera.updateMatrixWorld();
    gu.camRight.value.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    gu.camUp.value.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    gu.camForward.value.setFromMatrixColumn(camera.matrixWorld, 2).normalize();

    gu.globalBloom.value = 1;
    
    bloomComposer.render();
    gu.globalBloom.value = 0;
    finalComposer.render();
  });
};

const yearTrack = document.getElementById("yearTrack");
const dateTrack = document.getElementById("dateTrack");
const photoMatrixWrapper = document.getElementById("photoMatrixWrapper");
const photoMatrix = document.getElementById("photoMatrix");
const birthdayReveal = document.getElementById("birthdayReveal");
const timeMachine = document.querySelector(".time-machine");
const cyberEthnoContainer = document.getElementById("cyber-ethno-container");
const enterGalaxyBtn = document.getElementById("enterGalaxyBtn");
const fpWrapper = document.getElementById("fpWrapper");
const fpHint = document.getElementById("fpHint");
const galaxyContainer = document.getElementById("galaxy-container");
const toLoveStoryBtn = document.getElementById("toLoveStoryBtn");
const loveStoryContainer = document.getElementById("love-story-container");

// Upload လုပ်ပေးထားသော ပုံ (၉) ပုံ (VS Code နှင့် GitHub Repository ထဲတွင် ထားရှိရမည့် ပုံအမည်များ)
const uploadedPhotos = [
  "photo1.jpg",
  "photo2.jpg",
  "photo3.jpg",
  "photo4.jpg",
  "photo5.jpg",
  "photo6.jpg",
  "photo7.jpg",
  "photo8.jpg",
  "photo9.jpg"
];

// GitHub Pages (Linux Server) တွင် ပုံအမည် သို့မဟုတ် Folder လမ်းကြောင်း လွဲနေပါက အလိုအလျောက် ရှာဖွေပေးမည့် Helper Function
function attachSmartImageFallback(imgEl, originalSrc, fallbackLabel) {
  const cleanName = originalSrc.replace(/^\.\//, "");
  const baseName = cleanName.replace(/\.(jpg|jpeg|png|webp|heic|heif)$/i, "");
  const numMatch = baseName.match(/\d+/);
  const num = numMatch ? numMatch[0] : "";

  // GitHub ပေါ်တွင် ဖြစ်နိုင်ခြေရှိသော ပုံနာမည်နှင့် Folder ပုံစံအားလုံးကို အစဉ်လိုက် စမ်းသပ်ရှာဖွေပေးမည်
  const candidates = [
    `${baseName}.JPG`,
    `${baseName}.jpeg`,
    `${baseName}.JPEG`,
    `${baseName}.png`,
    `${baseName}.PNG`,
    `${baseName}.webp`,
    `Photo${num}.jpg`,
    `Photo${num}.JPG`,
    `photo ${num}.jpg`,
    `Photo ${num}.jpg`,
    `${baseName}.jpg.jpg`,
    `images/${cleanName}`,
    `img/${cleanName}`,
    `photos/${cleanName}`,
    `assets/${cleanName}`
  ];
  let tryIndex = 0;

  imgEl.onerror = function() {
    if (tryIndex < candidates.length) {
      this.src = candidates[tryIndex++];
    } else {
      this.onerror = null;
      this.src = `https://placehold.co/300x300/1f1711/f2d394?text=${encodeURIComponent(fallbackLabel + " Not Found")}`;
    }
  };
}

// 3x3 ဘောင် ပျောက်သွားပြီးနောက် သီးသန့်ပေါ်လာမည့် ၁၁ စက္ကန့်စာ Video Clip (id="foryou" အတွက် ဗီဒီယိုဖိုင်အမည်)
const forYouSpecialVideo = "foryou.mp4";
let forYouVideoEl = document.getElementById("foryou");

// အကယ်၍ index.html ထဲတွင် <img> အဟောင်း ကျန်နေခဲ့ပါကလည်း <video> အဖြစ် အလိုအလျောက် ပြောင်းလဲပေးမည်
if (forYouVideoEl && forYouVideoEl.tagName.toLowerCase() !== "video") {
  const newVideo = document.createElement("video");
  newVideo.id = "foryou";
  newVideo.className = "foryou-full-video";
  newVideo.src = forYouSpecialVideo;
  newVideo.muted = false;
  newVideo.volume = 1.0;
  newVideo.playsInline = true;
  newVideo.loop = true;
  newVideo.preload = "auto";
  newVideo.setAttribute("playsinline", "");
  newVideo.setAttribute("webkit-playsinline", "");
  newVideo.setAttribute("loop", "");
  forYouVideoEl.replaceWith(newVideo);
  forYouVideoEl = newVideo;
} else if (forYouVideoEl) {
  forYouVideoEl.src = forYouSpecialVideo;
  forYouVideoEl.removeAttribute("muted");
  forYouVideoEl.muted = false;
  forYouVideoEl.volume = 1.0;
  forYouVideoEl.loop = true;
  forYouVideoEl.playsInline = true;
  forYouVideoEl.setAttribute("playsinline", "");
  forYouVideoEl.setAttribute("webkit-playsinline", "");
  forYouVideoEl.setAttribute("loop", "");
  if (typeof forYouVideoEl.load === "function") {
    forYouVideoEl.load();
  }
}

// Array တစ်ခုကို Random ရောမွှေပေးသည့် Helper Function (Fisher-Yates Shuffle)
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Year Counter နှင့် Date Counter တို့အတွက် အစတွင် (14, 2004) မှ စတင်ပြီး အလယ်တွင် Random ခုနှစ်နှင့် ရက်စွဲများ ခုန်ပေါက်လည်ပတ်ကာ အဆုံးတွင် (14, 2026) ၌ တိကျစွာ ရပ်တန့်စေခြင်း
const totalItems = 36;
document.documentElement.style.setProperty("--total-steps", totalItems);

yearTrack.innerHTML = "";
dateTrack.innerHTML = "";

let prevRandomYear = 2004;
let prevRandomDay = 14;

for (let i = 0; i < totalItems; i++) {
  const yearRow = document.createElement("span");
  const dateRow = document.createElement("span");

  if (i === 0) {
    // စမှတ်: 14, 2004
    yearRow.textContent = "2004";
    dateRow.textContent = "14";
  } else if (i === totalItems - 1) {
    // ဆုံးမှတ်: 14, 2026
    yearRow.textContent = "2026";
    dateRow.textContent = "14";
  } else {
    // ကြားအဆင့်များတွင် ကပ်လျက်ဂဏန်း မထပ်စေဘဲ Random ခုနှစ် (1998 မှ 2030 အတွင်း) နှင့် Random ရက်စွဲ (01 မှ 31 အတွင်း) ထုတ်ပေးခြင်း
    let randYear;
    do {
      randYear = Math.floor(Math.random() * (2029 - 1999 + 1)) + 1999;
    } while (randYear === prevRandomYear);
    prevRandomYear = randYear;

    let randDay;
    do {
      randDay = Math.floor(Math.random() * 31) + 1;
    } while (randDay === prevRandomDay);
    prevRandomDay = randDay;

    yearRow.textContent = String(randYear);
    dateRow.textContent = String(randDay).padStart(2, "0");
  }

  yearTrack.appendChild(yearRow);
  dateTrack.appendChild(dateRow);
}

// 3x3 ဓာတ်ပုံဇယားကွက်အတွင်း photo1 မှ photo9 တို့ကို နေရာအသေမထားဘဲ
// စဖွင့်ချိန်၊ Roll လည်နေချိန်နှင့် အဆုံးသတ်ရပ်တန့်ချိန်တို့တွင် Random နေရာများဖြင့် ပေါ်လာစေရန် စီစဉ်ခြင်း
const photoTracks = [];
const cellConfigs = [
  { dir: "roll-up",   steps: 25 },
  { dir: "roll-down", steps: 30 },
  { dir: "roll-up",   steps: 20 },
  { dir: "roll-down", steps: 25 },
  { dir: "roll-up",   steps: 30 },
  { dir: "roll-down", steps: 20 },
  { dir: "roll-up",   steps: 25 },
  { dir: "roll-down", steps: 30 },
  { dir: "roll-up",   steps: 25 }
];

// အစတွင် ပြသမည့် 3x3 ပုံ (၉) ပုံကို Random နေရာချထားခြင်း
const initialGridPhotos = shuffleArray(uploadedPhotos);

// Roll လည်ပတ်ပြီးနောက် အဆုံးသတ် ရပ်တန့်ချိန်တွင်လည်း မူလနေရာနှင့် မတူညီဘဲ ပုံ (၉) ပုံလုံး နေရာအသစ်များဖြင့် Random ပေါ်လာစေခြင်း
let finalGridPhotos = shuffleArray(uploadedPhotos);
for (let i = 0; i < finalGridPhotos.length; i++) {
  if (finalGridPhotos[i] === initialGridPhotos[i]) {
    const swapIdx = (i + 1) % finalGridPhotos.length;
    [finalGridPhotos[i], finalGridPhotos[swapIdx]] = [finalGridPhotos[swapIdx], finalGridPhotos[i]];
  }
}

cellConfigs.forEach((cfg, cellIdx) => {
  const cell = document.createElement("div");
  cell.className = "photo-cell";

  const track = document.createElement("div");
  track.className = `photo-cell__track ${cfg.dir}`;
  track.style.setProperty("--cell-steps", cfg.steps);

  const startPhoto = initialGridPhotos[cellIdx];
  const endPhoto = finalGridPhotos[cellIdx];

  // Roll-up သည် step 0 မှ စတင်ပြီး နောက်ဆုံး step (cfg.steps - 1) တွင် ရပ်တန့်သည်
  // Roll-down သည် နောက်ဆုံး step (cfg.steps - 1) မှ စတင်ပြီး step 0 တွင် ရပ်တန့်သည်
  const firstStepPhoto = cfg.dir === "roll-up" ? startPhoto : endPhoto;
  const lastStepPhoto = cfg.dir === "roll-up" ? endPhoto : startPhoto;

  let prevImgSrc = firstStepPhoto;

  for (let step = 0; step < cfg.steps; step++) {
    const item = document.createElement("div");
    item.className = "photo-cell__item";

    const img = document.createElement("img");
    let currentImgSrc;

    if (step === 0) {
      currentImgSrc = firstStepPhoto;
    } else if (step === cfg.steps - 1) {
      currentImgSrc = lastStepPhoto;
    } else {
      // ကြားအဆင့်များတွင် ပုံ (၉) ပုံလုံးထဲမှ ကပ်လျက်မထပ်စေဘဲ Random ရွေးချယ်၍ Roll လည်ပတ်စေခြင်း
      let candidates = uploadedPhotos.filter(p => p !== prevImgSrc);
      if (step === cfg.steps - 2) {
        candidates = candidates.filter(p => p !== lastStepPhoto);
      }
      currentImgSrc = candidates[Math.floor(Math.random() * candidates.length)];
    }
    prevImgSrc = currentImgSrc;

    img.src = currentImgSrc;
    img.alt = `Memory Photo ${cellIdx + 1}`;
    attachSmartImageFallback(img, currentImgSrc, `Photo ${cellIdx + 1}`);

    item.appendChild(img);
    track.appendChild(item);
  }

  cell.appendChild(track);
  photoMatrix.appendChild(cell);
  photoTracks.push(track);
});

const engageBtn = document.getElementById("engageBtn");
const clock = document.getElementById("clock");
const lamp = document.getElementById("lamp");
const statusText = document.getElementById("statusText");
const temporalPortalOverlay = document.getElementById("temporalPortalOverlay");

// နာရီလက်တံ (၃) ချောင်းလုံး Browser အားလုံးတွင် ချို့ယွင်းချက်မရှိ အတိအကျ လည်ပတ်စေမည့် Web Animations API Function
function animateClockHandsReliable() {
  const hourHand = clock.querySelector(".clock__hand--hour");
  const minuteHand = clock.querySelector(".clock__hand--minute");
  const secondHand = clock.querySelector(".clock__hand--second");

  const animOptions = {
    duration: 12000,
    easing: "ease-in-out",
    fill: "forwards"
  };

  if (hourHand && hourHand.animate) {
    hourHand.animate(
      [{ transform: "rotate(30deg)" }, { transform: "rotate(2160deg)" }],
      animOptions
    );
  }
  if (minuteHand && minuteHand.animate) {
    minuteHand.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(12960deg)" }],
      animOptions
    );
  }
  if (secondHand && secondHand.animate) {
    secondHand.animate(
      [{ transform: "rotate(180deg)" }, { transform: "rotate(51840deg)" }],
      animOptions
    );
  }
}

engageBtn.addEventListener("click", () => {
  engageBtn.classList.add("hidden");

  // ပထမဆုံး အသံထွက်ခဲ့သည့် Loop ပုံစံအတိုင်း ခလုတ်နှိပ်ချိန်တွင် ဗီဒီယိုကို Pause မလုပ်ဘဲ Loop ဖြင့် တောက်လျှောက် Play ထားမည် (ပထမ ၁၂ စက္ကန့်အတွင်း အသံမထွက်စေရန် volume ကို 0 ထားမည်)
  if (forYouVideoEl && typeof forYouVideoEl.play === "function") {
    forYouVideoEl.removeAttribute("muted");
    forYouVideoEl.muted = false;
    forYouVideoEl.loop = true;
    forYouVideoEl.volume = 0;
    forYouVideoEl.currentTime = 0;
    forYouVideoEl.play().catch(err => {
      console.warn("Initial video play warning:", err);
    });
  }

  clock.classList.add("active");
  animateClockHandsReliable();
  yearTrack.classList.add("active");
  dateTrack.classList.add("active");
  photoMatrixWrapper.classList.add("rolling");
  photoTracks.forEach(track => track.classList.add("active"));
  lamp.classList.add("active");
  statusText.textContent = "ADVANCING TO 14, 2026";

  // အရေးကြီးသော အဆင့်: Animation လည်နေစဉ် (၈ စက္ကန့်အကြာတွင်) နောက်ကွယ်၌ Cyber 3D Tree နှင့် Shaders များကို ကြိုတင် Load လုပ်ထားမည်။
  // ထို့ကြောင့် စာမျက်နှာအကူးအပြောင်းတွင် လုံးဝ (လုံးဝ) ထစ်သွားခြင်း မရှိတော့ပါ။
  setTimeout(() => {
    if (window.initCyberEthno) window.initCyberEthno(true);
  }, 8000);

  // ၁၂ စက္ကန့်ပြည့်၍ Spin/Roll Animation ရပ်သွားသည့်အချိန် (14, 2026 နှင့် ၁၂ နာရီတိတိသို့ ရောက်ရှိချိန်)
  setTimeout(() => {
    statusText.textContent = "ARRIVAL COMPLETE (14, 2026)";
    photoMatrixWrapper.classList.remove("rolling");

    // အဆင့် (၁): 3x3 ဇယားကွက်နှင့် သူ့ရဲ့ ဘောင် (Frame) ပါ အရင်ဆုံး Fade Out ဖြစ်သွားမည်
    photoMatrixWrapper.classList.add("fade-out");
    // အဆင့် (၂): ဘောင် Fade Out ဖြစ်သွားပြီးမှ (900ms အကြာတွင်) foryou ဗီဒီယိုဘောင် ပေါ်လာသည်နှင့် အစ (0s) မှ အသံအပြည့် (volume = 1.0) ဖြင့် ပွင့်လာမည်
    setTimeout(() => {
      birthdayReveal.classList.add("visible");

      if (forYouVideoEl) {
        try {
          forYouVideoEl.currentTime = 0;
        } catch (e) {}
        forYouVideoEl.muted = false;
        forYouVideoEl.volume = 1.0;
        if (forYouVideoEl.paused && typeof forYouVideoEl.play === "function") {
          forYouVideoEl.play().catch(err => {
            console.warn("Video play retry:", err);
          });
        }
      }

      // အဆင့် (၃): Video အရှည် ၁၁ စက္ကန့် (11000ms) အပြည့် ပြသပြီးသည့်အခါမှ Portal Transition စတင်မည်
      setTimeout(() => {
        requestAnimationFrame(() => {
          // 3D Camera Entrance ကို စတင်နှိုးဆော်ခြင်း
          if (window.startCyberEthnoEntrance) window.startCyberEthnoEntrance();

          // ရွှေရောင်နှင့် Cyber Cyan အလင်းစက်ဝိုင်းများ ဖြာထွက်လာသည့် Portal Overlay
          if (temporalPortalOverlay) temporalPortalOverlay.classList.add("active");

          // Time Machine သည် အနောက်သို့ အနည်းငယ်ဆုတ်၍ အရှိန်ယူပြီးမှ ကင်မရာရှေ့သို့ ချောမွေ့စွာ ဆွဲဝင်ပျောက်ကွယ်မည်
          timeMachine.classList.add("zoom-out");

          // Portal အလင်းပွင့်ထွက်လာချိန်နှင့် ချိန်သားကိုက်ပြီး Cyber သစ်ပင်မြင်ကွင်း ပေါ်ထွက်လာမည်
          setTimeout(() => {
            cyberEthnoContainer.classList.add("visible");
          }, 320);

          // Transition ပြီးဆုံးသွားသည်နှင့် Video ကို လုံးဝပိတ်သိမ်းမည်
          setTimeout(() => {
            if (forYouVideoEl) {
              if (typeof forYouVideoEl.pause === "function") {
                forYouVideoEl.pause();
              }
              forYouVideoEl.muted = true;
              forYouVideoEl.volume = 0;
            }
            timeMachine.style.display = "none";
          }, 2500);
        });
      }, 11000);
    }, 900);
  }, 12000);
});

let warpTriggered = false;
function startGalaxyWarp() {
  if (warpTriggered) return;
  warpTriggered = true;

  enterGalaxyBtn.style.pointerEvents = "none";
  enterGalaxyBtn.classList.add("activating");
  if (fpWrapper) {
    fpWrapper.classList.add("activating");
    fpWrapper.style.transition = "opacity 1.2s ease, transform 1.2s ease";
    setTimeout(() => {
      fpWrapper.style.opacity = "0";
      fpWrapper.style.transform = "translateX(-50%) scale(0.85)";
    }, 400);
  }
  if (fpHint) fpHint.textContent = "ASCENDING TO GALAXY...";

  // Galaxy ကို အဆင်သင့်ကြိုတင်ဖန်တီးထားမည်
  initGalaxy();

  // သစ်ပင်အမှုန်များ Galaxy အရောင်နှင့် ဝဲဂယက်ပုံစံသို့ ပြောင်းလဲနေစဉ်အတွင်း Galaxy မြင်ကွင်းက မသိမသာ ပေါင်းစပ်ပေါ်ထွက်လာမည်
  if (window.triggerCyberWarp) {
    window.triggerCyberWarp(
      () => {
        // Crossfade Start: သစ်ပင်အမှုန်များ ကြယ်မှုန်အဖြစ် ပျံ့နှံ့နေချိန်တွင် Galaxy က ညင်သာစွာ စတင်ပေါ်လာမည်
        if (window.startGalaxyEntrance) window.startGalaxyEntrance();
        galaxyContainer.classList.add("visible");
        cyberEthnoContainer.classList.add("zoom-out");
      },
      () => {
        // Complete: ကူးပြောင်းမှု အပြည့်အစုံ ပြီးဆုံးချိန်တွင် Cyber Scene ကို ပိတ်သိမ်းမည်
        cyberEthnoContainer.style.display = "none";
        if (window.stopCyberEthno) window.stopCyberEthno();
      }
    );
  } else {
    if (window.startGalaxyEntrance) window.startGalaxyEntrance();
    cyberEthnoContainer.classList.add("zoom-out");
    galaxyContainer.classList.add("visible");
  }
}

enterGalaxyBtn.addEventListener("click", startGalaxyWarp);
enterGalaxyBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startGalaxyWarp();
}, { passive: false });

// ====== GENERATE 3D POINTS FOR "Happy Birthday Bae Bae" ======
function generateTextPoints() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // အပေါ်စာကြောင်း: Happy Birthday
  ctx.font = '900 105px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillText('Happy Birthday', c.width / 2, c.height * 0.35);

  // အောက်စာကြောင်း: Bae Bae
  ctx.font = '900 130px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.fillText('Bae Bae', c.width / 2, c.height * 0.68);

  const imgData = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts = [];

  // Pixel များကို စစ်ဆေးပြီး စာသားရှိသည့်နေရာများကို 3D Coordinates အဖြစ် ပြောင်းလဲခြင်း
  // Black hole (အချင်းဝက် 12) နှင့် လုံးဝမကွယ်စေရန် အမြင့် (Y-offset) ကို 27.0 သို့ မြှင့်တင်ထားပါသည်
  for (let y = 0; y < c.height; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const alpha = imgData[(y * c.width + x) * 4];
      if (alpha > 128) {
        const px = (x - c.width / 2) * 0.105;
        const py = -(y - c.height / 2) * 0.105 + 27.0;
        const pz = (Math.random() - 0.5) * 2.5;
        pts.push(px, py, pz);
      }
    }
  }
  return pts;
}

// ====== THREE.JS GALAXY & TEXT MORPHING ANIMATION ======
let galaxyInitialized = false;
let galaxyRunning = true;
function initGalaxy() {
  if (galaxyInitialized) return;
  galaxyInitialized = true;

  const err = document.getElementById('err');
  function showError(msg){ err.textContent = msg; err.style.display='block'; }

  try { 
    const test = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
    if(!test) throw new Error('Tu navegador no tiene WebGL activo');
  } catch(e) { showError('WebGL parece desactivado.'); return; }

  try {
    const canvas = document.getElementById('galaxy-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x010102, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    const OrbitControlsClass = window.THREE && window.THREE.OrbitControls ? window.THREE.OrbitControls : OrbitControls;
    const controls = new OrbitControlsClass(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 10;
    controls.maxDistance = 220;
    // Black hole နှင့် အပေါ်ဘက်ရှိ စာသားနှစ်ခုလုံး မြင်ကွင်းအလယ်တွင် လှပစွာပေါ်နေစေရန် ချိန်ညှိထားသည်
    controls.target.set(0, 9, 0);

    function getGalaxyTextScale() {
      const aspect = window.innerWidth / window.innerHeight;
      // 6 လက်မ ဖုန်းမျက်နှာပြင်ပေါ်တွင် "Happy Birthday / Bae Bae" စာသား ဘေးမပြတ်ဘဲ ကွက်တိပေါ်စေရန်
      if (aspect < 0.85) {
        return Math.max(0.55, Math.min(0.88, aspect * 1.25));
      }
      return 1.0;
    }

    let particleMaterial = null;

    function setCam() {
      const w = window.innerWidth, h = window.innerHeight;
      const isMobile = w < 768 || w < h;
      camera.fov = isMobile ? 88 : 75;
      camera.position.set(0, isMobile ? 30 : 28, isMobile ? 124 : 88);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (particleMaterial) {
        particleMaterial.uniforms.uTextScale.value = getGalaxyTextScale();
      }
      controls.update();
    }
    setCam();
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      setCam();
    });

    // Galaxy Group (Phrases + Background Galaxy Particles)
    const galaxy = new THREE.Group();
    scene.add(galaxy);

    const phrases = ["Pinchecha ✨", " Hermosa 💛", "Mi Bebe", "Mi Cielito 🌌", "Hermosota ✨", "Mi Infinita ♾️", "Mi Todo", "Me Encantas 🥰", " Perla 💫", "Te Amo💛", "Mi Canción Favorita 🎶", "Unica 😊", "Mi Reina 👑", "Mi Amor", "Mi Mundo", "Mi Luz 🌠", "Mi Niña", "Mi Tesoro💛", "Mi Paz", "Mi Eterna", "Mi Sueño", "Mi Pensamiento Favorito", "Mi Bombom", "Mi Diosa", "Te Amo Infinitamente ♾️"];
    const phraseCount = Math.max(phrases.length * 6, 180);
    const arms = 5, radius = 82, maxH = 22;

    function makeTextTexture(text, size=48){
      const c=document.createElement('canvas'); c.width=1024; c.height=128;
      const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height);
      g.font='800 '+size+'px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial';
      g.textAlign='center'; g.textBaseline='middle';
      g.shadowColor='rgba(210,140,255,0.95)'; g.shadowBlur=24;
      g.fillStyle='rgba(255,240,255,0.98)'; g.fillText(text,c.width/2,c.height/2);
      return new THREE.CanvasTexture(c);
    }

    const phraseSprites = [];
    for(let i=0;i<phraseCount;i++){
      const text = phrases[i%phrases.length];
      const tex=makeTextTexture(text,48);
      const spr=new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false }));
      spr.isPhrase=true;
      const perArm=phraseCount/arms; const ang=(i%perArm)*(Math.PI*2/perArm);
      const armAng=Math.floor(i/perArm)*(Math.PI*2/arms);
      const dist=Math.pow(i/phraseCount,0.72)*radius;
      const thickness=Math.pow(1-(dist/radius),2);
      const x=Math.cos(ang+armAng)*dist, z=Math.sin(ang+armAng)*dist, y=(Math.random()-0.5)*maxH*thickness*.9;
      spr.position.set(x,y,z); spr.scale.set(20,2.6,1); galaxy.add(spr);
      phraseSprites.push(spr);
    }

    // ====== 360° PANORAMIC ROTATING PHOTO BACKGROUND (GALAXY THEME MATCHED) ======
    const bgPhotoDomeGroup = new THREE.Group();
    scene.add(bgPhotoDomeGroup);

    // 360° နောက်ခံအပြည့် ကြယ်မှုန်နှင့် Nebula အလင်းရောင်စက်လုံး (Cosmic Starfield & Nebula Sphere)
    const nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = 1024;
    nebulaCanvas.height = 512;
    const nCtx = nebulaCanvas.getContext('2d');
    const nebGrad = nCtx.createLinearGradient(0, 0, 0, 512);
    nebGrad.addColorStop(0, '#04010a');
    nebGrad.addColorStop(0.32, '#130626');
    nebGrad.addColorStop(0.5, '#240b3b');
    nebGrad.addColorStop(0.68, '#130626');
    nebGrad.addColorStop(1, '#04010a');
    nCtx.fillStyle = nebGrad;
    nCtx.fillRect(0, 0, 1024, 512);

    for (let s = 0; s < 550; s++) {
      const sx = Math.random() * 1024;
      const sy = Math.random() * 512;
      const sr = Math.random() * 1.6 + 0.3;
      nCtx.fillStyle = Math.random() > 0.3 ? 'rgba(240, 215, 255, 0.7)' : 'rgba(255, 210, 160, 0.75)';
      nCtx.beginPath();
      nCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      nCtx.fill();
    }

    const nebulaTex = new THREE.CanvasTexture(nebulaCanvas);
    const nebulaSphere = new THREE.Mesh(
      new THREE.SphereGeometry(480, 48, 32),
      new THREE.MeshBasicMaterial({
        map: nebulaTex,
        side: THREE.BackSide,
        transparent: false,
        depthWrite: false
      })
    );
    nebulaSphere.renderOrder = -10;
    bgPhotoDomeGroup.add(nebulaSphere);

    function createCosmicFramedPhotoTexture(imgSource, indexLabel) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 640;
      const ctx = c.getContext('2d');
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;

      function drawCard(imageElement) {
        ctx.clearRect(0, 0, c.width, c.height);

        const outerGlow = ctx.createRadialGradient(256, 320, 180, 256, 320, 315);
        outerGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
        outerGlow.addColorStop(0.75, 'rgba(195, 125, 255, 0.28)');
        outerGlow.addColorStop(1, 'rgba(10, 2, 22, 0)');
        ctx.fillStyle = outerGlow;
        ctx.fillRect(0, 0, c.width, c.height);

        ctx.save();
        const pad = 28;
        const w = c.width - pad * 2;
        const h = c.height - pad * 2;
        const r = 38;

        ctx.beginPath();
        ctx.moveTo(pad + r, pad);
        ctx.lineTo(pad + w - r, pad);
        ctx.quadraticCurveTo(pad + w, pad, pad + w, pad + r);
        ctx.lineTo(pad + w, pad + h - r);
        ctx.quadraticCurveTo(pad + w, pad + h, pad + w - r, pad + h);
        ctx.lineTo(pad + r, pad + h);
        ctx.quadraticCurveTo(pad, pad + h, pad, pad + h - r);
        ctx.lineTo(pad, pad + r);
        ctx.quadraticCurveTo(pad, pad, pad + r, pad);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = '#000000';
        ctx.fillRect(pad, pad, w, h);

        if (imageElement) {
          const imgRatio = imageElement.width / imageElement.height;
          const boxRatio = w / h;
          let drawW = w, drawH = h, offsetX = pad, offsetY = pad;
          if (imgRatio > boxRatio) {
            drawW = h * imgRatio;
            offsetX = pad - (drawW - w) * 0.5;
          } else {
            drawH = w / imgRatio;
            offsetY = pad - (drawH - h) * 0.5;
          }
          ctx.drawImage(imageElement, offsetX, offsetY, drawW, drawH);
        } else {
          const fbGrad = ctx.createLinearGradient(pad, pad, pad + w, pad + h);
          fbGrad.addColorStop(0, '#2a0e46');
          fbGrad.addColorStop(1, '#120422');
          ctx.fillStyle = fbGrad;
          ctx.fillRect(pad, pad, w, h);
        }

        ctx.strokeStyle = 'rgba(255, 235, 255, 0.95)';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.restore();
        tex.needsUpdate = true;
      }

      drawCard(null);
      const img = new Image();
      const cleanName = imgSource.replace(/^\.\//, "");
      const baseName = cleanName.replace(/\.(jpg|jpeg|png|webp|heic|heif)$/i, "");
      const numMatch = baseName.match(/\d+/);
      const num = numMatch ? numMatch[0] : "";
      const candidates = [
        `${baseName}.JPG`,
        `${baseName}.jpeg`,
        `${baseName}.JPEG`,
        `${baseName}.png`,
        `${baseName}.PNG`,
        `${baseName}.webp`,
        `Photo${num}.jpg`,
        `Photo${num}.JPG`,
        `photo ${num}.jpg`,
        `images/${cleanName}`,
        `photos/${cleanName}`
      ];
      let extIdx = 0;

      img.onload = () => drawCard(img);
      img.onerror = () => {
        if (extIdx < candidates.length) {
          img.src = candidates[extIdx++];
        } else {
          const fb = new Image();
          fb.crossOrigin = 'anonymous';
          fb.onload = () => drawCard(fb);
          fb.src = `https://placehold.co/512x640/1e0936/f2d394?text=Memory+${indexLabel}`;
        }
      };
      img.src = imgSource;

      return tex;
    }

    const cosmicPhotoTextures = uploadedPhotos.map((src, idx) =>
      createCosmicFramedPhotoTexture(src, idx + 1)
    );

    const bgRingConfigs = [
      { count: 9, radius: 195, y: 8,   panelW: 78, panelH: 98, tiltX: 0.0,   speed: -0.042, opacity: 1.0 },
      { count: 9, radius: 220, y: 86,  panelW: 72, panelH: 90, tiltX: 0.24,  speed:  0.028, opacity: 1.0 },
      { count: 9, radius: 220, y: -70, panelW: 72, panelH: 90, tiltX: -0.24, speed:  0.032, opacity: 1.0 }
    ];

    const bgPhotoRings = [];
    const bgPhotoMaterials = [];

    bgRingConfigs.forEach((ringCfg, rIdx) => {
      const ringGroup = new THREE.Group();
      ringGroup.userData = { speed: ringCfg.speed, baseY: ringCfg.y };

      const panelGeo = new THREE.PlaneGeometry(ringCfg.panelW, ringCfg.panelH, 16, 1);
      const posAttr = panelGeo.attributes.position;
      for (let k = 0; k < posAttr.count; k++) {
        const px = posAttr.getX(k);
        const curveZ = -Math.pow(px / (ringCfg.panelW * 0.5), 2) * 4.2;
        posAttr.setZ(k, curveZ);
      }
      panelGeo.computeVertexNormals();

      for (let i = 0; i < ringCfg.count; i++) {
        const angle = (i / ringCfg.count) * Math.PI * 2 + (rIdx * Math.PI / 9);
        const tex = cosmicPhotoTextures[(i + rIdx * 3) % cosmicPhotoTextures.length];

        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.05,
          opacity: 1.0,
          depthWrite: true,
          depthTest: true,
          toneMapped: false,
          side: THREE.DoubleSide
        });
        mat.userData = { baseOpacity: 1.0, phase: i * 0.7 + rIdx * 1.3 };
        bgPhotoMaterials.push(mat);

        const mesh = new THREE.Mesh(panelGeo, mat);
        mesh.renderOrder = -2;
        mesh.position.set(
          Math.cos(angle) * ringCfg.radius,
          ringCfg.y + Math.sin(i * 1.4) * 5.0,
          Math.sin(angle) * ringCfg.radius
        );
        mesh.lookAt(0, ringCfg.y * 0.35, 0);
        ringGroup.add(mesh);
      }

      bgPhotoDomeGroup.add(ringGroup);
      bgPhotoRings.push(ringGroup);
    });

    // ====== GLSL SHADER: PARTIAL GALAXY TO "Happy Birthday Bae Bae" TEXT & FIREWORKS ======
    const particleCount = 70000;
    const textPoints = generateTextPoints();
    const numTextPoints = textPoints.length / 3;

    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const ids = new Float32Array(particleCount);
    const randoms = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const isTextAttr = new Float32Array(particleCount);

    let textPtCounter = 0;

    for (let i = 0; i < particleCount; i++) {
      ids[i] = i / particleCount;
      randoms[i * 3] = Math.random();
      randoms[i * 3 + 1] = Math.random();
      randoms[i * 3 + 2] = Math.random();

      if (i % 3 === 0 && textPtCounter < 21000 && numTextPoints > 0) {
        isTextAttr[i] = 1.0;
        const ptIdx = (textPtCounter % numTextPoints) * 3;
        targetPositions[i * 3]     = textPoints[ptIdx] + (Math.random() - 0.5) * 0.35;
        targetPositions[i * 3 + 1] = textPoints[ptIdx + 1] + (Math.random() - 0.5) * 0.35;
        targetPositions[i * 3 + 2] = textPoints[ptIdx + 2] + (Math.random() - 0.5) * 1.2;
        textPtCounter++;
      } else if (i % 7 === 1) {
        isTextAttr[i] = 2.0;
        targetPositions[i * 3]     = 0;
        targetPositions[i * 3 + 1] = 0;
        targetPositions[i * 3 + 2] = 0;
      } else {
        isTextAttr[i] = 0.0;
        targetPositions[i * 3]     = 0;
        targetPositions[i * 3 + 1] = 0;
        targetPositions[i * 3 + 2] = 0;
      }
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('aId', new THREE.BufferAttribute(ids, 1));
    particleGeo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
    particleGeo.setAttribute('aTargetPos', new THREE.BufferAttribute(targetPositions, 3));
    particleGeo.setAttribute('aIsText', new THREE.BufferAttribute(isTextAttr, 1));

    particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMorphProgress: { value: 0.0 },
        uRedTransition: { value: 0.0 },
        uTextScale: { value: getGalaxyTextScale() },
        uGalaxyRotY: { value: 0.0 },
        uCamRight: { value: new THREE.Vector3(1, 0, 0) },
        uCamUp: { value: new THREE.Vector3(0, 1, 0) },
        uCamForward: { value: new THREE.Vector3(0, 0, 1) },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uMorphProgress;
        uniform float uRedTransition;
        uniform float uTextScale;
        uniform float uGalaxyRotY;
        uniform vec3 uCamRight;
        uniform vec3 uCamUp;
        uniform vec3 uCamForward;
        uniform vec2 uMouse;
        uniform float uPixelRatio;

        attribute float aId;
        attribute vec3 aRandom;
        attribute vec3 aTargetPos;
        attribute float aIsText;

        varying vec3 vColor;
        varying float vAlpha;

        #define PI 3.14159265359

        vec3 palette( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
            return a + b * cos( 6.28318 * (c * t + d) );
        }

        vec3 getGalaxySwarm(float id, vec3 rnd, float fillProgress) {
            float arms = 5.0;
            float minR = 4.0;
            float maxR = 90.0;

            float radialDrift = sin(id * 317.13) * 0.045 * fillProgress;
            float normDist = clamp(pow(rnd.x, 0.76) + radialDrift, 0.0, 1.0);
            float dist = mix(minR, maxR, normDist);

            float armIndex = floor(rnd.y * arms);
            float armAngle = armIndex * (PI * 2.0 / arms);
            float spiralTwist = dist * 0.095;
            float orbitSpeed = 0.5;

            float spreadBoost = 1.0 + fillProgress * 0.22;
            float armSpread = (rnd.z - 0.5) * (0.55 + normDist * 1.15) * spreadBoost;
            float angularFill = cos(id * 512.7) * 0.14 * fillProgress;

            float angle = armAngle + spiralTwist + uTime * orbitSpeed * (1.0 / (dist * 0.1 + 0.5)) + armSpread + angularFill;

            float thickness = pow(1.0 - normDist, 1.75);
            float baseH = (fract(id * 419.73) - 0.5) * 24.0 * thickness;
            float spiralWaveY = sin(dist * 0.22 - uTime * 2.0 + armIndex) * 1.8 * thickness;

            return vec3(cos(angle) * dist, baseH + spiralWaveY, sin(angle) * dist);
        }

        vec3 getTextShape(float id, vec3 rnd, vec3 target) {
            float waveY = sin(uTime * 1.8 + target.x * 0.12) * 0.35;
            float waveZ = cos(uTime * 1.5 + target.y * 0.12) * 0.35;

            float speed = 2.2 + rnd.x * 3.0;
            float phaseX = id * 431.7 + rnd.x * PI * 2.0;
            float phaseY = id * 719.3 + rnd.y * PI * 2.0;
            float phaseZ = id * 913.1 + rnd.z * PI * 2.0;

            float jitterX = sin(uTime * speed + phaseX) * (0.18 + rnd.y * 0.25);
            float jitterY = cos(uTime * (speed * 1.15) + phaseY) * (0.18 + rnd.z * 0.25);
            float jitterZ = sin(uTime * (speed * 0.85) + phaseZ) * (0.4 + rnd.x * 0.6);

            vec3 center = vec3(0.0, 25.5, 0.0);
            float localX = (target.x * uTextScale) + jitterX * uTextScale;
            float localY = ((target.y - 27.0) * uTextScale) + (waveY + jitterY) * uTextScale;
            float localZ = target.z + waveZ + jitterZ;

            vec3 worldPos = center + uCamRight * localX + uCamUp * localY + uCamForward * localZ;

            float c = cos(-uGalaxyRotY);
            float s = sin(-uGalaxyRotY);
            return vec3(
                worldPos.x * c + worldPos.z * s,
                worldPos.y,
                -worldPos.x * s + worldPos.z * c
            );
        }

        float cubicInOut(float t) {
            return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
        }

        void main() {
            float isText = step(0.5, aIsText) * step(aIsText, 1.5);
            float isFirework = step(1.5, aIsText);
            float isBgGalaxy = 1.0 - step(0.5, aIsText);

            float easedProgress = cubicInOut(uMorphProgress);
            float fillFactor = easedProgress * isBgGalaxy;

            vec3 p1 = getGalaxySwarm(aId, aRandom, fillFactor);
            
            float tiltX = uMouse.y * 0.18;
            float tiltZ = -uMouse.x * 0.18;
            mat3 rotX = mat3(
                1.0, 0.0, 0.0,
                0.0, cos(tiltX), -sin(tiltX),
                0.0, sin(tiltX), cos(tiltX)
            );
            mat3 rotZ = mat3(
                cos(tiltZ), -sin(tiltZ), 0.0,
                sin(tiltZ), cos(tiltZ), 0.0,
                0.0, 0.0, 1.0
            );
            p1 = rotZ * rotX * p1;

            vec3 p2 = getTextShape(aId, aRandom, aTargetPos);

            float effectiveMorph = easedProgress * isText;
            vec3 finalPos = mix(p1, p2, effectiveMorph);

            float swirlMask = sin(uMorphProgress * PI) * isText;
            finalPos += vec3(0.0, swirlMask * 4.5, swirlMask * 3.0);

            vec3 colGalaxy = palette(aRandom.x * 0.8 + uTime * 0.04, vec3(0.75, 0.55, 0.85), vec3(0.35, 0.3, 0.45), vec3(1.0, 1.0, 1.0), vec3(0.15, 0.35, 0.68));
            vec3 colText = colGalaxy;
            vColor = mix(colGalaxy, colText, effectiveMorph);

            float baseAlpha = (0.35 + 0.65 * sin(uTime * 5.0 + aId * PI * 20.0)) * (1.0 + fillFactor * 0.25);
            float textTwinkle = 0.65 + 0.35 * sin(uTime * (3.5 + aRandom.y * 4.0) + aId * 500.0);
            vAlpha = mix(clamp(baseAlpha, 0.0, 1.0), textTwinkle, effectiveMorph);

            float baseSize = (2.2 + aRandom.x * 2.8) * (1.0 + fillFactor * 0.18);
            float textPulse = 1.0 + 0.28 * cos(uTime * (3.0 + aRandom.z * 3.5) + aId * 300.0);
            float textSize = (3.0 + aRandom.x * 2.0) * textPulse;
            float finalPointSize = mix(baseSize, textSize, effectiveMorph);

            if (isFirework > 0.5 && uMorphProgress > 0.01) {
                float fwGroup = floor(aId * 8.0);
                float cycleDur = 5.0;
                float localTime = uTime + fwGroup * 0.85;
                float cycleIdx = floor(localTime / cycleDur);
                float t = fract(localTime / cycleDur);

                float side = mod(fwGroup, 2.0) == 0.0 ? -1.0 : 1.0;
                float seed = fwGroup * 17.3 + cycleIdx * 31.7;
                float launchX = side * (32.0 + 28.0 * fract(sin(seed) * 437.5));
                float launchZ = (fract(cos(seed * 1.3) * 219.3) - 0.5) * 65.0;
                float burstHeight = 20.0 + 20.0 * fract(sin(seed * 2.1) * 113.1);

                vec3 launchBase = vec3(launchX, 0.0, launchZ);
                vec3 apexWorld = vec3(launchX, burstHeight, launchZ);

                float c = cos(-uGalaxyRotY);
                float s = sin(-uGalaxyRotY);
                vec3 launchLocal = vec3(launchBase.x * c + launchBase.z * s, 0.0, -launchBase.x * s + launchBase.z * c);
                vec3 apexLocal = vec3(apexWorld.x * c + apexWorld.z * s, burstHeight, -apexWorld.x * s + apexWorld.z * c);

                float theta = aRandom.x * PI * 2.0;
                float phi = acos(2.0 * aRandom.y - 1.0);
                float speed = (10.0 + aRandom.z * 16.0) * (0.65 + 0.35 * fract(sin(aId * 999.0) * 100.0));
                vec3 burstDir = vec3(
                    sin(phi) * cos(theta),
                    cos(phi),
                    sin(phi) * sin(theta)
                ) * speed;

                float hue = fract(seed * 0.19 + aRandom.z * 0.28);
                vec3 fwCol = palette(hue, vec3(0.6, 0.6, 0.6), vec3(0.45, 0.45, 0.45), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
                fwCol = mix(fwCol, vec3(1.0, 0.97, 0.88), 0.25);

                vec3 fwPos = p1;
                vec3 targetCol = colGalaxy;
                float targetAlpha = baseAlpha;
                float targetSize = baseSize;

                if (t < 0.16) {
                    float p = smoothstep(0.0, 0.16, t);
                    fwPos = mix(p1, launchLocal, p);
                    targetCol = mix(colGalaxy, vec3(1.0, 0.92, 0.65), p);
                    targetAlpha = mix(baseAlpha, 0.95, p);
                    targetSize = mix(baseSize, 3.6, p);
                } else if (t < 0.34) {
                    float p = (t - 0.16) / 0.18;
                    float easeOut = 1.0 - pow(1.0 - p, 2.2);
                    float trailLag = aRandom.z * 0.18;
                    float rocketP = clamp(easeOut - trailLag, 0.0, 1.0);
                    vec3 spiralJitter = vec3(cos(p * 25.0 + aId * 50.0), 0.0, sin(p * 25.0 + aId * 50.0)) * (1.0 - p) * 1.2;
                    fwPos = mix(launchLocal, apexLocal, rocketP) + spiralJitter;
                    targetCol = mix(vec3(1.0, 0.95, 0.75), fwCol, p);
                    targetAlpha = 1.0;
                    targetSize = 4.2;
                } else if (t < 0.78) {
                    float p = (t - 0.34) / 0.44;
                    float expand = 1.0 - pow(1.0 - p, 2.6);
                    float gravity = 28.0 * p * p;
                    fwPos = apexLocal + burstDir * expand + vec3(0.0, -gravity, 0.0);

                    float sparkle = 0.55 + 0.45 * sin(uTime * 28.0 + aId * 1200.0);
                    targetCol = mix(vec3(1.0), fwCol, smoothstep(0.0, 0.22, p));
                    targetAlpha = mix(1.0, 0.65, p) * sparkle;
                    targetSize = mix(5.2, 2.6, p);
                } else {
                    float p = (t - 0.78) / 0.22;
                    float smoothReturn = smoothstep(0.0, 1.0, p);
                    vec3 fallenPos = apexLocal + burstDir + vec3(0.0, -28.0, 0.0);
                    fwPos = mix(fallenPos, p1, smoothReturn);
                    targetCol = mix(fwCol, colGalaxy, smoothReturn);
                    targetAlpha = mix(0.65, baseAlpha, smoothReturn);
                    targetSize = mix(2.6, baseSize, smoothReturn);
                }

                finalPos = mix(p1, fwPos, easedProgress);
                vColor = mix(colGalaxy, targetCol, easedProgress);
                vAlpha = mix(clamp(baseAlpha, 0.0, 1.0), targetAlpha, easedProgress);
                finalPointSize = mix(baseSize, targetSize, easedProgress);
            }

            if (uRedTransition > 0.001) {
                float rProg = smoothstep(0.0, 1.0, uRedTransition);
                vec3 crimsonCol = mix(
                    vec3(0.85, 0.0, 0.08),
                    vec3(1.0, 0.18, 0.28),
                    sin(aId * 120.0 + uTime * 6.0) * 0.5 + 0.5
                );
                vColor = mix(vColor, crimsonCol, rProg);
                vAlpha = mix(vAlpha, 1.0, rProg * 0.75);
                finalPointSize *= (1.0 + rProg * 0.65);
                finalPos.y += rProg * rProg * (8.0 + aRandom.y * 12.0);
            }

            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            gl_PointSize = finalPointSize * uPixelRatio * (45.0 / max(-mvPosition.z, 1.0));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec2 uv = gl_PointCoord.xy - vec2(0.5);
            float dist = length(uv);

            if (dist > 0.5) discard;

            float alpha = smoothstep(0.5, 0.1, dist);
            gl_FragColor = vec4(vColor, alpha * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const shaderParticles = new THREE.Points(particleGeo, particleMaterial);
    galaxy.add(shaderParticles);

    const mouse = new THREE.Vector2(0, 0);
    const targetMouse = new THREE.Vector2(0, 0);

    window.addEventListener('mousemove', (e) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        targetMouse.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        targetMouse.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    }, { passive: true });

    const coreR=12;
    const coreTexCanvas=document.createElement('canvas'); coreTexCanvas.width=coreTexCanvas.height=256;
    const cg=coreTexCanvas.getContext('2d'); const grd=cg.createRadialGradient(128,128,10,128,128,128);
    grd.addColorStop(0,'#140018'); grd.addColorStop(0.6,'#090012'); grd.addColorStop(1,'#000'); cg.fillStyle=grd; cg.arc(128,128,128,0,Math.PI*2); cg.fill();
    const core=new THREE.Mesh(new THREE.SphereGeometry(coreR,64,64), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(coreTexCanvas) }));
    core.renderOrder=1; scene.add(core);

    const photonRing=new THREE.Mesh(new THREE.RingGeometry(coreR*1.05, coreR*1.18, 128), new THREE.MeshBasicMaterial({ color:0xEAAEFF, transparent:true, opacity:0.95, side:THREE.DoubleSide }));
    photonRing.rotation.x=-Math.PI/2; photonRing.renderOrder=0.5; scene.add(photonRing);

    let galaxyClockStarted = false;
    let morphStartTime = null;
    const morphDuration = 4.2;
    const morphDelay = 2.6;

    const shaderClock = new THREE.Clock(false);
    window.startGalaxyEntrance = function() {
      if (!galaxyClockStarted) {
        galaxyClockStarted = true;
        shaderClock.start();
      }
    };

    let redTransitionActive = false;
    let redStartTime = null;
    const redDuration = 2.4;

    window.triggerRedGalaxyTransition = function(onComplete) {
      if (redTransitionActive) return;
      redTransitionActive = true;
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2500);
    };

    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const camForward = new THREE.Vector3();
    const origRingColor = new THREE.Color(0xEAAEFF);
    const redRingColor = new THREE.Color(0xd00000);
    const origClearColor = new THREE.Color(0x010102);
    const redClearColor = new THREE.Color(0x1a0000);

    function animate(){
      if (!galaxyRunning) return;
      requestAnimationFrame(animate);
      const delta = galaxyClockStarted ? shaderClock.getDelta() : 0.0;
      const elapsedTime = galaxyClockStarted ? shaderClock.getElapsedTime() : 0.0;

      mouse.x += (targetMouse.x - mouse.x) * delta * 2.0;
      mouse.y += (targetMouse.y - mouse.y) * delta * 2.0;

      if (galaxyClockStarted && elapsedTime < 2.6) {
        const glideP = Math.min(1.0, elapsedTime / 2.6);
        const easeOut = 1.0 - Math.pow(1.0 - glideP, 3.0);
        galaxy.scale.setScalar(0.86 + 0.14 * easeOut);
      } else {
        galaxy.scale.setScalar(1.0);
      }

      if (galaxyClockStarted && elapsedTime > morphDelay) {
        if (!morphStartTime) morphStartTime = elapsedTime;
        let progress = (elapsedTime - morphStartTime) / morphDuration;
        if (progress > 1.0) progress = 1.0;
        particleMaterial.uniforms.uMorphProgress.value = progress;
      }

      if (redTransitionActive) {
        if (redStartTime === null) redStartTime = elapsedTime;
        let rProg = Math.min(1.0, (elapsedTime - redStartTime) / redDuration);
        particleMaterial.uniforms.uRedTransition.value = rProg;

        photonRing.material.color.lerpColors(origRingColor, redRingColor, rProg);
        renderer.setClearColor(origClearColor.clone().lerp(redClearColor, rProg), 1);
        for (let i = 0; i < phraseSprites.length; i++) {
          phraseSprites[i].material.color.setRGB(1.0, 1.0 - rProg * 0.78, 1.0 - rProg * 0.78);
        }
        for (let i = 0; i < bgPhotoMaterials.length; i++) {
          bgPhotoMaterials[i].color.setRGB(1.0, 1.0 - rProg * 0.75, 1.0 - rProg * 0.75);
          bgPhotoMaterials[i].opacity = bgPhotoMaterials[i].userData.baseOpacity * (1.0 - rProg * 0.55);
        }
      } else {
        for (let i = 0; i < bgPhotoMaterials.length; i++) {
          bgPhotoMaterials[i].opacity = 1.0;
        }
      }

      const rotY = elapsedTime * 0.05;
      galaxy.rotation.y = rotY;

      nebulaSphere.rotation.y = -elapsedTime * 0.015;
      for (let i = 0; i < bgPhotoRings.length; i++) {
        const rg = bgPhotoRings[i];
        rg.rotation.y = elapsedTime * rg.userData.speed;
        rg.position.y = Math.sin(elapsedTime * 0.5 + i * 1.5) * 3.5;
      }

      controls.update();

      camera.updateMatrixWorld();
      camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      camForward.setFromMatrixColumn(camera.matrixWorld, 2).normalize();

      particleMaterial.uniforms.uTime.value = elapsedTime;
      particleMaterial.uniforms.uGalaxyRotY.value = rotY;
      particleMaterial.uniforms.uCamRight.value.copy(camRight);
      particleMaterial.uniforms.uCamUp.value.copy(camUp);
      particleMaterial.uniforms.uCamForward.value.copy(camForward);
      particleMaterial.uniforms.uMouse.value.copy(mouse);

      core.rotation.y = elapsedTime * 0.12;
      photonRing.rotation.z = elapsedTime * 0.18;
      renderer.render(scene, camera);
    }
    animate();

    // ====== HEARTS OVERLAY (double tap/click) ======
    const fx = document.getElementById('fx');
    const ctx2 = fx.getContext('2d');
    function resizeFx(){
      fx.width = Math.floor(innerWidth * Math.min(2, window.devicePixelRatio||1));
      fx.height = Math.floor(innerHeight * Math.min(2, window.devicePixelRatio||1));
      fx.style.width = innerWidth + 'px';
      fx.style.height = innerHeight + 'px';
    }
    addEventListener('resize', resizeFx); resizeFx();
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const hearts = [];
    function spawnHearts(x,y,n=20){
      x *= DPR; y *= DPR;
      for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2;
        hearts.push({x,y,vx:Math.cos(a)*(0.6+Math.random()*0.8),vy:-(0.8+Math.random()*1.2),life:1,size:10+Math.random()*16});
      }
    }
    function drawHeart(x,y,size){
      const s=size; ctx2.save(); ctx2.translate(x,y);
      ctx2.beginPath(); ctx2.moveTo(0,-0.25*s);
      ctx2.bezierCurveTo(.5*s,-.9*s,1.4*s,-.1*s,0,.9*s);
      ctx2.bezierCurveTo(-1.4*s,-.1*s,-.5*s,-.9*s,0,-.25*s);
      const g=ctx2.createRadialGradient(0,0,0,0,0,s);
      g.addColorStop(0,'rgba(255,190,220,.95)'); g.addColorStop(1,'rgba(255,90,160,0)');
      ctx2.fillStyle=g; ctx2.fill(); ctx2.restore();
    }
    let lastTap=0;
    addEventListener('click', (e)=>{ const now=performance.now(); if(now-lastTap<320) spawnHearts(e.clientX,e.clientY,20); lastTap=now; }, {passive:true});
    addEventListener('touchend', (e)=>{ const now=performance.now(); const t=e.changedTouches&&e.changedTouches[0]; if(now-lastTap<320&&t) spawnHearts(t.clientX,t.clientY,20); lastTap=now; }, {passive:true});

    function loopFx(){
      if (!galaxyRunning) return;
      ctx2.clearRect(0,0,fx.width,fx.height);
      for(let i=hearts.length-1;i>=0;i--){
        const h=hearts[i]; h.x+=h.vx; h.y+=h.vy; h.vy-=0.02; h.life-=0.015;
        ctx2.globalAlpha=Math.max(0,h.life); drawHeart(h.x,h.y,h.size); ctx2.globalAlpha=1; if(h.life<=0) hearts.splice(i,1);
      }
      requestAnimationFrame(loopFx);
    }
    loopFx();

  } catch(e) { showError('Error cargando la galaxia: '+e.message); console.error(e); }
}

// ====== 3D MUSIC PLAYER LOGIC ======
const songs = [
  {
    name: "Happy Birthday Bae Bae",
    artist: "Special Wish",
    source: "./song.mp3", 
    cover: "./photo1.jpg"
  }
];
let currentSongId = 0;
let sketchCreated = false;
let giftFinaleTriggered = false;
let giftBoxOpened = false;

const songEl = document.getElementById("bgAudioEl");
const songNameEl = document.getElementById("songNameEl");
const songArtistEl = document.getElementById("songArtistEl");
const progressEl = document.getElementById("musicProgress");
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");

// GitHub ပေါ်တွင် song.mp3 အမည် အကြီး/အသေး သို့မဟုတ် လမ်းကြောင်း ကွဲနေပါက အလိုအလျောက် ရှာဖွေပေးခြင်း
const songCandidates = ["./song.mp3", "song.mp3", "./Song.mp3", "Song.mp3", "./SONG.MP3", "./music/song.mp3", "./assets/song.mp3"];
let songCandidateIdx = 0;

if (songEl) {
  songEl.addEventListener("error", () => {
    if (songCandidateIdx < songCandidates.length) {
      songEl.src = songCandidates[songCandidateIdx++];
      songEl.load();
      songEl.play().catch(() => {});
    }
  });
}

function updateSongInfo() {
  const currentSong = songs[currentSongId];
  songNameEl.textContent = currentSong.name;
  songArtistEl.textContent = currentSong.artist;
  if (!songEl.getAttribute("src")) {
    songEl.src = currentSong.source;
    songEl.load();
  }
}

// စာမျက်နှာ စဖွင့်ကတည်းက ./song.mp3 ကို ကြိုတင် Load လုပ်ထားခြင်း
updateSongInfo();

function initMusicPlayerBackground() {
  if (sketchCreated) return;
  sketchCreated = true;
  
  const fragmentShader = `
    uniform vec3 uTopLeftColor;
    uniform vec3 uTopRightColor;
    uniform vec3 uBottomLeftColor;
    uniform vec3 uBottomRightColor;

    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
    vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}

    float simplexNoise2D(vec2 v){
      const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
      vec2 i=floor(v+dot(v,C.yy));
      vec2 x0=v-i+dot(i,C.xx);
      vec2 i1;
      i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
      vec4 x12=x0.xyxy+C.xxzz;
      x12.xy-=i1;
      i=mod289(i);
      vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
      vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
      m=m*m; m=m*m;
      vec3 x=2.*fract(p*C.www)-1.;
      vec3 h=abs(x)-.5;
      vec3 ox=floor(x+.5);
      vec3 a0=x-ox;
      m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
      vec3 g;
      g.x=a0.x*x0.x+h.x*x0.y;
      g.yz=a0.yz*x12.xz+h.yz*x12.yw;
      return 130.*dot(m,g);
    }

    void mainImage(out vec4 fragColor,in vec2 fragCoord){
      vec2 uv=fragCoord/iResolution.xy;
      vec3 color=mix(mix(uTopLeftColor,uTopRightColor,uv.x),mix(uBottomLeftColor,uBottomRightColor,uv.x),1.-uv.y);
      float noiseAResolution=.5;
      float noiseBResolution=1.;
      float noiseAVelocity=iTime*.05;
      float noiseBVelocity=iTime*.10;
      float noiseA=simplexNoise2D(vec2(uv.x*1.5,uv.y*1.5-noiseAVelocity)*noiseAResolution)*.35+.15;
      float noiseB=simplexNoise2D(vec2(uv.x+sin(noiseBVelocity*1.50)*.25,uv.y*1.-noiseBVelocity)*noiseBResolution)*.35+.25;
      color=mix(color,vec3(noiseA*noiseB),.25);
      color=pow(color,vec3(1.3));
      fragColor=vec4(color,1.);
    }
  `;

  class Sketch extends kokomi.Base {
    create() {
      const config = {
        topLeft: '#2b0000',
        topRight: '#4a0000',
        bottomLeft: '#120000',
        bottomRight: '#3a0010',
      };
      this.camera.position.set(0, 0, 1);
      const quad = new kokomi.ScreenQuad(this, {
        fragmentShader,
        shadertoyMode: true,
        uniforms: {
          uTopLeftColor: { value: new THREE.Color(config.topLeft) },
          uTopRightColor: { value: new THREE.Color(config.topRight) },
          uBottomLeftColor: { value: new THREE.Color(config.bottomLeft) },
          uBottomRightColor: { value: new THREE.Color(config.bottomRight) },
        },
      });
      quad.addExisting();
      quad.mesh.position.z = -10000;
      quad.mesh.renderOrder = -1;
      quad.mesh.frustumCulled = false;
      quad.material.depthWrite = false;
    }
  }
  
  try {
    const sketch = new Sketch('#sketch');
    sketch.create();
  } catch(e) { console.warn("Kokomi BG warning", e); }

  const swiperEl = document.querySelector("swiper-container");
  swiperEl.innerHTML = songs.map(song => `<swiper-slide><img src="${song.cover}" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='./photo1.JPG';}else{this.onerror=null;this.src='https://placehold.co/300x300/4a0000/ffd700?text=Cover';}"></swiper-slide>`).join("");
  Object.assign(swiperEl, { initialSlide: currentSongId });
  swiperEl.initialize();

  const swiperSlidesEl = document.querySelectorAll("swiper-slide");
  const getTranslateXYZ = (el) => {
    const style = window.getComputedStyle(el);
    const matrix = window.DOMMatrix ? new DOMMatrixReadOnly(style.transform) : new WebKitCSSMatrix(style.transform);
    return { x: matrix.m41, y: matrix.m42, z: matrix.m43 };
  };
  const calcDepth = () => {
    swiperSlidesEl.forEach((slide) => {
      const { z } = getTranslateXYZ(slide);
      slide.style.filter = `blur(${Math.abs(z / 100)}px)`;
      slide.style.opacity = `${Math.max(1 - Math.abs(z / 1600), 0)}`;
    });
  };
  const calcDepthRaf = () => window.requestAnimationFrame(() => {
    calcDepth();
    window.requestAnimationFrame(calcDepthRaf);
  });
  calcDepthRaf();
}

songEl.addEventListener("timeupdate", () => {
  if (!songEl.paused) progressEl.value = songEl.currentTime;
});
songEl.addEventListener("loadedmetadata", () => {
  progressEl.max = songEl.duration;
  progressEl.value = songEl.currentTime;
});
songEl.addEventListener("ended", () => {
  const statusText = document.getElementById('songStatusText');
  if (statusText) statusText.textContent = "သီချင်းပြီးဆုံးသွားပါပြီ — လက်ဆောင်ထုပ်လေး ပွင့်လာပါပြီ 🎁✨";
  window.triggerGiftFinaleSequence();
});

const playSong = () => {
  updateSongInfo();
  songEl.muted = false;
  songEl.volume = 1.0;
  const playPromise = songEl.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");
    }).catch(e => {
      console.warn("Audio play retry:", e);
      songEl.load();
      songEl.play().then(() => {
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
      }).catch(() => {});
    });
  }
};
const pauseSong = () => {
  songEl.pause();
  playIcon.classList.remove("hidden");
  pauseIcon.classList.add("hidden");
};
playPauseBtn.addEventListener("click", () => {
  if (songEl.paused) playSong();
  else pauseSong();
});
progressEl.addEventListener("input", () => {
  songEl.currentTime = progressEl.value;
});
progressEl.addEventListener("change", () => {
  playSong();
});

function buildPhotoBouquet() {
  const bouquetGrid = document.getElementById('bouquetPhotosGrid');
  if (!bouquetGrid || bouquetGrid.children.length > 0) return;

  const stemPositions = [
    { x: -72, y: -158, rot: -18, scale: 0.94, z: 2 },
    { x:   0, y: -176, rot:   0, scale: 1.02, z: 3 },
    { x:  72, y: -158, rot:  18, scale: 0.94, z: 2 },
    { x: -100, y: -88, rot: -26, scale: 0.92, z: 4 },
    { x:  -34, y: -98, rot:  -8, scale: 1.0,  z: 5 },
    { x:   34, y: -98, rot:   8, scale: 1.0,  z: 5 },
    { x:  100, y: -88, rot:  26, scale: 0.92, z: 4 },
    { x: -46, y: -24, rot: -10, scale: 1.05, z: 6 },
    { x:  46, y: -24, rot:  10, scale: 1.05, z: 6 }
  ];

  uploadedPhotos.forEach((photoSrc, idx) => {
    const pos = stemPositions[idx % stemPositions.length];
    const stem = document.createElement('div');
    stem.className = 'bouquet-photo-stem';
    stem.style.setProperty('--bx', `${pos.x}px`);
    stem.style.setProperty('--by', `${pos.y}px`);
    stem.style.setProperty('--brot', `${pos.rot}deg`);
    stem.style.setProperty('--bscale', pos.scale);
    stem.style.zIndex = pos.z;

    const img = document.createElement('img');
    img.src = photoSrc;
    img.alt = `Bouquet Memory ${idx + 1}`;
    attachSmartImageFallback(img, photoSrc, `Bae Bae ${idx + 1}`);

    stem.appendChild(img);
    bouquetGrid.appendChild(stem);
  });
}

window.triggerGiftFinaleSequence = function() {
  if (giftFinaleTriggered) return;
  giftFinaleTriggered = true;

  buildPhotoBouquet();

  const wishesSlider = document.getElementById('wishesSlider');
  const giftStage = document.getElementById('gift-finale-stage');
  const giftBox = document.getElementById('surpriseGiftBox');
  const captionText = document.getElementById('finaleCaptionText');

  if (wishesSlider) {
    wishesSlider.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    wishesSlider.style.opacity = '0';
    wishesSlider.style.transform = 'scale(0.92)';
    wishesSlider.style.pointerEvents = 'none';
  }

  if (giftStage) {
    giftStage.classList.add('visible');
  }

  setTimeout(() => {
    if (giftBox) {
      giftBox.classList.add('appear', 'shaking');
    }
    if (captionText) {
      captionText.textContent = "သင့်အတွက် အထူးမွေးနေ့လက်ဆောင်ထုပ်လေး ပွင့်တော့မယ်နော်... 🎁✨";
    }
  }, 300);

  setTimeout(() => {
    openGiftBoxAndRevealAll();
  }, 2100);
};

function openGiftBoxAndRevealAll() {
  if (giftBoxOpened) return;
  giftBoxOpened = true;

  const giftBox = document.getElementById('surpriseGiftBox');
  const dolls = document.querySelectorAll('#plushieDollsLayer .plushie-doll');
  const photoBouquet = document.getElementById('photoBouquet');
  const captionText = document.getElementById('finaleCaptionText');

  if (giftBox) {
    giftBox.classList.remove('shaking');
    giftBox.classList.add('opened');
  }

  if (captionText) {
    captionText.textContent = "ချစ်စရာ အရုပ်ကလေးတွေ ထွက်လာပါပြီ... 🧸🐰🐱";
  }
  dolls.forEach((doll, idx) => {
    setTimeout(() => {
      doll.classList.add('pop-out');
    }, 250 + idx * 220);
  });

  setTimeout(() => {
    if (photoBouquet) {
      photoBouquet.classList.add('bloom');
    }
    if (captionText) {
      captionText.textContent = "၂၂ နှစ်ပြည့် မွေးနေ့မှာ အမြဲတမ်း ပျော်ရွှင်ပါစေ Bae Bae ရေ 💐🎂❤️";
    }
  }, 1650);
}

window.manualOpenGiftBox = function() {
  openGiftBoxAndRevealAll();
};

// ====== 5-SLIDE BIRTHDAY WISHES & FLOATING BIRTHDAY SIGNS LOGIC ======
let currentSlide = 0;
const slides = document.querySelectorAll('#love-story-container .slide');
const progressBar = document.getElementById('bar');

function updateProgress() {
  const percent = ((currentSlide + 1) / slides.length) * 100;
  progressBar.style.width = percent + "%";
}

window.openFirstWishAndPlayMusic = function() {
  if (songEl.paused) playSong();
  document.getElementById('music-player-controls').classList.add('visible');
  window.next();
};

window.next = function() {
  if (currentSlide < slides.length - 1) {
    slides[currentSlide].classList.remove('active');
    currentSlide++;
    slides[currentSlide].classList.add('active');
    updateProgress();
  }
};

let loveStoryStarted = false;
function initLoveStory() {
  if (loveStoryStarted) return;
  loveStoryStarted = true;

  updateProgress();
  buildPhotoBouquet();
  updateSongInfo();
  initMusicPlayerBackground();

  const canvas = document.getElementById('heartCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const bgBirthdaySigns = [];
  const signTypes = ['cake', 'balloon', 'gift', 'sparkle', 'crown'];

  function createBirthdaySign() {
    bgBirthdaySigns.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 50,
      size: Math.random() * 14 + 12,
      speed: Math.random() * 1.8 + 0.9,
      swayAmp: Math.random() * 0.8 + 0.3,
      swaySpeed: Math.random() * 0.025 + 0.01,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.5 + 0.32,
      type: signTypes[Math.floor(Math.random() * signTypes.length)]
    });
  }

  function drawSignShape(ctx, item) {
    const s = item.size;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.globalAlpha = item.opacity;
    ctx.fillStyle = '#ff4d6d';
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (item.type === 'balloon') {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.62, s * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 0.14, s * 0.88);
      ctx.lineTo(s * 0.14, s * 0.88);
      ctx.lineTo(0, s * 0.74);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, s * 0.88);
      ctx.quadraticCurveTo(s * 0.25, s * 1.25, -s * 0.12, s * 1.6);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 215, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.22, -s * 0.25, s * 0.1, s * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (item.type === 'cake') {
      ctx.fillRect(-s * 0.7, s * 0.1, s * 1.4, s * 0.55);
      ctx.fillRect(-s * 0.5, -s * 0.35, s * 1.0, s * 0.45);
      ctx.fillRect(-s * 0.08, -s * 0.72, s * 0.16, s * 0.37);

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.05);
      ctx.quadraticCurveTo(s * 0.22, -s * 0.82, 0, -s * 0.72);
      ctx.quadraticCurveTo(-s * 0.22, -s * 0.82, 0, -s * 1.05);
      ctx.fill();

    } else if (item.type === 'gift') {
      ctx.fillRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.9);
      ctx.fillRect(-s * 0.64, -s * 0.55, s * 1.28, s * 0.24);

      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-s * 0.1, -s * 0.55, s * 0.2, s * 1.1);
      ctx.fillRect(-s * 0.55, -s * 0.02, s * 1.1, s * 0.16);

      ctx.strokeStyle = '#ffd700';
      ctx.beginPath();
      ctx.ellipse(-s * 0.22, -s * 0.68, s * 0.2, s * 0.11, -0.4, 0, Math.PI * 2);
      ctx.ellipse(s * 0.22, -s * 0.68, s * 0.2, s * 0.11, 0.4, 0, Math.PI * 2);
      ctx.stroke();

    } else if (item.type === 'crown') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.65, s * 0.35);
      ctx.lineTo(-s * 0.75, -s * 0.35);
      ctx.lineTo(-s * 0.28, 0);
      ctx.lineTo(0, -s * 0.55);
      ctx.lineTo(s * 0.28, 0);
      ctx.lineTo(s * 0.75, -s * 0.35);
      ctx.lineTo(s * 0.65, s * 0.35);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(-s * 0.75, -s * 0.42, s * 0.09, 0, Math.PI * 2);
      ctx.arc(0, -s * 0.64, s * 0.11, 0, Math.PI * 2);
      ctx.arc(s * 0.75, -s * 0.42, s * 0.09, 0, Math.PI * 2);
      ctx.fill();

    } else {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? s * 0.85 : s * 0.26;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBirthdaySigns() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = bgBirthdaySigns.length - 1; i >= 0; i--) {
      const sign = bgBirthdaySigns[i];
      sign.y -= sign.speed;
      sign.phase += sign.swaySpeed;
      sign.x += Math.sin(sign.phase) * sign.swayAmp;

      drawSignShape(ctx, sign);

      if (sign.y < -60) {
        bgBirthdaySigns.splice(i, 1);
      }
    }

    requestAnimationFrame(drawBirthdaySigns);
  }

  setInterval(createBirthdaySign, 300);
  drawBirthdaySigns();
}

// Galaxy မှ Birthday Wishes သို့ ကူးပြောင်းသည့် ခလုတ် ("Birthday Wishes 🎂") နှိပ်ချိန် လုပ်ဆောင်ချက်
let loveTransitionTriggered = false;
toLoveStoryBtn.addEventListener("click", () => {
  if (loveTransitionTriggered) return;
  loveTransitionTriggered = true;

  toLoveStoryBtn.classList.add("activating");
  toLoveStoryBtn.textContent = "OPENING WISHES 🎂";

  // ခလုတ်နှိပ်လိုက်သည်နှင့် Browser User Gesture အတွင်းမှာပင် ./song.mp3 ကို တိုက်ရိုက်စတင်ဖွင့်ပေးမည်
  playSong();
  document.getElementById('music-player-controls').classList.add('visible');

  if (window.triggerRedGalaxyTransition) {
    window.triggerRedGalaxyTransition(() => {
      initLoveStory();
      galaxyContainer.classList.add("zoom-out-red");
      loveStoryContainer.classList.add("visible");

      setTimeout(() => {
        galaxyRunning = false;
        galaxyContainer.style.display = "none";
      }, 1800);
    });
  } else {
    initLoveStory();
    galaxyContainer.classList.add("zoom-out-red");
    loveStoryContainer.classList.add("visible");
  }
});
