import { CONFIG } from './config.js?v=51';
import { saveNotes } from './local.js?v=117';

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

  saveNow(getNotesData) {
    const data = this.resolveData(getNotesData);
    this.queue = this.queue
      .then(() => this._performSave(data))
      .catch(() => {
        this.onStatus('บันทึกไม่สำเร็จ');
      });
    return this.queue;
  }

  async _performSave(notesData) {
    this.onStatus('กำลังบันทึก...');
    saveNotes(notesData);
    this._typingStatusActive = false;

    if (typeof this.remotePush === 'function') {
      try {
        await this.remotePush(notesData);
        this.onStatus('บันทึกในฐานข้อมูลแล้ว');
      } catch {
        this.onStatus('บันทึกในเครื่อง (ออฟไลน์)');
      }
    } else {
      this.onStatus('บันทึกแล้ว');
    }
  }
}
