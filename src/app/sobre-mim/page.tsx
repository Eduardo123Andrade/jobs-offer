import type { Metadata } from "next";
import Link from "next/link";
import { ProfileNotes } from "@/components/profile-notes";
import { listProfileNotes } from "@/lib/profile-notes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sobre mim" };

export default async function AboutMe() {
  const notes = await listProfileNotes();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Minhas aplicações
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Sobre mim</h1>
        <p className="text-sm text-muted">
          Anotações livres para ter à mão nas candidaturas: pitch, pontos fortes, histórias, respostas para perguntas comuns.
          Tudo é salvo automaticamente.
        </p>
      </header>
      <ProfileNotes initial={notes} />
    </main>
  );
}
