import { CONFIG } from './config.js?v=223';
import { saveNotes, markCloudPending, clearCloudPending } from './local.js?v=223';

export class SaveManager {
  constructor() {
    this.queue = Promise.resolve();
    this.onStatus = () => {};
    this.onCloudSaved = () => {};
    this.onCloudFailed = () => {};
    this.onCloudBatchStart = () => {};
    this._typingStatusActive = false;
    this._inflight = 0;
    this._batchHadCloudSuccess = false;
  }

  configure({ onStatus, remotePush, onCloudSaved, onCloudFailed, onCloudBatchStart } = {}) {
    this.onStatus = onStatus || this.onStatus;
    if (remotePush !== undefined) {
      this.remotePush = remotePush;
    }
    if (onCloudSaved !== undefined) this.onCloudSaved = onCloudSaved || (() => {});
    if (onCloudFailed !== undefined) this.onCloudFailed = onCloudFailed || (() => {});
    if (onCloudBatchStart !== undefined) this.onCloudBatchStart = onCloudBatchStart || (() => {});
  }

  /** True while one or more cloud saves are queued / running. */
  get isBusy() {
    return this._inflight > 0;
  }

  resolveData(getNotesData) {
    return typeof getNotesData === 'function' ? getNotesData() : getNotesData;
  }

  showTypingStatus() {
    if (this._typingStatusActive) return;
    this._typingStatusActive = true;
    this.onStatus('กำลังพิมพ์...');
  }

  scheduleSave(getNotesData) {
    this.showTypingStatus();
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.saveNow(getNotesData);
    }, CONFIG.AUTOSAVE_DELAY_MS);
  }

  /**
   * Local-first: always resolve getNotesData() at write time so a queued
   * older snapshot cannot overwrite newer in-memory edits.
   *
   * Rapid saves (pin reorder, meal taps) coalesce into one cloud batch:
   * onCloudBatchStart once at the first enqueue, onCloudSaved once when
   * the queue drains after a successful push.
   */
  saveNow(getNotesData) {
    const startingBatch = this._inflight === 0;
    this._inflight += 1;
    if (startingBatch) {
      this._batchHadCloudSuccess = false;
      try { this.onCloudBatchStart(); } catch { /* ignore */ }
    }
    this.queue = this.queue
      .then(() => this._performSave(getNotesData))
      .catch(() => {
        this.onStatus('บันทึกไม่สำเร็จ');
        try { this.onCloudFailed('บันทึกไม่สำเร็จ'); } catch { /* ignore */ }
      })
      .finally(() => {
        this._inflight = Math.max(0, this._inflight - 1);
        if (this._inflight === 0 && this._batchHadCloudSuccess) {
          try { this.onCloudSaved(); } catch { /* ignore */ }
        }
      });
    return this.queue;
  }

  async _performSave(getNotesData) {
    const notesData = this.resolveData(getNotesData);
    if (!notesData) return;

    // Disk first — UI already paints from memory; confirm local immediately.
    saveNotes(notesData);
    this._typingStatusActive = false;
    this.onStatus('บันทึกแล้ว');

    if (typeof this.remotePush !== 'function') return;

    try {
      // Re-read memory right before cloud push (edits may have landed mid-queue).
      const latest = this.resolveData(getNotesData) || notesData;
      await this.remotePush(latest);
      clearCloudPending();
      this.onStatus('บันทึกคลาวด์แล้ว');
      this._batchHadCloudSuccess = true;
    } catch {
      this.onStatus('ซิงค์ไม่สำเร็จ');
      markCloudPending();
      try { this.onCloudFailed('ซิงค์ไม่สำเร็จ'); } catch { /* ignore */ }
    }
  }
}
