"use client";

import { useState } from "react";
import type { ProfileNote } from "@/db/schema";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProfileNotes({ initial }: { initial: ProfileNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState<number | null>(null);

  async function add() {
    setCreating(true);
    try {
      const res = await fetch("/api/profile-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) return;
      const note: ProfileNote = await res.json();
      setNotes((ns) => [...ns, note]);
      setNewId(note.id);
    } finally {
      setCreating(false);
    }
  }

  async function remove(note: ProfileNote) {
    if ((note.title || note.content) && !confirm(`Apagar "${note.title || "bloco sem título"}"?`)) return;
    const res = await fetch(`/api/profile-notes/${note.id}`, { method: "DELETE" });
    if (res.ok) setNotes((ns) => ns.filter((n) => n.id !== note.id));
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">Nenhum bloco ainda. Comece pelo seu pitch de 30 segundos.</div>
      )}
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} autoFocus={n.id === newId} onDelete={() => remove(n)} />
      ))}
      <button className="btn-ghost w-full" onClick={add} disabled={creating}>
        + Novo bloco
      </button>
    </div>
  );
}

function NoteCard({ note, autoFocus, onDelete }: { note: ProfileNote; autoFocus: boolean; onDelete: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [state, setState] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  // Last values persisted on the server, to skip no-op saves on blur.
  const [saved, setSaved] = useState({ title: note.title, content: note.content });

  async function save() {
    const patch = { title, content };
    if (patch.title === saved.title && patch.content === saved.content) return;
    setState("saving");
    try {
      const res = await fetch(`/api/profile-notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setSaved(patch);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const dirty = title !== saved.title || content !== saved.content;

  return (
    <article className="card space-y-2 p-4" onBlur={save}>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted"
          placeholder="Título (ex.: Pitch, Pontos fortes, Por que quero mudar)"
          value={title}
          autoFocus={autoFocus}
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className={`text-xs ${state === "error" ? "text-red-500" : "text-muted"}`}>
          {state === "saving" ? "Salvando…" : state === "error" ? "Erro ao salvar" : dirty ? "" : state === "saved" ? "Salvo" : ""}
        </span>
        <button className="btn-ghost h-7 px-2 text-xs" onClick={copy} disabled={!content}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
        <button className="btn-ghost h-7 px-2 text-xs hover:text-red-500" onClick={onDelete} aria-label="Apagar bloco">
          Apagar
        </button>
      </div>
      <textarea
        className="input field-sizing-content h-auto min-h-24 py-2 leading-relaxed"
        placeholder="Escreva aqui…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </article>
  );
}
