import { validAttempt, type WritingAttempt } from "./writing-data";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("pet-writing-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("accounts"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("请关闭其他应用标签页后重试。"));
  });
}
// Serialize saves for each account, including when the view is left and reopened.
const pending = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
export async function loadWriting(username: string): Promise<WritingAttempt[]> {
  await pending.get(username);
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("accounts", "readonly");
      const request = tx.objectStore("accounts").get(username);
      tx.oncomplete = () => {
        const row = request.result as { revision: number; data: unknown } | undefined;
        const data: unknown = row?.data ?? [];
        if (!Array.isArray(data) || !data.every(validAttempt)) reject(new Error("写作数据无法读取，请先保留原有备份。"));
        else { revisions.set(username, row?.revision ?? 0); resolve(data); }
      };
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export function saveWriting(username: string, attempts: WritingAttempt[]): Promise<void> {
  const save = (pending.get(username) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("accounts", "readwrite");
        const store = tx.objectStore("accounts");
        const request = store.get(username);
        let nextRevision = 0;
        let conflict = false;
        request.onsuccess = () => {
          const actual = request.result?.revision ?? 0;
          if (!revisions.has(username) || actual !== revisions.get(username)) { conflict = true; tx.abort(); return; }
          nextRevision = actual + 1;
          store.put({ revision: nextRevision, data: attempts }, username);
        };
        tx.oncomplete = () => { revisions.set(username, nextRevision); resolve(); };
        tx.onabort = () => reject(conflict ? new Error("其他标签页已修改写作记录，请导出当前备份后刷新页面。") : tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  pending.set(username, save);
  void save.finally(() => { if (pending.get(username) === save) pending.delete(username); }).catch(() => undefined);
  return save;
}
