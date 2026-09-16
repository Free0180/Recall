import type { SyncStatus } from "./cloud-sync";

const messages: Record<SyncStatus, string> = {
  local: "当前使用本机保存，云同步尚未连接。",
  pending: "已保存在本机，等待同步。",
  syncing: "正在同步...",
  synced: "学习进度与语音设置已同步。",
  conflict: "本机与云端都有不同记录，请选择要继续使用的版本。选择前会在本机保留两份冲突备份。",
  error: "云同步未完成，本机数据保留。请检查网络、登录状态及数据库配置后重试。",
};
export function CloudSyncPanel({ username, status, onSync, onResolve }: { username: string; status: SyncStatus; onSync: () => void; onResolve: (choice: "cloud" | "local") => void }): JSX.Element {
  function exportConflicts(): void {
    const copies = Object.keys(localStorage).filter(key => key.startsWith(`pet-cloud-v1-${username}-conflict-`))
      .map(key => ({ key, ...JSON.parse(localStorage.getItem(key)!) as object }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(copies, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pet-conflicts-${username}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return <section className="pet-profile-section" aria-label="云同步">
    <h2>学习数据云同步</h2><p role="status">{messages[status]}</p>
    <p>导入的精读原文、听力时间轴和音频仍保存在本机。写作原稿、照片及点评请在写作页单独备份。备考计划、各科练习与手工点评也仅在本机保存，请到“备考 → 家长复盘”导出备份。</p>
    <div className="pet-profile-actions">
      <button type="button" disabled={status === "local" || status === "syncing" || status === "conflict"} onClick={onSync}>立即同步</button>
      {status === "conflict" ? <>
        <button type="button" onClick={() => onResolve("cloud")}>使用云端版本</button>
        <button type="button" onClick={() => onResolve("local")}>使用本机版本</button>
      </> : null}
      <button type="button" onClick={exportConflicts}>导出冲突备份</button>
    </div>
  </section>;
}
