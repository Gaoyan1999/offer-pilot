"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Checking session...");
  const [isSaving, setIsSaving] = useState(false);
  const [supabaseState] = useState(() => {
    try {
      return { client: getSupabaseBrowserClient(), error: "" };
    } catch (clientError) {
      return {
        client: null,
        error: clientError instanceof Error ? clientError.message : "Supabase is not configured.",
      };
    }
  });
  const supabase = supabaseState.client;

  useEffect(() => {
    if (supabaseState.error) {
      setError(supabaseState.error);
      setStatus("Missing configuration");
    }
  }, [supabaseState.error]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    async function loadSession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        setStatus("Signed out");
        return;
      }

      if (!session) {
        setUser(null);
        setError("");
        setStatus("Signed out");
        return;
      }

      const { data, error: userError } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (userError) {
        setError(userError.message);
        setStatus("Signed out");
        return;
      }

      setUser(data.user);
      setError("");
      setStatus(data.user ? "Signed in" : "Signed out");
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setError("");
      setStatus(session?.user ? "Signed in" : "Signed out");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) {
      setNote("");
      setSavedNote("");
      return;
    }

    const currentUser = user;
    let isMounted = true;

    async function loadNote() {
      setStatus("Loading saved text...");
      const { data, error: loadError } = await supabase
        .from("user_notes")
        .select("content")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (loadError) {
        setError(loadError.message);
        setStatus("Load failed");
        return;
      }

      const content = data?.content ?? "";
      setNote(content);
      setSavedNote(content);
      setError("");
      setStatus("Ready");
    }

    void loadNote();

    return () => {
      isMounted = false;
    };
  }, [supabase, user]);

  async function handleGoogleLogin() {
    if (!supabase) {
      return;
    }

    setError("");
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setError("");
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !user) {
      return;
    }

    setIsSaving(true);
    setError("");

    const { error: saveError } = await supabase.from("user_notes").upsert(
      {
        user_id: user.id,
        content: note,
      },
      { onConflict: "user_id" },
    );

    if (saveError) {
      setError(saveError.message);
      setStatus("Save failed");
    } else {
      setSavedNote(note);
      setStatus("Saved");
    }

    setIsSaving(false);
  }

  const hasChanges = note !== savedNote;

  return (
    <main className="page">
      <section className="workspace">
        <header className="header">
          <div>
            <p className="eyebrow">Supabase Auth + Database</p>
            <h1>Google Login Save Test</h1>
          </div>
          <span className="status">{status}</span>
        </header>

        {!user ? (
          <section className="panel">
            <h2>Sign in</h2>
            <p className="summary">
              Sign in with Google, write a short note, and save it to Supabase. After refreshing the page, the same
              note should still be loaded.
            </p>
            <button type="button" onClick={handleGoogleLogin} disabled={!supabase}>
              Sign in with Google
            </button>
          </section>
        ) : (
          <section className="panel">
            <div className="accountRow">
              <div>
                <span className="label">Current user</span>
                <p className="account">{user.email ?? user.id}</p>
              </div>
              <button type="button" className="secondaryButton" onClick={handleSignOut}>
                Sign out
              </button>
            </div>

            <form className="noteForm" onSubmit={handleSubmit}>
              <label htmlFor="note">Test note</label>
              <textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={8}
                placeholder="Type anything here, save it, then refresh. The saved text should still appear."
              />
              <button type="submit" disabled={isSaving || !hasChanges}>
                {isSaving ? "Saving..." : hasChanges ? "Save" : "Saved"}
              </button>
            </form>
          </section>
        )}

        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
