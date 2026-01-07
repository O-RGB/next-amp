export class DBManager {
  constructor(dbName = "NextAmpDB", storeName = "recordings") {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error("DB Open Error:", e.target.error);
        reject(e.target.error);
      };
    });
  }

  async saveRecording(blob) {
    await this.open();
    const id = Date.now().toString();
    const dateStr = new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    // คำนวณขนาดไฟล์เป็น MB
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    const record = {
      id,
      name: `Recording_${id}`,
      date: dateStr,
      size: sizeMB,
      blob: blob,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.add(record);

      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllRecordings() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();

      req.onsuccess = () => {
        // เรียงจากใหม่ไปเก่า
        const results = req.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteRecording(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }
}
