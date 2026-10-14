'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export default function Panorama({ url }: { url?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const synthetic = !!url?.startsWith('/demo-assets/');
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError(true);
      setLoading(false);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
    camera.position.set(0.01, 0, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.rotateSpeed = -0.35;
    const geometry = new THREE.SphereGeometry(30, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: '#333333' });
    scene.add(new THREE.Mesh(geometry, material));
    let disposed = false;
    const texture = new THREE.TextureLoader().load(
      url ||
        'https://threejs.org/examples/textures/equirectangular/2294472375_24a3b8ef46_o.jpg',
      () => {
        if (!disposed) {
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.color.set('#ffffff');
          material.needsUpdate = true;
          setLoading(false);
        }
      },
      undefined,
      () => {
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
      },
    );
    const observer = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    observer.observe(el);
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);
  return (
    <div className="panorama" ref={host}>
      <div className="tour-label">
        360°{' '}
        <span>
          {synthetic
            ? 'Panorama sintético de una propiedad ficticia · Generado para la maqueta, no relevamiento real'
            : 'Panorama de demostración · No verificado como recorrido de esta propiedad'}
        </span>
      </div>
      {loading && <div className="tour-status">Cargando panorama…</div>}
      {error && (
        <div className="tour-status">
          No pudimos cargar el panorama. Revisá tu conexión e intentá
          nuevamente.
        </div>
      )}
      <div className="tour-instruction">Arrastrá para mirar a tu alrededor</div>
    </div>
  );
}
