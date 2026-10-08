"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConvex } from "convex/react";
import { api } from "@repo/backend/api";
import type { FunctionReturnType } from "convex/server";
import { authClient } from "@/lib/auth-client";
import { useMenuStore } from "@/lib/menu-store";
import { PageHead, errorMessage, useToast } from "@/components/dashboard/ui";
import { downloadFile } from "@/lib/download";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function AccountPage() {
  const { remote, localStates } = useMenuStore();
  return (
    <>
      <PageHead
        title="Mon compte"
        back={{ href: "/dashboard/venue", label: "Établissement" }}
      />
      {remote ? (
        <RemoteAccount />
      ) : (
        <section className="pro-card">
          <h2 className="pro-card-title">Votre espace de démonstration</h2>
          <p className="pro-hint">
            Vous utilisez MenuShare sans compte. Les données restent sur cet
            appareil. Exportez-les avant d’effacer les données du navigateur.
          </p>
          <button
            className="pro-btn primary"
            onClick={() =>
              downloadFile(
                "menushare-demo.json",
                JSON.stringify(
                  {
                    format: "menushare-export",
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    establishments: localStates,
                  },
                  null,
                  2,
                ),
              )
            }
          >
            Exporter toutes mes données
          </button>
        </section>
      )}
      <div className="pro-utility-links">
        <Link href="/help">Aide</Link>
        <Link href="/privacy">Confidentialité</Link>
        <Link href="/terms">Conditions d’utilisation</Link>
      </div>
    </>
  );
}

function RemoteAccount() {
  const { data: session } = authClient.useSession();
  const client = useConvex();
  const toast = useToast();
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<
    {
      token: string;
      userAgent?: string | null;
      createdAt: Date;
      expiresAt: Date;
    }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    setName(session?.user.name ?? "");
  }, [session?.user.name]);
  useUnsavedChanges(Boolean(session) && name !== session?.user.name && !busy);
  async function loadSessions() {
    setLoadError("");
    try {
      const result = await authClient.listSessions();
      if (result.error)
        throw new Error("Impossible de charger les connexions.");
      setSessions(result.data ?? []);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }
  useEffect(() => {
    void loadSessions();
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function exportData() {
    const establishments: unknown[] = [];
    let cursor: string | null = null;
    for (;;) {
      const result: FunctionReturnType<typeof api.venues.listMinePaginated> =
        await client.query(api.venues.listMinePaginated, {
          paginationOpts: { cursor, numItems: 25 },
        });
      for (const entry of result.page) {
        establishments.push(
          entry.menuId
            ? await client.query(api.menus.getDraft, { menuId: entry.menuId })
            : entry,
        );
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    downloadFile(
      "menushare-mes-donnees.json",
      JSON.stringify(
        {
          format: "menushare-export",
          version: 1,
          exportedAt: new Date().toISOString(),
          profile: { name: session?.user.name, email: session?.user.email },
          establishments,
        },
        null,
        2,
      ),
    );
    toast("Export téléchargé");
  }
  return (
    <div className="pro-stack">
      <section className="pro-card">
        <h2 className="pro-card-title">Profil</h2>
        <form
          className="pro-account-card"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const result = await authClient.updateUser({ name: name.trim() });
              if (result.error)
                throw new Error("Le profil n’a pas pu être enregistré.");
              toast("Profil enregistré");
            });
          }}
        >
          <label className="pro-field">
            <span>Votre nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="pro-field">
            <span>Adresse de connexion</span>
            <input value={session?.user.email ?? ""} readOnly type="email" />
          </label>
          <button
            className="pro-btn primary"
            disabled={busy || !name.trim() || name === session?.user.name}
          >
            Enregistrer le profil
          </button>
        </form>
      </section>
      <section className="pro-card">
        <h2 className="pro-card-title">Connexions actives</h2>
        {loadError ? (
          <p role="alert">
            {loadError}{" "}
            <button className="pro-btn line small" onClick={loadSessions}>
              Réessayer
            </button>
          </p>
        ) : (
          sessions.map((entry) => (
            <div className="pro-history-row" key={entry.token}>
              <div>
                <strong>
                  {entry.token === session?.session.token
                    ? "Cet appareil"
                    : "Autre appareil"}
                </strong>
                <small>
                  Connecté le{" "}
                  {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                </small>
                <small>
                  {entry.userAgent?.slice(0, 100) || "Navigateur non identifié"}
                </small>
              </div>
              {entry.token !== session?.session.token ? (
                <button
                  className="pro-btn line small"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await authClient.revokeSession({
                        token: entry.token,
                      });
                      if (result.error)
                        throw new Error("Déconnexion impossible.");
                      await loadSessions();
                      toast("Appareil déconnecté");
                    })
                  }
                >
                  Déconnecter
                </button>
              ) : null}
            </div>
          ))
        )}
        <button
          className="pro-btn line"
          disabled={busy || sessions.length < 2}
          onClick={() =>
            run(async () => {
              const result = await authClient.revokeOtherSessions();
              if (result.error) throw new Error("Déconnexion impossible.");
              await loadSessions();
              toast("Autres appareils déconnectés");
            })
          }
        >
          Déconnecter les autres appareils
        </button>
      </section>
      <section className="pro-card">
        <h2 className="pro-card-title">Vos données</h2>
        <p className="pro-hint">
          Téléchargez votre profil et les cartes de tous vos établissements.
          L’export contient des liens vers vos images ; conservez également vos
          fichiers originaux.
        </p>
        <button
          className="pro-btn line"
          disabled={busy}
          onClick={() => run(exportData)}
        >
          Exporter mon profil et mes cartes
        </button>
      </section>
      <section className="pro-card">
        <h2 className="pro-card-title">Supprimer mon compte</h2>
        <p className="pro-hint">
          Cette action retire immédiatement vos cartes du public et lance la
          suppression de vos établissements, menus, fichiers et statistiques.
          Elle est définitive. Exportez vos données avant de continuer.
        </p>
        <label className="pro-field">
          <span>Saisissez SUPPRIMER pour confirmer</span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          className="pro-btn danger"
          disabled={busy || confirmation !== "SUPPRIMER"}
          onClick={() =>
            run(async () => {
              if (
                !confirm(
                  "Supprimer définitivement votre compte et tous vos établissements ?",
                )
              )
                return;
              const result = await authClient.deleteUser();
              if (result.error)
                throw new Error(
                  "Reconnectez-vous pour confirmer la suppression de votre compte, puis réessayez.",
                );
              window.location.assign("/");
            })
          }
        >
          Supprimer définitivement mon compte
        </button>
      </section>
    </div>
  );
}
