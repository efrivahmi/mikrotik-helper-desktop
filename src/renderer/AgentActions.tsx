import { useState } from "react";
import type { AgentAction } from "../shared/local-agent";
import type { Router } from "../shared/model";

export function AgentActionCard({
  action,
  router,
  disabled,
  onConfirm,
  onCancel,
}: {
  action: AgentAction;
  router: Router;
  disabled: boolean;
  onConfirm: (action: AgentAction, backupConfirmed: boolean) => void;
  onCancel: (id: string) => void;
}) {
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  return (
    <section
      className="notice agent-action-card"
      aria-label="Konfirmasi tindakan agent"
    >
      <h3>{action.title}</h3>
      <p>
        <strong>
          {router.name} · {router.host}:{router.port}
        </strong>
      </p>
      <p>
        Target: {action.targets.join(", ") || "router yang dipilih"}. Berlaku
        sampai {new Date(action.expiresAt).toLocaleTimeString("id-ID")}.
      </p>
      {action.inheritedContext && (
        <p>
          Topik/target memakai konteks pemeriksaan sebelumnya. Evidence akan
          dibaca ulang.
        </p>
      )}
      <details>
        <summary>Perintah dan cakupan ({action.commands.length})</summary>
        <pre className="script">{action.commands.join("\n")}</pre>
      </details>
      {action.warnings.map((warning, i) => (
        <p key={i}>{warning}</p>
      ))}
      {action.kind === "backup" && (
        <label className="inline-check">
          <input
            type="checkbox"
            checked={backupConfirmed}
            onChange={(e) => setBackupConfirmed(e.target.checked)}
          />
          Saya mengonfirmasi pembuatan backup penuh sesuai cakupan ini. Backup
          yang tidak lengkap harus dinyatakan gagal.
        </label>
      )}
      <div className="row">
        <button disabled={disabled} onClick={() => onCancel(action.id)}>
          Batalkan tindakan
        </button>
        <button
          className="primary"
          disabled={disabled || (action.kind === "backup" && !backupConfirmed)}
          onClick={() => onConfirm(action, backupConfirmed)}
        >
          {action.kind === "backup"
            ? "Konfirmasi & buat backup penuh"
            : action.kind === "model"
              ? "Konfirmasi analisis model"
              : "Konfirmasi pemeriksaan baca saja"}
        </button>
      </div>
    </section>
  );
}
