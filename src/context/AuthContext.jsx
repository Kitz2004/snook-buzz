import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(undefined); // undefined = loading
  const [group,    setGroup]    = useState(null);       // { id, name, invite_code }
  const [loading,  setLoading]  = useState(true);

  // ── Listen for auth state changes ─────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadGroup(session.user.id);
      else         setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadGroup(session.user.id);
      else { setGroup(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load the group this user belongs to ───────────────────────────────────
  const loadGroup = async (userId) => {
    const { data } = await supabase
      .from("group_members")
      .select("groups(id, name, invite_code)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    setGroup(data?.groups ?? null);
    setLoading(false);
  };

  // ── Sign up ───────────────────────────────────────────────────────────────
  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  // ── Sign in ───────────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setGroup(null);
  };

  // ── Create a new group ────────────────────────────────────────────────────
  const createGroup = async (name) => {
    const userId = session?.user?.id;
    if (!userId) return { error: { message: "Not logged in" } };

    // Insert group
    const { data: grp, error: grpErr } = await supabase
      .from("groups")
      .insert({ name, created_by: userId })
      .select()
      .single();
    if (grpErr) return { error: grpErr };

    // Add creator as member
    const { error: memErr } = await supabase
      .from("group_members")
      .insert({ group_id: grp.id, user_id: userId });
    if (memErr) return { error: memErr };

    setGroup(grp);
    return { error: null };
  };

  // ── Join an existing group by invite code ─────────────────────────────────
  const joinGroup = async (code) => {
    const userId = session?.user?.id;
    if (!userId) return { error: { message: "Not logged in" } };

    // Look up group by invite code
    const { data: grp, error: findErr } = await supabase
      .from("groups")
      .select("*")
      .eq("invite_code", code.trim().toLowerCase())
      .single();

    if (findErr || !grp) return { error: { message: "Invalid invite code. Please check and try again." } };

    // Check if already a member
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", grp.id)
      .eq("user_id", userId)
      .single();

    if (existing) { setGroup(grp); return { error: null }; }

    // Add as member
    const { error: memErr } = await supabase
      .from("group_members")
      .insert({ group_id: grp.id, user_id: userId });
    if (memErr) return { error: memErr };

    setGroup(grp);
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ session, group, loading, signUp, signIn, signOut, createGroup, joinGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
