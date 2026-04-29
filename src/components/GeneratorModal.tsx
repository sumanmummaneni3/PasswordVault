import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PassphraseOptions, PasswordOptions } from "../types";

interface Props {
  onClose: () => void;
  onUse?: (password: string) => void;
}

type Mode = "password" | "passphrase";

const DEFAULT_PW_OPTS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  custom_symbols: undefined,
  exclude_ambiguous: false,
};

const DEFAULT_PP_OPTS: PassphraseOptions = {
  word_count: 5,
  separator: "-",
  capitalize: true,
  include_number: true,
};

export function GeneratorModal({ onClose, onUse }: Props) {
  const [mode, setMode] = useState<Mode>("password");
  const [pwOpts, setPwOpts] = useState<PasswordOptions>(DEFAULT_PW_OPTS);
  const [ppOpts, setPpOpts] = useState<PassphraseOptions>(DEFAULT_PP_OPTS);
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    generate();
  }, [mode, pwOpts, ppOpts]);

  async function generate() {
    setError("");
    try {
      if (mode === "password") {
        const pw = await invoke<string>("cmd_generate_password", {
          options: pwOpts,
        });
        setGenerated(pw);
      } else {
        const pp = await invoke<string>("cmd_generate_passphrase", {
          options: ppOpts,
        });
        setGenerated(pp);
      }
    } catch (err) {
      setError(String(err));
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const entropy = mode === "password"
    ? calcPasswordEntropy(pwOpts)
    : calcPassphraseEntropy(ppOpts.word_count);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-vault-700 bg-vault-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-700">
          <h2 className="font-semibold text-vault-50">Password Generator</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-vault-700 p-1">
            {(["password", "passphrase"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-md font-medium capitalize transition-colors ${
                  mode === m
                    ? "bg-vault-500 text-vault-50"
                    : "text-vault-400 hover:text-vault-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Generated output */}
          <div>
            <div className="flex gap-2">
              <div
                className={`input flex-1 font-mono text-sm break-all select-all min-h-[44px] flex items-center ${
                  mode === "passphrase" ? "text-vault-100" : "text-success-fg"
                }`}
              >
                {generated || "…"}
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={generate} className="btn-secondary p-2" title="Regenerate">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={copy}
                  className={`btn p-2 transition-colors ${
                    copied
                      ? "bg-success/20 text-success-fg border border-success"
                      : "btn-secondary"
                  }`}
                  title="Copy"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {/* Entropy indicator */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-vault-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${entropyColor(entropy)}`}
                  style={{ width: `${Math.min(100, (entropy / 100) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-vault-400 tabular-nums whitespace-nowrap">
                ~{entropy} bits
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger-fg">{error}</p>
          )}

          {/* Password options */}
          {mode === "password" && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="label mb-0">Length</label>
                  <span className="text-xs font-mono text-accent">{pwOpts.length}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={pwOpts.length}
                  onChange={(e) =>
                    setPwOpts((o) => ({ ...o, length: +e.target.value }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Toggle
                  label="Uppercase (A–Z)"
                  checked={pwOpts.uppercase}
                  onChange={(v) => setPwOpts((o) => ({ ...o, uppercase: v }))}
                />
                <Toggle
                  label="Lowercase (a–z)"
                  checked={pwOpts.lowercase}
                  onChange={(v) => setPwOpts((o) => ({ ...o, lowercase: v }))}
                />
                <Toggle
                  label="Numbers (0–9)"
                  checked={pwOpts.numbers}
                  onChange={(v) => setPwOpts((o) => ({ ...o, numbers: v }))}
                />
                <Toggle
                  label="Symbols"
                  checked={pwOpts.symbols}
                  onChange={(v) => setPwOpts((o) => ({ ...o, symbols: v }))}
                />
                <Toggle
                  label="Exclude ambiguous"
                  checked={pwOpts.exclude_ambiguous}
                  onChange={(v) => setPwOpts((o) => ({ ...o, exclude_ambiguous: v }))}
                />
              </div>

              {pwOpts.symbols && (
                <div>
                  <label className="label">Custom symbols (leave blank for default)</label>
                  <input
                    type="text"
                    value={pwOpts.custom_symbols ?? ""}
                    onChange={(e) =>
                      setPwOpts((o) => ({
                        ...o,
                        custom_symbols: e.target.value || undefined,
                      }))
                    }
                    placeholder="e.g. !@#$%"
                    className="input font-mono text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Passphrase options */}
          {mode === "passphrase" && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="label mb-0">Word count</label>
                  <span className="text-xs font-mono text-accent">{ppOpts.word_count}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  value={ppOpts.word_count}
                  onChange={(e) =>
                    setPpOpts((o) => ({ ...o, word_count: +e.target.value }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div>
                <label className="label">Word separator</label>
                <input
                  type="text"
                  value={ppOpts.separator}
                  onChange={(e) =>
                    setPpOpts((o) => ({ ...o, separator: e.target.value }))
                  }
                  maxLength={5}
                  className="input w-24 font-mono text-center"
                />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Toggle
                  label="Capitalize words"
                  checked={ppOpts.capitalize}
                  onChange={(v) => setPpOpts((o) => ({ ...o, capitalize: v }))}
                />
                <Toggle
                  label="Add number"
                  checked={ppOpts.include_number}
                  onChange={(v) => setPpOpts((o) => ({ ...o, include_number: v }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-vault-700">
          <button onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
          {onUse && (
            <button
              onClick={() => {
                onUse(generated);
                onClose();
              }}
              className="btn-primary text-sm"
              disabled={!generated}
            >
              Use this password
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => e.key === " " && onChange(!checked)}
        className={`h-4 w-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
          checked
            ? "bg-accent border-accent"
            : "bg-vault-700 border-vault-600"
        }`}
      >
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="text-xs text-vault-200">{label}</span>
    </label>
  );
}

function calcPasswordEntropy(opts: PasswordOptions): number {
  let charsetSize = 0;
  const ambiguousCount = 5;
  if (opts.uppercase) charsetSize += opts.exclude_ambiguous ? 26 - 3 : 26;
  if (opts.lowercase) charsetSize += opts.exclude_ambiguous ? 26 - 2 : 26;
  if (opts.numbers) charsetSize += opts.exclude_ambiguous ? 10 - ambiguousCount + 3 : 10;
  if (opts.symbols) {
    charsetSize += opts.custom_symbols?.length ?? 27;
  }
  if (charsetSize === 0) return 0;
  return Math.round(opts.length * Math.log2(charsetSize));
}

function calcPassphraseEntropy(wordCount: number): number {
  // Wordlist size ~800 words → ~9.6 bits per word
  return Math.round(wordCount * Math.log2(800));
}

function entropyColor(bits: number): string {
  if (bits < 40) return "bg-danger";
  if (bits < 60) return "bg-warn";
  if (bits < 80) return "bg-warn";
  if (bits < 100) return "bg-accent";
  return "bg-success";
}
