import { AuthManager } from "../auth/authManager.js";
import { LocalStore } from "../storage/localStore.js";
import { DebridProviders } from "../debrid/debridProviders.js";
import { DebridSettingsStore } from "../../data/local/debridSettingsStore.js";
import { SupabaseApi } from "../../data/remote/supabase/supabaseApi.js";
import { ProfileManager } from "./profileManager.js";
import { getSyncClientId } from "../sync/syncClientIdentity.js";

const SEED_RPC = "sync_seed_provider_credentials";
const PUSH_RPC = "sync_push_provider_credentials";
const PULL_RPC = "sync_pull_provider_credentials";
const PENDING_KEY = "providerCredentialSyncPendingProfiles";
const PUSH_DEBOUNCE_MS = 500;
const API_KEY_FIELD = "api_key";

const pushTimers = new Map();
let syncInFlight = Promise.resolve();

function resolveProfileId(profileId = null) {
  const value = Number(profileId ?? ProfileManager.getActiveProfileId() ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
}

function providerName(providerId) {
  return `debrid:${String(providerId || "")
    .trim()
    .toLowerCase()}`;
}

function readPendingProfiles() {
  const value = LocalStore.get(PENDING_KEY, {}) || {};
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function markPending(profileId) {
  const pending = readPendingProfiles();
  pending[String(resolveProfileId(profileId))] = Date.now();
  LocalStore.set(PENDING_KEY, pending);
}

function clearPending(profileId) {
  const pending = readPendingProfiles();
  delete pending[String(resolveProfileId(profileId))];
  LocalStore.set(PENDING_KEY, pending);
}

function isPending(profileId) {
  return Object.prototype.hasOwnProperty.call(
    readPendingProfiles(),
    String(resolveProfileId(profileId))
  );
}

function snapshotFromLocal(profileId) {
  const resolvedProfileId = resolveProfileId(profileId);
  const settings = DebridSettingsStore.getForProfile(resolvedProfileId);
  return {
    profileId: resolvedProfileId,
    values: DebridProviders.all().map((provider) => ({
      provider: providerName(provider.id),
      value: DebridProviders.apiKeyFor(settings, provider.id)
    }))
  };
}

function credentialJson(value) {
  return { [API_KEY_FIELD]: String(value || "").trim() };
}

function credentialParams(snapshot) {
  return {
    p_profile_id: snapshot.profileId,
    p_origin_client_id: getSyncClientId(),
    p_credentials: snapshot.values.map((entry) => ({
      provider: entry.provider,
      credential_json: credentialJson(entry.value)
    }))
  };
}

function parseCredentialJson(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? value : null;
}

export function mergeProviderCredentialRows(snapshot, rows = []) {
  const remoteByProvider = new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [
      String(row?.provider || "")
        .trim()
        .toLowerCase(),
      row
    ])
  );
  return {
    ...snapshot,
    values: snapshot.values.map((local) => {
      const remote = remoteByProvider.get(local.provider);
      if (!remote) return local;
      const payload = parseCredentialJson(remote.credential_json ?? remote.credentialJson);
      if (!payload || typeof payload[API_KEY_FIELD] !== "string") {
        throw new Error(`Invalid credential payload for ${local.provider}`);
      }
      return { ...local, value: payload[API_KEY_FIELD].trim() };
    })
  };
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left?.values || []) === JSON.stringify(right?.values || []);
}

async function withSyncLock(task) {
  const previous = syncInFlight;
  let release;
  syncInFlight = new Promise((resolve) => {
    release = resolve;
  });
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
  }
}

async function currentScope(profileId) {
  if (!AuthManager.isAuthenticated) return null;
  const resolvedProfileId = resolveProfileId(profileId);
  if (String(ProfileManager.getActiveProfileId()) !== String(resolvedProfileId)) return null;
  const ownerId = String(await AuthManager.getEffectiveUserId());
  return { ownerId, profileId: resolvedProfileId };
}

async function requireCurrentScope(expected) {
  const current = await currentScope(expected.profileId);
  if (!current || current.ownerId !== expected.ownerId) {
    throw new Error("Provider credential sync target changed");
  }
}

async function pushSnapshot(snapshot) {
  await SupabaseApi.rpc(PUSH_RPC, credentialParams(snapshot), true);
}

async function seedSnapshot(snapshot) {
  await SupabaseApi.rpc(SEED_RPC, credentialParams(snapshot), true);
}

async function pullRows(profileId) {
  const rows = await SupabaseApi.rpc(PULL_RPC, { p_profile_id: resolveProfileId(profileId) }, true);
  return Array.isArray(rows) ? rows : [];
}

function applySnapshot(snapshot) {
  snapshot.values.forEach((entry) => {
    const providerId = entry.provider.startsWith("debrid:")
      ? entry.provider.slice("debrid:".length)
      : "";
    if (!providerId) return;
    DebridSettingsStore.setProviderApiKeyForProfile(snapshot.profileId, providerId, entry.value, {
      silentSync: true,
      silentCredentialSync: true
    });
  });
}

export const ProviderCredentialSyncService = {
  queuePush(profileId = null) {
    if (!AuthManager.isAuthenticated) return;
    const resolvedProfileId = resolveProfileId(profileId);
    markPending(resolvedProfileId);
    const existing = pushTimers.get(resolvedProfileId);
    if (existing) clearTimeout(existing);
    pushTimers.set(
      resolvedProfileId,
      setTimeout(() => {
        pushTimers.delete(resolvedProfileId);
        void this.pushCurrentToRemote(resolvedProfileId);
      }, PUSH_DEBOUNCE_MS)
    );
  },

  async pushCurrentToRemote(profileId = null) {
    return withSyncLock(async () => {
      try {
        const scope = await currentScope(profileId);
        if (!scope) return false;
        const snapshot = snapshotFromLocal(scope.profileId);
        await pushSnapshot(snapshot);
        await requireCurrentScope(scope);
        clearPending(scope.profileId);
        return true;
      } catch (error) {
        console.warn("Provider credential sync push failed", error);
        return false;
      }
    });
  },

  async syncFromRemote(profileId = null) {
    return withSyncLock(async () => {
      try {
        const scope = await currentScope(profileId);
        if (!scope) return false;
        const localSnapshot = snapshotFromLocal(scope.profileId);
        if (isPending(scope.profileId)) {
          await pushSnapshot(localSnapshot);
          clearPending(scope.profileId);
        }
        await seedSnapshot(localSnapshot);
        const rows = await pullRows(scope.profileId);
        await requireCurrentScope(scope);
        const remoteSnapshot = mergeProviderCredentialRows(localSnapshot, rows);
        const applied = !snapshotsEqual(localSnapshot, remoteSnapshot);
        if (applied) applySnapshot(remoteSnapshot);
        await requireCurrentScope(scope);
        return applied;
      } catch (error) {
        console.warn("Provider credential sync failed; keeping local credentials", error);
        return false;
      }
    });
  }
};
