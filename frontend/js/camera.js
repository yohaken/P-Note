/**
 * In-app fullscreen camera: full-frame capture (no square crop),
 * optional save-to-device, then hand File to the note attach pipeline.
 */
import {
  cameraQualityPreset,
  normalizeCameraFacing,
  normalizeCameraQuality,
  normalizeCameraSaveToDevice,
} from './settings.js?v=107';

/**
 * @typedef {{
 *   cameraSaveToDevice?: boolean,
 *   cameraFacing?: string,
 *   cameraQuality?: string,
 * }} CameraSettings
 */

/**
 * @param {Blob} blob
 * @param {string} name
 */
export async function saveBlobToDevice(blob, name) {
  const file =
    blob instanceof File
      ? blob
      : new File([blob], name, { type: blob.type || 'image/jpeg' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: name,
      });
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        return { ok: false, method: 'share_cancelled' };
      }
      console.warn('share save failed', err);
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { ok: true, method: 'download' };
  } catch (err) {
    console.warn('download save failed', err);
    return { ok: false, method: 'none' };
  }
}

function stampName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `pnote-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

/**
 * @param {{
 *   root: HTMLElement,
 *   video: HTMLVideoElement,
 *   statusEl?: HTMLElement|null,
 *   getSettings: () => CameraSettings,
 *   onCaptured: (file: File, meta: { saved: boolean, width: number, height: number }) => void,
 *   onClose?: () => void,
 *   onOpenSettings?: () => void,
 *   onFallback?: () => void,
 * }} opts
 */
export function createInAppCamera(opts) {
  const root = opts.root;
  const video = opts.video;
  let stream = null;
  let starting = false;
  let facing = 'environment';
  let busy = false;

  function setStatus(msg) {
    if (opts.statusEl) opts.statusEl.textContent = msg || '';
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      stream = null;
    }
    video.srcObject = null;
  }

  function buildConstraints(settings) {
    const quality = normalizeCameraQuality(settings.cameraQuality);
    const preset = cameraQualityPreset(quality);
    facing = normalizeCameraFacing(settings.cameraFacing || facing);
    return {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: preset.width },
        height: { ideal: preset.height },
      },
    };
  }

  async function startStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const err = new Error('no_media');
      err.code = 'no_media';
      throw err;
    }
    stopStream();
    const settings = opts.getSettings() || {};
    const constraints = buildConstraints(settings);
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstErr) {
      // Retry without ideal size if device rejects high constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing } },
        });
      } catch {
        throw firstErr;
      }
    }
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    const settingsLabel = track?.getSettings?.() || {};
    const w = settingsLabel.width || video.videoWidth || 0;
    const h = settingsLabel.height || video.videoHeight || 0;
    const preset = cameraQualityPreset(opts.getSettings()?.cameraQuality);
    setStatus(w && h ? `${w}×${h} · ${preset.label}` : preset.label);
  }

  async function open() {
    if (starting) return;
    starting = true;
    root.hidden = false;
    setStatus('เปิดกล้อง…');
    try {
      await startStream();
    } catch (err) {
      console.warn('in-app camera failed', err);
      root.hidden = true;
      stopStream();
      starting = false;
      if (typeof opts.onFallback === 'function') opts.onFallback();
      return;
    }
    starting = false;
  }

  function close() {
    root.hidden = true;
    stopStream();
    setStatus('');
    busy = false;
    if (typeof opts.onClose === 'function') opts.onClose();
  }

  async function flip() {
    facing = facing === 'environment' ? 'user' : 'environment';
    const s = opts.getSettings() || {};
    // Persist facing via caller settings mutation if they listen — we only flip live
    setStatus('สลับกล้อง…');
    try {
      await startStreamWithFacing(facing, s);
    } catch (err) {
      console.warn('flip failed', err);
      setStatus('สลับกล้องไม่ได้');
    }
  }

  async function startStreamWithFacing(nextFacing, settings) {
    facing = normalizeCameraFacing(nextFacing);
    stopStream();
    const quality = normalizeCameraQuality(settings.cameraQuality);
    const preset = cameraQualityPreset(quality);
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: preset.width },
        height: { ideal: preset.height },
      },
    });
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    const st = track?.getSettings?.() || {};
    const w = st.width || video.videoWidth || 0;
    const h = st.height || video.videoHeight || 0;
    setStatus(w && h ? `${w}×${h} · ${preset.label}` : preset.label);
  }

  /**
   * Capture full sensor frame (videoWidth × videoHeight) — no square crop.
   */
  async function capture() {
    if (busy || !stream) return null;
    busy = true;
    setStatus('กำลังบันทึก…');
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        setStatus('กล้องยังไม่พร้อม');
        busy = false;
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      const settings = opts.getSettings() || {};
      const preset = cameraQualityPreset(settings.cameraQuality);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob_failed'))),
          'image/jpeg',
          preset.jpeg,
        );
      });

      const name = stampName();
      const file = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });

      let saved = false;
      if (normalizeCameraSaveToDevice(settings.cameraSaveToDevice)) {
        const result = await saveBlobToDevice(file, name);
        saved = Boolean(result.ok);
      }

      opts.onCaptured(file, { saved, width: w, height: h });
      close();
      return file;
    } catch (err) {
      console.warn('capture failed', err);
      setStatus('ถ่ายไม่สำเร็จ');
      busy = false;
      return null;
    }
  }

  async function reloadFromSettings() {
    if (root.hidden) return;
    setStatus('ปรับกล้อง…');
    try {
      await startStream();
    } catch (err) {
      console.warn('reload camera failed', err);
      setStatus('ปรับกล้องไม่ได้');
    }
  }

  function isOpen() {
    return !root.hidden;
  }

  function getFacing() {
    return facing;
  }

  return {
    open,
    close,
    flip,
    capture,
    reloadFromSettings,
    isOpen,
    getFacing,
    openSettings: () => {
      if (typeof opts.onOpenSettings === 'function') opts.onOpenSettings();
    },
  };
}
