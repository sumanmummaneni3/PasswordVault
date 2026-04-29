import { AlertTriangle } from "lucide-react";

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-vault-700 bg-vault-800 shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-danger/20" : "bg-accent/20"
            }`}
          >
            <AlertTriangle
              className={`h-5 w-5 ${danger ? "text-danger-fg" : "text-accent"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-vault-50">{title}</h3>
            <p className="text-sm text-vault-400 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={danger ? "btn-danger text-sm" : "btn-primary text-sm"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
