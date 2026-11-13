'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useRef, useState } from 'react';
import {
  isSafeTour360Url,
  TOUR360_ACCEPT,
  validateTour360Dimensions,
  validateTour360File,
  type Tour360UploadAdapter,
} from '@/lib/properties/tour360-upload';
import styles from './property-360-upload.module.css';

const Panorama = dynamic(() => import('../Panorama'), { ssr: false });
type Selection = { file: File; url: string; image: HTMLImageElement; ready: boolean };

type Property360UploadProps = {
  propertyId?: string;
  disabled?: boolean;
  uploadAdapter?: Tour360UploadAdapter;
};

/** This local draft is deliberately excluded from the surrounding property form. */
export function Property360Upload({ propertyId, disabled = false, uploadAdapter }: Property360UploadProps) {
  const descriptionId = useId();
  const input = useRef<HTMLInputElement>(null);
  const current = useRef<Selection | null>(null);
  const upload = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const context = useRef({ disabled, propertyId, uploadAdapter });
  context.current = { disabled, propertyId, uploadAdapter };
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  function release() {
    upload.current?.abort();
    upload.current = null;
    const selection = current.current;
    current.current = null;
    if (selection) {
      selection.image.onload = null;
      selection.image.onerror = null;
      selection.image.src = '';
      URL.revokeObjectURL(selection.url);
    }
  }

  function clear() {
    release();
    setPreviewUrl(null);
    setHasSelection(false);
    setBusy(false);
    setError(null);
    setStatus('');
    if (input.current) input.current.value = '';
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; release(); };
  }, []);

  useEffect(() => {
    // Changing the target must not leave an upload bound to the previous property.
    clear();
    // Selection state is intentionally reset only when the editing target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, propertyId]);

  function selectFile(file?: File) {
    if (context.current.disabled || !file) return;
    clear();
    const invalid = validateTour360File(file);
    if (invalid) { setError(invalid); return; }
    let selection: Selection;
    try {
      const image = new Image();
      selection = { file, url: URL.createObjectURL(file), image, ready: false };
    } catch {
      setError('No se pudo abrir la imagen local.');
      return;
    }
    current.current = selection;
    setHasSelection(true);
    setBusy(true);
    const active = () => mounted.current && current.current === selection;
    selection.image.onload = () => {
      if (!active()) return;
      const invalidDimensions = validateTour360Dimensions(selection.image.naturalWidth, selection.image.naturalHeight);
      if (invalidDimensions) { clear(); setError(invalidDimensions); return; }
      selection.ready = true;
      setPreviewUrl(selection.url);
      setBusy(false);
    };
    selection.image.onerror = () => {
      if (!active()) return;
      clear();
      setError('No se pudo decodificar la imagen. Selecciona un panorama válido.');
    };
    selection.image.src = selection.url;
  }

  async function uploadSelection() {
    const selection = current.current;
    const target = context.current;
    if (target.disabled || !selection?.ready || !target.propertyId || !target.uploadAdapter || upload.current) return;
    const controller = new AbortController();
    upload.current = controller;
    setBusy(true);
    setError(null);
    setStatus('');
    const active = () => mounted.current && current.current === selection && upload.current === controller && !controller.signal.aborted;
    try {
      const result = await target.uploadAdapter({ propertyId: target.propertyId, file: selection.file, signal: controller.signal });
      if (!active()) return;
      if (!isSafeTour360Url(result?.url)) throw new Error('Unsafe upload resource');
      setStatus('Archivo subido al host; no se ha guardado la asociación con la propiedad.');
    } catch {
      if (active()) setError('No se pudo confirmar una URL HTTPS segura. La asociación no se ha guardado; consulta el estado en el host antes de reintentar.');
    } finally {
      if (active()) { upload.current = null; setBusy(false); }
    }
  }

  const unavailable = !uploadAdapter
    ? 'La subida está deshabilitada hasta configurar el adaptador de alojamiento.'
    : !propertyId ? 'Guarda la propiedad antes de subir el panorama.' : '';

  return (
    <section className={styles.root} aria-label="Panorama 360°" aria-describedby={descriptionId}>
      <h4 className={styles.heading}>Panorama 360°</h4>
      <p id={descriptionId} className={styles.hint}>JPEG, PNG o WebP equirectangular 2:1 · máximo 20 MiB, 8192 px por lado y 33,6 MP.</p>
      <input
        ref={input}
        className={styles.fileInput}
        type="file"
        accept={TOUR360_ACCEPT}
        aria-label="Seleccionar imagen 360°"
        disabled={disabled}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          selectFile(file);
        }}
      />
      <div className={styles.controls}>
        <button type="button" disabled={disabled || hasSelection} onClick={() => input.current?.click()}>Agregar 360°</button>
        <button type="button" disabled={disabled || !hasSelection} onClick={() => input.current?.click()}>Cambiar</button>
        <button type="button" disabled={disabled || !hasSelection} onClick={() => { if (!context.current.disabled) clear(); }}>Quitar</button>
        <button type="button" disabled={disabled || busy || !previewUrl || !!unavailable} onClick={uploadSelection}>Subir 360°</button>
      </div>
      {!status && <p className={styles.hint}>Vista previa local; no se ha subido ni guardado.</p>}
      {unavailable && <p className={styles.hint}>{unavailable}</p>}
      {busy && <p role="status">Procesando panorama…</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {status && <p role="status">{status}</p>}
      {previewUrl && (
        <div className={styles.preview}>
          <Panorama key={previewUrl} url={previewUrl} label={status ? 'Vista previa local · Asociación con la propiedad no guardada' : 'Vista previa local · No se ha subido ni guardado'} />
        </div>
      )}
    </section>
  );
}
