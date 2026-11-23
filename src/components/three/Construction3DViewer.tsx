import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Eye,
  Home,
  Layers,
  Link2,
  RotateCcw,
  Upload,
} from 'lucide-react';

export type ViewMode3D = 'exterior' | 'interior';
export type CameraPreset = 'fachada' | 'aerea' | 'interior' | 'lateral';

interface Construction3DViewerProps {
  constructionName: string;
  exteriorModelUrl?: string;
  interiorModelUrl?: string;
  onConfigureUrls?: () => void;
}

interface PresetPose {
  position: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<CameraPreset, PresetPose> = {
  fachada: { position: [14.5, 6.2, 15.5], target: [0, 1.8, 0] },
  aerea: { position: [15.5, 16.5, 13.5], target: [0, 0.8, 0] },
  interior: { position: [7.5, 11.2, 8.2], target: [0, 0.6, -0.4] },
  lateral: { position: [-15.2, 5.5, 9.5], target: [0, 1.8, 0] },
};

// Module-level reusable math helpers (Zero GC in render loop)
const _vecTargetPos = new THREE.Vector3();
const _vecTargetLook = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createProceduralTexture(
  kind: 'concrete' | 'porcelain' | 'terrain' | 'timber',
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    if (kind === 'concrete') {
      ctx.fillStyle = '#a8a8a3';
      ctx.fillRect(0, 0, 512, 512);
      // Board-formed architectural concrete horizontal seams
      for (let y = 0; y < 512; y += 64) {
        ctx.fillStyle = y % 128 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, y, 512, 64);
        ctx.fillStyle = 'rgba(55,60,65,0.28)';
        ctx.fillRect(0, y, 512, 2);
      }
      // Subtle mineral speckle
      for (let i = 0; i < 1800; i++) {
        const x = (i * 73) % 512;
        const y = (i * 197) % 512;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (kind === 'porcelain') {
      ctx.fillStyle = '#dde1e6';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#b9c0c9';
      ctx.lineWidth = 2;
      const step = 64;
      for (let i = 0; i <= 512; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    } else if (kind === 'terrain') {
      ctx.fillStyle = '#cbd5c0';
      ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2400; i++) {
        const x = (i * 89) % 512;
        const y = (i * 151) % 512;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(92,115,82,0.12)' : 'rgba(148,136,112,0.08)';
        ctx.fillRect(x, y, 4, 4);
      }
    } else {
      ctx.fillStyle = '#9c734b';
      ctx.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 32) {
        ctx.fillStyle = y % 64 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, y, 512, 30);
        ctx.fillStyle = 'rgba(45,28,14,0.32)';
        ctx.fillRect(0, y + 30, 512, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a multi-part (20+ component) procedural contemporary Brazilian residential
 * construction BIM model with separate exterior shell, roof/slab assembly, and full interior floorplan.
 */
function buildProceduralResidenceModel(maxAnisotropy: number): {
  root: THREE.Group;
  roofGroup: THREE.Group;
  dispose: () => void;
} {
  const root = new THREE.Group();
  const roofGroup = new THREE.Group();

  const concreteTex = createProceduralTexture('concrete', maxAnisotropy);
  concreteTex.repeat.set(2, 1);
  const porcelainTex = createProceduralTexture('porcelain', maxAnisotropy);
  porcelainTex.repeat.set(4, 3);
  const terrainTex = createProceduralTexture('terrain', maxAnisotropy);
  terrainTex.repeat.set(6, 6);
  const timberTex = createProceduralTexture('timber', maxAnisotropy);
  timberTex.repeat.set(3, 2);
  const shadowTex = createRadialContactShadowTexture();

  const textures = [concreteTex, porcelainTex, terrainTex, timberTex, shadowTex];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Materials with deliberate roughness / metalness contrast (>= 0.25 delta)
  const stuccoMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf4f5f7, roughness: 0.88, metalness: 0.02 }),
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.82, metalness: 0.05 }),
  );
  const darkAluminumMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.24, metalness: 0.88 }),
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe3f7,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      clearcoat: 1.0,
    }),
  );
  const porcelainMat = trackMat(
    new THREE.MeshStandardMaterial({ map: porcelainTex, roughness: 0.32, metalness: 0.06 }),
  );
  const timberMat = trackMat(
    new THREE.MeshStandardMaterial({ map: timberTex, roughness: 0.68, metalness: 0.02 }),
  );
  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({ map: terrainTex, roughness: 0.96, metalness: 0.0 }),
  );
  const walkwayMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.86, metalness: 0.04 }),
  );
  const interiorWallMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.85, metalness: 0.02 }),
  );
  const graniteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.22, metalness: 0.18 }),
  );
  const upholsteryMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, metalness: 0.0 }),
  );
  const linenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.9, metalness: 0.0 }),
  );
  const waterproofRoofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78, metalness: 0.08 }),
  );

  const addBox = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    receiveShadow = true,
  ) => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    return mesh;
  };

  // 1. Ground lot & perimeter (extended beyond house with natural site lines)
  const sitePlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(52, 52)), terrainMat);
  sitePlane.rotation.x = -Math.PI / 2;
  sitePlane.position.y = -0.02;
  sitePlane.receiveShadow = true;
  root.add(sitePlane);

  // Contact shadow grounding plane
  const contactMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const contactShadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(21, 17)), contactMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.005, 0);
  root.add(contactShadow);

  // Perimeter low site walls (muros de divisa)
  addBox(root, 18, 1.35, 0.22, 0, 0.675, -7.2, stuccoMat);
  addBox(root, 0.22, 1.35, 14.4, -9, 0.675, 0, stuccoMat);
  addBox(root, 0.22, 1.35, 14.4, 9, 0.675, 0, stuccoMat);

  // Driveway & front stone walkway
  addBox(root, 4.2, 0.06, 5.2, -5.0, 0.03, 5.2, walkwayMat, false, true);
  for (let i = 0; i < 4; i++) {
    addBox(root, 2.0, 0.05, 0.85, 1.2, 0.025, 4.4 + i * 1.1, walkwayMat, false, true);
  }

  // 2. Foundation slab (Radier) + Interior porcelain floor (offset >= 0.02 to prevent Z-fighting)
  addBox(root, 13.4, 0.36, 9.2, 0.2, 0.18, -0.4, concreteMat);
  addBox(root, 12.6, 0.04, 8.4, 0.2, 0.38, -0.4, porcelainMat, false, true);

  // Patio deck in warm timber
  addBox(root, 5.4, 0.34, 2.6, 3.6, 0.17, 4.8, timberMat);

  // 3. Exterior structural walls
  // Back wall
  addBox(root, 12.8, 3.1, 0.24, 0.2, 1.91, -4.7, stuccoMat);
  // Left garage / architectural concrete feature wall
  addBox(root, 0.28, 3.45, 9.6, -6.2, 2.08, -0.1, concreteMat);
  // Right exterior wall with recessed window frame
  addBox(root, 0.24, 3.1, 3.6, 6.6, 1.91, -2.9, stuccoMat);
  addBox(root, 0.24, 3.1, 2.6, 6.6, 1.91, 2.6, stuccoMat);
  addBox(root, 0.24, 0.9, 2.4, 6.6, 0.81, 0.1, stuccoMat);
  addBox(root, 0.24, 0.7, 2.4, 6.6, 3.11, 0.1, stuccoMat);
  // Front left masonry + concrete wing wall
  addBox(root, 4.6, 3.1, 0.24, -3.9, 1.91, 3.8, stuccoMat);
  addBox(root, 0.34, 3.6, 4.2, -1.7, 2.16, 4.6, concreteMat);

  // Front glass facade (Sliding doors with dark aluminum mullions)
  const glassFacadeWidth = 7.8;
  const facadeZ = 3.8;
  addBox(root, glassFacadeWidth, 0.12, 0.14, 2.5, 0.44, facadeZ, darkAluminumMat);
  addBox(root, glassFacadeWidth, 0.14, 0.14, 2.5, 3.36, facadeZ, darkAluminumMat);
  for (let i = 0; i <= 4; i++) {
    const mx = -1.4 + i * (glassFacadeWidth / 4);
    addBox(root, 0.09, 2.95, 0.14, mx, 1.9, facadeZ, darkAluminumMat);
  }
  const frontGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(glassFacadeWidth - 0.1, 2.84, 0.04)),
    glassMat,
  );
  frontGlass.position.set(2.5, 1.9, facadeZ);
  frontGlass.renderOrder = 2;
  root.add(frontGlass);

  // Right window glass & frame
  addBox(root, 0.1, 1.45, 2.4, 6.6, 2.02, 0.1, darkAluminumMat);
  const sideGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 1.32, 2.24)), glassMat);
  sideGlass.position.set(6.6, 2.02, 0.1);
  sideGlass.renderOrder = 2;
  root.add(sideGlass);

  // Pergola timber beams over patio
  addBox(root, 0.18, 2.95, 0.18, 6.1, 1.82, 5.9, darkAluminumMat);
  addBox(root, 0.18, 2.95, 0.18, 1.2, 1.82, 5.9, darkAluminumMat);
  for (let i = 0; i < 6; i++) {
    addBox(root, 0.12, 0.16, 2.3, 1.5 + i * 0.88, 3.25, 4.9, timberMat);
  }

  // 4. Detailed Interior Floorplan (visible in Interior mode & Roof Cutaway)
  // Partition wall separating bedrooms (left wing) from living/kitchen (right wing)
  addBox(root, 0.16, 2.9, 5.4, -1.6, 1.83, -1.9, interiorWallMat);
  // Partition between Master Suite and Bathroom
  addBox(root, 4.4, 2.9, 0.16, -3.9, 1.83, -0.8, interiorWallMat);
  // Bathroom wall
  addBox(root, 0.16, 2.9, 3.6, -4.0, 1.83, 1.9, interiorWallMat);

  // Kitchen cabinetry & granite island
  addBox(root, 4.6, 0.92, 0.7, 3.8, 0.86, -4.15, timberMat);
  addBox(root, 4.64, 0.08, 0.74, 3.8, 1.35, -4.15, graniteMat);
  // Island
  addBox(root, 3.0, 0.9, 1.0, 3.5, 0.85, -1.9, stuccoMat);
  addBox(root, 3.12, 0.08, 1.12, 3.5, 1.33, -1.9, graniteMat);

  // Living room sectional sofa + coffee table
  addBox(root, 3.1, 0.45, 1.0, 2.6, 0.62, 1.4, upholsteryMat);
  addBox(root, 3.1, 0.42, 0.25, 2.6, 0.96, 1.8, upholsteryMat);
  addBox(root, 1.0, 0.45, 1.6, 4.1, 0.62, 1.1, upholsteryMat);
  addBox(root, 1.4, 0.34, 0.8, 2.4, 0.57, 0.1, timberMat);

  // Master suite bed & headboard
  addBox(root, 2.1, 0.48, 2.3, -4.2, 0.64, -3.1, linenMat);
  addBox(root, 2.3, 1.1, 0.14, -4.2, 0.95, -4.35, timberMat);
  // Bathroom vanity
  addBox(root, 1.5, 0.82, 0.55, -2.8, 0.81, 0.2, timberMat);
  addBox(root, 1.56, 0.07, 0.6, -2.8, 1.25, 0.2, graniteMat);

  // 5. Removable Roof & Cantilevered Slab Assembly (roofGroup)
  // Main cantilevered concrete slab (beiral)
  addBox(roofGroup, 14.8, 0.34, 10.6, 0.3, 3.63, -0.2, concreteMat);
  // Raised modern parapet (platibanda)
  addBox(roofGroup, 13.6, 0.72, 0.24, 0.2, 4.16, 4.2, stuccoMat);
  addBox(roofGroup, 13.6, 0.72, 0.24, 0.2, 4.16, -4.7, stuccoMat);
  addBox(roofGroup, 0.24, 0.72, 9.1, -6.5, 4.16, -0.25, stuccoMat);
  addBox(roofGroup, 0.24, 0.72, 9.1, 6.9, 4.16, -0.25, stuccoMat);
  // Roof membrane interior
  addBox(roofGroup, 13.1, 0.08, 8.6, 0.2, 3.84, -0.25, waterproofRoofMat, false, true);
  // Technical volume (caixa d'agua / solar heater tower)
  addBox(roofGroup, 3.2, 1.05, 2.6, -3.8, 4.32, -2.4, stuccoMat);
  addBox(roofGroup, 3.35, 0.14, 2.75, -3.8, 4.9, -2.4, concreteMat);

  // Carport cantilevered canopy on the left
  addBox(roofGroup, 4.4, 0.28, 5.2, -8.3, 3.32, 1.8, concreteMat);
  addBox(root, 0.24, 3.16, 0.24, -10.2, 1.58, 4.1, concreteMat);
  addBox(root, 0.24, 3.16, 0.24, -10.2, 1.58, -0.5, concreteMat);

  root.add(roofGroup);

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { root, roofGroup, dispose };
}

