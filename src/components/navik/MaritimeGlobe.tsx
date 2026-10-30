import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

interface MaritimeGlobeProps {
  className?: string;
  size?: number;
  height?: number;
  rotationDurationSeconds?: number;
}

// Key maritime hub coordinates (lat, lon)
const PORTS_DATA = [
  { name: "Paradip", code: "PRDP", lat: 20.26, lon: 86.67, color: "#35BFC3", isDestination: true },
  { name: "Dhamra", code: "DHMR", lat: 20.81, lon: 86.96, color: "#35BFC3", isDestination: true },
  { name: "Haldia", code: "HLDA", lat: 22.02, lon: 88.06, color: "#35BFC3", isDestination: true },
  { name: "Vizag", code: "VIZG", lat: 17.68, lon: 83.22, color: "#35BFC3", isDestination: true },
  { name: "Gangavaram", code: "GGVM", lat: 17.63, lon: 83.24, color: "#35BFC3", isDestination: true },
  { name: "Singapore", code: "SGP", lat: 1.29, lon: 103.85, color: "#78958F", isChokepoint: true },
  { name: "Sunda Strait", code: "SUN", lat: -5.95, lon: 105.85, color: "#78958F", isChokepoint: true },
  { name: "Lombok", code: "LOM", lat: -8.5, lon: 115.75, color: "#78958F", isChokepoint: true },
  { name: "Gladstone", code: "GLD", lat: -23.84, lon: 151.26, color: "#F2B653", isOrigin: true },
  { name: "Hay Point", code: "HAY", lat: -21.28, lon: 149.3, color: "#F2B653", isOrigin: true },
  { name: "Newcastle", code: "NEW", lat: -32.92, lon: 151.78, color: "#F2B653", isOrigin: true },
  { name: "Port Hedland", code: "PHE", lat: -20.31, lon: 118.58, color: "#E87945", isOrigin: true },
  { name: "Balikpapan", code: "BPN", lat: -1.27, lon: 116.83, color: "#F2B653", isOrigin: true },
  { name: "Fujairah", code: "FUJ", lat: 25.13, lon: 56.34, color: "#78958F", isBunker: true },
];

