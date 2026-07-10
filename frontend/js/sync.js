import { CONFIG } from './config.js?v=11';
import { saveNotes } from './drive.js?v=11';

export class SaveManager {
  constructor() {
    this.queue = Promise.resolve();
    this.knownModifiedTime = null;
    this.fileId = null;
    this.accessToken = null;
    this.onStatus = () => {};
    this.onConflict = () => {};
  }

  configure({ accessToken, fileId, modifiedTime, onStatus, onConflict }) {
    this.accessToken = accessToken;
    this.fileId = fileId;
    this.knownModifiedTime = modifiedTime;
    this.onStatus = onStatus || this.onStatus;
    this.onConflict = onConflict || this.onConflict;
  }

  updateKnownModifiedTime(modifiedTime) {
    this.knownModifiedTime = modifiedTime;
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
      .catch((error) => {
        if (error.name === 'ConflictError') {
          this.onConflict(error);
          this.onStatus('ข้อมูลขัดแย้ง');
          return;
        }
        this.onStatus('บันทึกไม่สำเร็จ');
        throw error;
      });
    return this.queue;
  }

  async _performSave(notesData) {
    if (!this.accessToken || !this.fileId) {
      return;
    }

    this.onStatus('กำลังบันทึก...');

    const modifiedTime = await saveNotes(
      this.accessToken,
      this.fileId,
      notesData,
      this.knownModifiedTime,
    );

    this.knownModifiedTime = modifiedTime;
    this.onStatus('บันทึกแล้ว');
  }
}
