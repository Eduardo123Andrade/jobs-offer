"use client";

import { useState } from "react";
import type { ApplicationRow } from "@/lib/follow-up";
import { ApplicationForm } from "./application-form";
import { ApplicationsTable } from "./applications-table";

type Props = { rows: ApplicationRow[]; platforms: string[]; locations: string[]; cvFiles: string[] };

/** Owns the create/edit dialog state shared by the header button and the table. */
export function ApplicationsSection({ rows, platforms, locations, cvFiles }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationRow | null>(null);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">
          {rows.length} {rows.length === 1 ? "aplicação" : "aplicações"}
        </h2>
        <button className="btn-primary" onClick={openNew}>
          + Nova aplicação
        </button>
      </div>
      <ApplicationsTable
        rows={rows}
        onEdit={(a) => {
          setEditing(a);
          setFormOpen(true);
        }}
      />
      <ApplicationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        application={editing}
        platforms={platforms}
        locations={locations}
        cvFiles={cvFiles}
      />
    </section>
  );
}
