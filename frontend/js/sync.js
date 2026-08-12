import { CONFIG } from './config.js?v=154';
import { saveNotes } from './local.js?v=199';

export class SaveManager {
  constructor() {
    this.queue = Promise.resolve();
    this.onStatus = () => {};
    this._typingStatusActive = false;
  }

  configure({ onStatus, remotePush }) {
    this.onStatus = onStatus || this.onStatus;
    if (remotePush !== undefined) {
      this.remotePush = remotePush;
    }
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
   */
  saveNow(getNotesData) {
    this.queue = this.queue
      .then(() => this._performSave(getNotesData))
      .catch(() => {
        this.onStatus('บันทึกไม่สำเร็จ');
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
      this.onStatus('บันทึกคลาวด์แล้ว');
    } catch {
      this.onStatus('บันทึกในเครื่องแล้ว (รอคลาวด์)');
    }
  }
}