const SHIPPING_ROUTES = [
  { from: [-23.84, 151.26], to: [20.26, 86.67], color: 0x35bfc3 }, // Gladstone -> Paradip (Arctic Teal)
  { from: [-21.28, 149.3], to: [20.81, 86.96], color: 0x78958f },  // Hay Point -> Dhamra (Seafoam)
  { from: [-32.92, 151.78], to: [17.68, 83.22], color: 0x35bfc3 }, // Newcastle -> Vizag (Arctic Teal)
  { from: [-20.31, 118.58], to: [20.26, 86.67], color: 0xf2b653 }, // WA -> Paradip (Amber)
  { from: [-1.27, 116.83], to: [22.02, 88.06], color: 0x35bfc3 },  // Kalimantan -> Haldia (Arctic Teal)
  { from: [1.29, 103.85], to: [20.26, 86.67], color: 0x35bfc3 },   // Singapore -> Paradip
  { from: [25.13, 56.34], to: [17.68, 83.22], color: 0xe87945 },   // Fujairah -> Vizag (Burnt Orange)
  { from: [-5.95, 105.85], to: [20.81, 86.96], color: 0x78958f },  // Sunda -> Dhamra
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Procedural fallback texture during asset loading
 */
function createFallbackTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Deep oceanic canvas
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#081827");
  grad.addColorStop(0.5, "#0D2233");
  grad.addColorStop(1, "#081827");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Continental landmass silhouettes
  ctx.fillStyle = "#15364A";
  ctx.beginPath();
  ctx.ellipse(650, 200, 180, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(500, 260, 90, 120, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(820, 360, 80, 60, -0.2, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * High-resolution canvas text sprite for geographical annotations
 */
function createTextSprite(text: string, color: string, fontSize = 28): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(4, 12, 20, 0.95)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.15, 0.28, 1);
  return sprite;
}

export function MaritimeGlobe({
  className,
  size = 820,
  height,
  rotationDurationSeconds = 120,
}: MaritimeGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Drag interaction state
  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const dragVelocityRef = useRef({ x: 0, y: 0 });
  // Initial orientation: India, Bay of Bengal, and Australia corridors facing camera
  const rotationYRef = useRef(2.72);
  const rotationXRef = useRef(0.36); // Earth's ~23.4° axial tilt
  const cloudOffsetRef = useRef(0.0);

  // Drag event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };
    dragVelocityRef.current = { x: 0, y: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevPointerRef.current.x;
    const dy = e.clientY - prevPointerRef.current.y;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };

    dragVelocityRef.current = { x: dx * 0.003, y: dy * 0.002 };
    rotationYRef.current += dx * 0.004;
    rotationXRef.current = Math.max(0.12, Math.min(0.62, rotationXRef.current + dy * 0.002));
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    // 1. WebGL Capability Check
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const containerWidth = container.clientWidth || size;
    const containerHeight = height || container.clientHeight || 460;

    // 2. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, containerWidth / containerHeight, 0.1, 1000);
    // Camera positioned to view northern & central Indian Ocean prominently
    camera.position.set(0.2, 0.6, 10.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 3. Subtle Space Starfield in Deep Background
    const starCount = 260;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 22.0 + Math.random() * 8.0;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      // Place behind the Earth
      starPositions[i * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 4.5;

      const tint = Math.random();
      if (tint > 0.8) {
        // Champagne amber
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.82;
        starColors[i * 3 + 2] = 0.55;
      } else if (tint > 0.4) {
        // Arctic teal
        starColors[i * 3] = 0.65;
        starColors[i * 3 + 1] = 0.88;
        starColors[i * 3 + 2] = 0.95;
      } else {
        // Crisp white/ivory
        starColors[i * 3] = 0.95;
        starColors[i * 3 + 1] = 0.96;
        starColors[i * 3 + 2] = 1.0;
      }
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.10,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 4. Stable Directional Sun Source
    // Positioned behind and upper-left, illuminating the top horizon limb with twilight/scattering
    // while casting the visible front hemisphere (India, Bay of Bengal) into night for brilliant city lights
    const sunPosition = new THREE.Vector3(-10.0, 8.5, -12.0);

    // 5. Main Rotating Globe Group (Tilted on natural ~23.4° axis)
    const globeGroup = new THREE.Group();
    globeGroup.rotation.x = rotationXRef.current;
    globeGroup.rotation.z = -0.16;
    globeGroup.rotation.y = rotationYRef.current;
    scene.add(globeGroup);

    const sphereRadius = 4.2;
    const segments = 64;
    const earthGeo = new THREE.SphereGeometry(sphereRadius, segments, segments);

    // 6. Load High-Resolution NASA Textures with Live Rebind
    const textureLoader = new THREE.TextureLoader();
    const fallbackTex = createFallbackTexture();

    const onTextureLoaded = () => {
      if (earthMat) earthMat.needsUpdate = true;
      if (cloudMat) cloudMat.needsUpdate = true;
    };

    // Day Texture: NASA Blue Marble (Oceans, Topography, Landmasses)
    const dayTexture = textureLoader.load("/textures/earth_day_2048.jpg", onTextureLoaded);
    dayTexture.wrapS = THREE.RepeatWrapping;
    dayTexture.wrapT = THREE.ClampToEdgeWrapping;
    dayTexture.colorSpace = THREE.SRGBColorSpace;

    // Night Texture: NASA Black Marble (Golden/Amber City Clusters)
    const nightTexture = textureLoader.load("/textures/earth_lights_2048.png", onTextureLoaded);
    nightTexture.wrapS = THREE.RepeatWrapping;
    nightTexture.wrapT = THREE.ClampToEdgeWrapping;
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    // Specular Texture: Water Reflectivity Mask
    const specularTexture = textureLoader.load("/textures/earth_specular_2048.jpg", onTextureLoaded);
    specularTexture.wrapS = THREE.RepeatWrapping;
    specularTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Clouds Texture: Natural Cloud Layer
    const cloudTexture = textureLoader.load("/textures/earth_clouds_1024.png", onTextureLoaded);
    cloudTexture.wrapS = THREE.RepeatWrapping;
    cloudTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 7. Photorealistic Day/Night Earth Shader Material
    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTexture || fallbackTex },
        uNightMap: { value: nightTexture },
        uSpecularMap: { value: specularTexture },
        uCloudMap: { value: cloudTexture },
        uSunPosition: { value: sunPosition },
        uCloudOffset: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vSunDirection;
        uniform vec3 uSunPosition;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vSunDirection = normalize(uSunPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying vec3 vSunDirection;

        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform sampler2D uSpecularMap;
        uniform sampler2D uCloudMap;
        uniform float uCloudOffset;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(vSunDirection);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Sun illumination angle
          float sunDot = dot(normal, sunDir);

          // Daylight transition factor (Day = 1.0, Night = 0.0)
          float dayFactor = smoothstep(-0.18, 0.24, sunDot);

          // Night mask for city lights (Night = 1.0, Day = 0.0, with twilight fade)
          float nightMask = smoothstep(0.12, -0.16, sunDot);

          // Sample Earth textures
          vec4 dayTex = texture2D(uDayMap, vUv);
          float specularMask = texture2D(uSpecularMap, vUv).r;

          // Cloud coverage and realistic ground shadow
          vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
          float cloudDensity = texture2D(uCloudMap, cloudUv).r;
          vec2 shadowUv = vec2(fract(cloudUv.x - sunDir.x * 0.0025), cloudUv.y - sunDir.y * 0.0025);
          float cloudShadow = texture2D(uCloudMap, shadowUv).r * max(sunDot, 0.0) * 0.45;

          // Calibrate deep ocean bathymetry to NAVIK Oceanic palette (#081827 / #0D2233)
          vec3 oceanDeep = vec3(0.035, 0.095, 0.17);
          vec3 oceanShallow = vec3(0.06, 0.18, 0.26);
          vec3 oceanBlended = mix(oceanDeep, oceanShallow, dayTex.g * 0.4);
          vec3 baseSurface = mix(dayTex.rgb, dayTex.rgb * 0.72 + oceanBlended * 0.55, specularMask);

          // Apply cloud shadow on ground/ocean
          baseSurface *= (1.0 - cloudShadow);

          // Direct sunlight on sunlit side
          vec3 sunColor = vec3(1.0, 0.98, 0.94);
          vec3 ambientDay = vec3(0.10, 0.14, 0.20);
          vec3 litDay = baseSurface * (sunColor * max(sunDot, 0.0) * 1.25 + ambientDay);

          // Specular reflection on water surfaces
          vec3 halfVec = normalize(sunDir + viewDir);
          float specDot = max(dot(normal, halfVec), 0.0);
          float specular = pow(specDot, 40.0) * specularMask * 0.90 * max(sunDot, 0.0);
          vec3 specularColor = vec3(0.85, 0.95, 1.0) * specular;

          // Multi-tier satellite city lights (Suomi NPP VIIRS)
          float rawCityVal = pow(texture2D(uNightMap, vUv).r, 0.92);

          // Atmospheric urban bloom/haze over dense metropolitan corridors
          float cityHaze = (
            texture2D(uNightMap, vUv + vec2(0.0016, 0.0)).r +
            texture2D(uNightMap, vUv - vec2(0.0016, 0.0)).r +
            texture2D(uNightMap, vUv + vec2(0.0, 0.0022)).r +
            texture2D(uNightMap, vUv - vec2(0.0, 0.0022)).r
          ) * 0.25;

          // Temperature gradient: Core = Pale Gold, Suburbs = Warm Amber, Outskirts = Copper
          vec3 cityCore = vec3(1.0, 0.96, 0.88);       // Major metropolitan epicenters (Delhi, Mumbai, Kolkata)
          vec3 cityAmber = vec3(1.0, 0.74, 0.35);      // Warm Amber (#F2B653)
          vec3 cityCopper = vec3(0.92, 0.52, 0.22);     // Burnt Copper (#E87945)

          vec3 cityColor = mix(cityCopper, cityAmber, smoothstep(0.10, 0.48, rawCityVal));
          cityColor = mix(cityColor, cityCore, smoothstep(0.48, 0.85, rawCityVal));

          // Combine sharp urban lights and subtle atmospheric glow
          vec3 sharpCity = rawCityVal * cityColor * 3.6;
          vec3 diffuseCityHaze = cityHaze * cityAmber * 1.8;
          vec3 totalCityLights = (sharpCity + diffuseCityHaze) * nightMask;

          // Clouds at night partially occlude city lights
          totalCityLights *= (1.0 - cloudDensity * 0.45);

          // Night-side dark surface tone: distinct continental landmass silhouette vs deep ocean
          vec3 landNight = mix(vec3(0.016, 0.035, 0.052), vec3(0.024, 0.050, 0.075), dayTex.r);
          vec3 oceanNight = vec3(0.008, 0.020, 0.035);
          vec3 nightAmbient = mix(landNight, oceanNight, specularMask);

          // Sunset / twilight atmospheric band at the day/night terminator
          float twilightBand = smoothstep(0.16, 0.0, abs(sunDot + 0.02));
          vec3 sunsetGlow = vec3(0.94, 0.52, 0.24) * twilightBand * 0.42 * (1.0 - specularMask * 0.4);

          // Final surface composite
          vec3 finalColor = mix(nightAmbient, litDay + specularColor, dayFactor);
          finalColor += totalCityLights;
          finalColor += sunsetGlow;

          // Rayleigh atmospheric limb scattering on planet edge
          float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
          vec3 atmosphereRim = vec3(0.20, 0.76, 0.88); // Arctic Teal
          finalColor += atmosphereRim * pow(fresnel, 3.2) * (dayFactor * 0.70 + 0.25);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 8. Natural Floating Cloud Layer
    const cloudGeo = new THREE.SphereGeometry(sphereRadius * 1.014, segments, segments);
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudMap: { value: cloudTexture },
        uSunPosition: { value: sunPosition },
        uCloudOffset: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vSunDirection;
        uniform vec3 uSunPosition;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vSunDirection = normalize(uSunPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vSunDirection;
        uniform sampler2D uCloudMap;
        uniform float uCloudOffset;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sunDir = normalize(vSunDirection);
          float sunDot = dot(normal, sunDir);
          float dayFactor = smoothstep(-0.20, 0.28, sunDot);

          vec2 cloudUv = vec2(fract(vUv.x + uCloudOffset), vUv.y);
          vec4 cloudTex = texture2D(uCloudMap, cloudUv);
          float cloudDensity = cloudTex.r;

          // Natural cloud shading: crisp white in direct sun, soft shadow gradients
          vec3 litCloudColor = vec3(0.96, 0.98, 1.0) * (max(sunDot, 0.0) * 0.85 + 0.28);
          vec3 nightCloudColor = vec3(0.018, 0.035, 0.055);

          // Sunset rim on clouds near terminator
          float twilightCloud = smoothstep(0.18, 0.0, abs(sunDot));
          vec3 sunsetCloudTint = vec3(0.96, 0.65, 0.38) * twilightCloud * 0.45;

          vec3 cloudColor = mix(nightCloudColor, litCloudColor + sunsetCloudTint, dayFactor);

          // Gentle cloud opacity so underlying geography and city lights remain clearly visible
          float alpha = cloudDensity * (dayFactor * 0.38 + 0.07);
          gl_FragColor = vec4(cloudColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // 9. Luminous Atmospheric Glow Rim (Fresnel BackSide Halo)
    const atmosphereGeo = new THREE.SphereGeometry(sphereRadius * 1.036, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
          gl_FragColor = vec4(0.20, 0.76, 0.88, 1.0) * intensity * 0.96;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // 10. Floating Geographic Text Sprites ("India" & "Bay of Bengal")
    const indiaSprite = createTextSprite("India", "#F3EEE5", 30);
    const indiaPos = latLonToVector3(22.0, 78.5, sphereRadius * 1.025);
    indiaSprite.position.copy(indiaPos);
    globeGroup.add(indiaSprite);

    const bobSprite = createTextSprite("Bay of Bengal", "#35BFC3", 24);
    const bobPos = latLonToVector3(14.5, 88.5, sphereRadius * 1.025);
    bobSprite.position.copy(bobPos);
    globeGroup.add(bobSprite);

    // 11. 3D Maritime Shipping Corridor Arcs & Directional Vessel Markers
    const routesGroup = new THREE.Group();
    globeGroup.add(routesGroup);

    const animatedVessels: {
      mesh: THREE.Mesh;
      curve: THREE.QuadraticBezierCurve3;
      speed: number;
      progress: number;
    }[] = [];

    // Directional vessel marker geometry (oriented along trajectory tangent)
    const vesselConeGeo = new THREE.ConeGeometry(0.046, 0.13, 8);
    vesselConeGeo.rotateX(Math.PI / 2); // align tip with forward vector

    SHIPPING_ROUTES.forEach((route) => {
      const vStart = latLonToVector3(route.from[0], route.from[1], sphereRadius);
      const vEnd = latLonToVector3(route.to[0], route.to[1], sphereRadius);

      // Compute elevated midpoint arc above globe surface
      const distance = vStart.distanceTo(vEnd);
      const vMid = vStart.clone().add(vEnd).multiplyScalar(0.5);
      const elevation = sphereRadius + distance * 0.22;
      vMid.normalize().multiplyScalar(elevation);

      const curve = new THREE.QuadraticBezierCurve3(vStart, vMid, vEnd);
      const points = curve.getPoints(45);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
      const curveMat = new THREE.LineBasicMaterial({
        color: route.color,
        transparent: true,
        opacity: 0.78,
        linewidth: 1.5,
      });
      const line = new THREE.Line(curveGeo, curveMat);
      routesGroup.add(line);

      // Directional moving vessel arrow on corridor
      const vesselMat = new THREE.MeshBasicMaterial({
        color: route.color === 0x35bfc3 ? 0x35bfc3 : 0xf2b653,
      });
      const vesselMesh = new THREE.Mesh(vesselConeGeo, vesselMat);
      routesGroup.add(vesselMesh);

      animatedVessels.push({
        mesh: vesselMesh,
        curve,
        speed: 0.0022 + Math.random() * 0.0018,
        progress: Math.random(),
      });
    });

    // 12. Port Terminal Beacons with Pulsing Radar Rings
    const portMarkerGeo = new THREE.SphereGeometry(0.052, 16, 16);
    const radarRingGeo = new THREE.RingGeometry(0.04, 0.09, 24);
    const radarRingMat = new THREE.MeshBasicMaterial({
      color: 0x35bfc3,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const pulsingRings: { mesh: THREE.Mesh; baseScale: number; phase: number }[] = [];

    PORTS_DATA.forEach((p, idx) => {
      const pos = latLonToVector3(p.lat, p.lon, sphereRadius * 1.002);
      const mat = new THREE.MeshBasicMaterial({
        color: p.isDestination ? 0x35bfc3 : p.isOrigin ? 0xf2b653 : 0x78958f,
      });
      const marker = new THREE.Mesh(portMarkerGeo, mat);
      marker.position.copy(pos);
      globeGroup.add(marker);

      // Pulsing radar ring for East Coast destination ports
      if (p.isDestination) {
        const ring = new THREE.Mesh(radarRingGeo, radarRingMat.clone());
        ring.position.copy(pos);
        ring.lookAt(new THREE.Vector3(0, 0, 0)); // align flat against sphere surface
        globeGroup.add(ring);
        pulsingRings.push({ mesh: ring, baseScale: 1.0, phase: idx * 0.8 });
      }
    });

    // 13. Delta-Time Smooth Continuous Axial Rotation & Drag Inertia
    const rotationRate = (2 * Math.PI) / rotationDurationSeconds;
    const clock = new THREE.Clock();

    // Respect prefers-reduced-motion
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let isVisible = true;
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (!isVisible) return;

      const delta = Math.min(clock.getDelta(), 0.1); // Guard against tab freeze delta leaps
      const elapsedTime = clock.getElapsedTime();

      // Inertial drag handling & steady rotation
      if (!isDraggingRef.current) {
        rotationYRef.current += dragVelocityRef.current.x;
        rotationXRef.current = Math.max(0.12, Math.min(0.62, rotationXRef.current + dragVelocityRef.current.y));
        dragVelocityRef.current.x *= 0.92;
        dragVelocityRef.current.y *= 0.92;

        if (!prefersReducedMotion) {
          rotationYRef.current += rotationRate * delta;
        }
      }

      // Apply rotations to globe group
      globeGroup.rotation.y = rotationYRef.current;
      globeGroup.rotation.x = rotationXRef.current;

      // Animate cloud differential drift in shader
      if (!prefersReducedMotion) {
        cloudOffsetRef.current = (cloudOffsetRef.current + rotationRate * 0.06 * delta) % 1.0;
        earthMat.uniforms.uCloudOffset.value = cloudOffsetRef.current;
        cloudMat.uniforms.uCloudOffset.value = cloudOffsetRef.current;
      }

      // Animate vessels along corridors with tangent orientation
      const forwardVec = new THREE.Vector3(0, 0, 1);
      animatedVessels.forEach((v) => {
        v.progress += v.speed * (delta * 60);
        if (v.progress > 1) v.progress = 0;
        const pt = v.curve.getPoint(v.progress);
        const tangent = v.curve.getTangent(v.progress).normalize();
        v.mesh.position.copy(pt);
        v.mesh.quaternion.setFromUnitVectors(forwardVec, tangent);
      });

      // Animate pulsing radar rings on discharge ports
      pulsingRings.forEach((pr) => {
        const t = (elapsedTime * 2.2 + pr.phase) % 2.0;
        const scale = 1.0 + t * 0.8;
        pr.mesh.scale.set(scale, scale, scale);
        (pr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - t * 0.35);
      });

      // Dynamically fade geographic labels when facing away from camera
      const camNorm = camera.position.clone().normalize();

      const indiaWorld = new THREE.Vector3();
      indiaSprite.getWorldPosition(indiaWorld);
      const indiaFacing = indiaWorld.normalize().dot(camNorm);
      indiaSprite.material.opacity = Math.max(0, Math.min(1, (indiaFacing - 0.15) * 3.0));

      const bobWorld = new THREE.Vector3();
      bobSprite.getWorldPosition(bobWorld);
      const bobFacing = bobWorld.normalize().dot(camNorm);
      bobSprite.material.opacity = Math.max(0, Math.min(1, (bobFacing - 0.15) * 3.0));

      renderer.render(scene, camera);
    };

    animate();

    // 14. Visibility Handling (Pause when tab is hidden or element scrolled off-screen)
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) clock.getDelta(); // Reset clock delta on wake
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting && !document.hidden;
        if (isVisible) clock.getDelta();
      });
    }, { threshold: 0.05 });
    intersectionObserver.observe(container);

    // 15. Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = height || container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 16. Comprehensive WebGL Cleanup
    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose geometries
      earthGeo.dispose();
      cloudGeo.dispose();
      atmosphereGeo.dispose();
      portMarkerGeo.dispose();
      radarRingGeo.dispose();
      vesselConeGeo.dispose();
      starGeo.dispose();

      // Dispose materials
      earthMat.dispose();
      cloudMat.dispose();
      atmosphereMat.dispose();
      starMat.dispose();
      radarRingMat.dispose();

      // Dispose textures
      dayTexture.dispose();
      nightTexture.dispose();
      specularTexture.dispose();
      cloudTexture.dispose();
      fallbackTex.dispose();

      // Dispose renderer
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [size, height, rotationDurationSeconds]);

  if (!webGlSupported) {
    // Elegant fallback for non-WebGL devices
    return (
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 overflow-hidden select-none opacity-85",
          className
        )}
        style={{ width: "100%", height: height || 460 }}
        aria-hidden="true"
      >
        <div className="relative h-full w-full rounded-full bg-gradient-to-tr from-[#081827] via-[#0D2233] to-[#15364A] shadow-[inset_0_0_80px_rgba(53,191,195,0.3)] border border-[#24485C]/50 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#35BFC3]/30 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "absolute select-none overflow-hidden touch-pan-y",
        isHovered ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        className
      )}
      style={{
        width: "100%",
        height: height || "100%",
      }}
      aria-hidden="true"
    />
  );
}