function disposeObjectTree(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const std = m as THREE.MeshStandardMaterial;
        std.map?.dispose();
        std.normalMap?.dispose();
        std.roughnessMap?.dispose();
        std.metalnessMap?.dispose();
        m.dispose();
      });
    }
  });
}

export function Construction3DViewer({
  constructionName,
  exteriorModelUrl,
  interiorModelUrl,
  onConfigureUrls,
}: Construction3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode3D>('exterior');
  const [activePreset, setActivePreset] = useState<CameraPreset>('fachada');
  const [cutawayLevel, setCutawayLevel] = useState<number>(0); // 0 = closed roof, 1 = full interior cutaway
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // External photogrammetry model loading state (Luma AI / GLB / GLTF)
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [externalModelStatus, setExternalModelStatus] = useState<
    'procedural' | 'loading' | 'loaded' | 'error'
  >('procedural');
  const [externalModelMessage, setExternalModelMessage] = useState<string>(
    'Maquete BIM interativa pronta · Compatível com URL .GLB/.GLTF (Luma AI)',
  );

  const activeExternalUrl =
    localBlobUrl || (viewMode === 'exterior' ? exteriorModelUrl?.trim() : interiorModelUrl?.trim());

  // Mutable bridge refs so React state never tears down the WebGLRenderer
  const desiredCutawayRef = useRef<number>(0);
  const cameraGoalRef = useRef<PresetPose | null>(null);
  const triggerRenderRef = useRef<(() => void) | null>(null);
  const loadExternalModelRef = useRef<((url: string | undefined) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [localBlobUrl]);

  // Keyboard shortcut 'H' to toggle Cinema / Zen Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL indisponível neste navegador.');
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL context loss guard
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Contexto WebGL suspenso temporariamente.');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xeef2f7);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0xeef2f7, 0.014);

    // Mandatory studio environment reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 180);
    camera.position.set(...CAMERA_PRESETS.fachada.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.fachada.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 4;
    controls.maxDistance = 42;
    controls.update();

    // 3-point warm/cool architectural lighting rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.2);
    keyLight.position.set(16, 22, 14);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 65;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc7d9f8, 0.75);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    // Subtle interior warm accent light
    const interiorPointLight = new THREE.PointLight(0xffdfa8, 2.4, 14, 1.4);
    interiorPointLight.position.set(2.2, 2.7, 0.2);
    scene.add(interiorPointLight);

    // Architectural site grid for engineering scale cues
    const grid = new THREE.GridHelper(44, 44, 0x94a3b8, 0xcbd5e1);
    grid.position.y = -0.01;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    scene.add(grid);

    // Build procedural BIM residence
    const procedural = buildProceduralResidenceModel(renderer.capabilities.getMaxAnisotropy());
    scene.add(procedural.root);

    // Container for dynamically loaded GLB/GLTF photogrammetry model (Luma AI)
    const externalAnchor = new THREE.Group();
    scene.add(externalAnchor);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    let currentExternalScene: THREE.Object3D | null = null;
    let loadSeq = 0;

    const loadExternalModel = (url: string | undefined) => {
      loadSeq += 1;
      const mySeq = loadSeq;

      if (currentExternalScene) {
        externalAnchor.remove(currentExternalScene);
        disposeObjectTree(currentExternalScene);
        currentExternalScene = null;
      }

      if (!url) {
        procedural.root.visible = true;
        setExternalModelStatus('procedural');
        setExternalModelMessage(
          'Maquete BIM interativa pronta · Insira uma URL .GLB/.GLTF (Luma AI) para fotogrametria',
        );
        requestRender();
        return;
      }

      setExternalModelStatus('loading');
      setExternalModelMessage('Carregando modelo 3D de fotogrametria (.GLB/.GLTF)...');

      gltfLoader.load(
        url,
        (gltf) => {
          if (mySeq !== loadSeq) {
            disposeObjectTree(gltf.scene);
            return;
          }
          const loaded = gltf.scene;
          loaded.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = !isSoftwareGl;
              child.receiveShadow = true;
            }
          });

          // Auto-center and scale model cleanly to architectural lot bounds
          const box = new THREE.Box3().setFromObject(loaded);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 12 / maxDim;
          loaded.scale.setScalar(scale);
          loaded.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale,
          );

          procedural.root.visible = false;
          externalAnchor.add(loaded);
          currentExternalScene = loaded;

          setExternalModelStatus('loaded');
          setExternalModelMessage('Modelo 3D externo carregado via GLTFLoader');
          cameraGoalRef.current = CAMERA_PRESETS.fachada;
          requestRender();
        },
        (progress) => {
          if (mySeq !== loadSeq) return;
          if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            setExternalModelMessage(`Carregando malha 3D (${pct}%)...`);
          }
        },
        () => {
          if (mySeq !== loadSeq) return;
          procedural.root.visible = true;
          setExternalModelStatus('error');
          setExternalModelMessage(
            'Não foi possível carregar a URL 3D (CORS ou link inválido). Exibindo maquete BIM padrão.',
          );
          requestRender();
        },
      );
    };

    loadExternalModelRef.current = loadExternalModel;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Coalesced on-demand renderer with Software-WebGL fenceSync pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let currentCutaway = 0;
    let lastTickTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;

        const now = performance.now();
        const delta = Math.min((now - lastTickTime) / 1000, 0.08);
        lastTickTime = now;

        let needsMoreFrames = false;

        // Smooth exponential damping for roof cutaway lift
        const targetCut = desiredCutawayRef.current;
        if (Math.abs(currentCutaway - targetCut) > 0.002) {
          currentCutaway = isSoftwareGl
            ? targetCut
            : THREE.MathUtils.damp(currentCutaway, targetCut, 7, delta);
          procedural.roofGroup.position.y = currentCutaway * 5.8;
          procedural.roofGroup.visible = currentCutaway < 0.96;
          needsMoreFrames = Math.abs(currentCutaway - targetCut) > 0.002;
        }

        // Smooth exponential damping for scripted camera presets
        const goal = cameraGoalRef.current;
        if (goal) {
          _vecTargetPos.set(...goal.position);
          _vecTargetLook.set(...goal.target);
          if (isSoftwareGl) {
            camera.position.copy(_vecTargetPos);
            controls.target.copy(_vecTargetLook);
            cameraGoalRef.current = null;
          } else {
            const factor = 1 - Math.exp(-6.5 * delta);
            camera.position.lerp(_vecTargetPos, factor);
            controls.target.lerp(_vecTargetLook, factor);
            if (
              camera.position.distanceTo(_vecTargetPos) < 0.05 &&
              controls.target.distanceTo(_vecTargetLook) < 0.05
            ) {
              camera.position.copy(_vecTargetPos);
              controls.target.copy(_vecTargetLook);
              cameraGoalRef.current = null;
            } else {
              needsMoreFrames = true;
            }
          }
        }

        const dampingMoved = controls.update();
        if (dampingMoved && !isSoftwareGl) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    triggerRenderRef.current = requestRender;

    const onControlsStart = () => {
      // Never fight manual user camera drag
      cameraGoalRef.current = null;
    };
    const onControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextW = Math.max(200, Math.floor(entry.contentRect.width));
      const nextH = Math.max(240, Math.floor(entry.contentRect.height));
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
      requestRender();
    });
    resizeObserver.observe(container);

    // Initial render
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      procedural.dispose();
      if (currentExternalScene) disposeObjectTree(currentExternalScene);
      dracoLoader.dispose();
      envTarget.dispose();
      renderer.dispose();
      triggerRenderRef.current = null;
      loadExternalModelRef.current = null;
    };
  }, []);

  // React to external photogrammetry URL changes (Exterior / Interior / Local GLB)
  useEffect(() => {
    loadExternalModelRef.current?.(activeExternalUrl);
  }, [activeExternalUrl]);

  const handleSelectViewMode = (mode: ViewMode3D) => {
    setViewMode(mode);
    if (mode === 'interior') {
      setCutawayLevel(1);
      desiredCutawayRef.current = 1;
      setActivePreset('interior');
      cameraGoalRef.current = CAMERA_PRESETS.interior;
    } else {
      setCutawayLevel(0);
      desiredCutawayRef.current = 0;
      setActivePreset('fachada');
      cameraGoalRef.current = CAMERA_PRESETS.fachada;
    }
    triggerRenderRef.current?.();
  };

  const handleSelectPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    cameraGoalRef.current = CAMERA_PRESETS[preset];
    triggerRenderRef.current?.();
  };

  const handleCutawayChange = (value: number) => {
    setCutawayLevel(value);
    desiredCutawayRef.current = value;
    setViewMode(value > 0.45 ? 'interior' : 'exterior');
    triggerRenderRef.current?.();
  };

  const handleLocalGlbFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    const nextUrl = URL.createObjectURL(file);
    setLocalBlobUrl(nextUrl);
    event.target.value = '';
  };

  const handleResetView = () => {
    if (localBlobUrl) {
      URL.revokeObjectURL(localBlobUrl);
      setLocalBlobUrl(null);
    }
    handleSelectViewMode('exterior');
  };

  return (
    <div className="relative w-full h-[520px] bg-slate-100 border border-slate-200 rounded-xl overflow-hidden select-none">
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center p-6 text-center z-20">
          <Box className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-medium text-slate-800">{webglError}</p>
          <p className="text-xs text-slate-500 mt-1">
            Ative a aceleração de hardware do navegador para inspeção 3D interativa.
          </p>
        </div>
      )}

      {/* Top-Left minimal architectural spec overlay (no backdrop-filter over WebGL) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none max-w-[72%]">
        <div className="bg-slate-900/90 text-white px-3.5 py-2 rounded-lg border border-slate-700/80">
          <div className="text-xs font-semibold tracking-tight truncate">
            {constructionName} — Visualização 3D ({viewMode === 'exterior' ? 'Exterior' : 'Interior'})
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5 truncate">
            {externalModelMessage}
          </div>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero side-panel occlusion) */}
      <div
        className="absolute left-1/2 bottom-4 z-10 -translate-x-1/2 flex flex-col items-center transition-transform duration-200"
        style={{
          width: 'min(860px, 94%)',
          transform: dockCollapsed
            ? 'translateX(-50%) translateY(calc(100% - 34px))'
            : 'translateX(-50%) translateY(0)',
        }}
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-slate-900/95 text-slate-200 hover:text-white text-[11px] font-medium border border-b-0 border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          title="Alternar controles (tecla H)"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Mostrar controles 3D
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Ocultar controles
            </>
          )}
        </button>

        <div className="w-full bg-slate-900/95 text-slate-100 border border-slate-700 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Exterior / Interior Switch */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleSelectViewMode('exterior')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'exterior'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              Exterior
            </button>
            <button
              type="button"
              onClick={() => handleSelectViewMode('interior')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'interior'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Interior
            </button>
          </div>

          {/* Roof Cutaway Slider (for procedural BIM model) */}
          {externalModelStatus !== 'loaded' && (
            <div className="flex items-center gap-2.5">
              <label
                htmlFor="cutaway-slider"
                className="text-[11px] font-medium text-slate-300 whitespace-nowrap"
              >
                Corte Laje
              </label>
              <input
                id="cutaway-slider"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={cutawayLevel}
                onChange={(e) => handleCutawayChange(Number(e.target.value))}
                className="w-24 accent-blue-500 cursor-pointer"
              />
            </div>
          )}

          {/* Camera Presets */}
          <div className="flex items-center gap-1">
            {(
              [
                ['fachada', 'Fachada'],
                ['aerea', 'Aérea'],
                ['interior', 'Planta'],
                ['lateral', 'Lateral'],
              ] as [CameraPreset, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activePreset === key
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Photogrammetry Luma AI URL & Local .GLB Actions */}
          <div className="flex items-center gap-1.5">
            {onConfigureUrls && (
              <button
                type="button"
                onClick={onConfigureUrls}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Configurar URL de fotogrametria (Luma AI / GLB)"
              >
                <Link2 className="w-3.5 h-3.5" />
                URL Luma AI
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Carregar arquivo local .glb ou .gltf para pré-visualização"
            >
              <Upload className="w-3.5 h-3.5" />
              Testar .GLB
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Resetar câmera e modelo"
              aria-label="Resetar visualização 3D"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleLocalGlbFile}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Subtle interaction hint (bottom right when dock collapsed) */}
      {dockCollapsed && (
        <div className="absolute bottom-4 right-4 z-10 pointer-events-none bg-slate-900/85 text-slate-200 text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          Arraste para orbitar · Scroll para zoom
        </div>
      )}
    </div>
  );
}
