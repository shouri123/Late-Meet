// Offline transcription cache utility module using IndexedDB
export function openMeetingDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("LateMeetMeetings", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("transcripts", { keyPath: "meetingId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
