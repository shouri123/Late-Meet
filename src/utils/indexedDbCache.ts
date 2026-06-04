// Offline transcription cache utility module using IndexedDB
export function openMeetingDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("LateMeetMeetings", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("transcripts", { keyPath: "meetingId" });
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}
