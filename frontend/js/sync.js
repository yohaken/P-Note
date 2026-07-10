import { CONFIG } from './config.js?v=17';
import { saveNotes } from './local.js?v=17';

export class SaveManager {
  constructor() {
    this.queue = Promise.resolve();
    this.onStatus = () => {};
  }

  configure({ onStatus }) {
    this.onStatus = onStatus || this.onStatus;
  }

  scheduleSave(notesData) {
    this.onStatus('กำลังพิมพ์...');
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.saveNow(notesData);
    }, CONFIG.AUTOSAVE_DELAY_MS);
  }

  saveNow(notesData) {
    this.queue = this.queue
      .then(() => this._performSave(notesData))
      .catch(() => {
        this.onStatus('บันทึกไม่สำเร็จ');
      });
    return this.queue;
  }

  async _performSave(notesData) {
    this.onStatus('กำลังบันทึก...');
    saveNotes(notesData);
    this.onStatus('บันทึกแล้ว');
  }
}
