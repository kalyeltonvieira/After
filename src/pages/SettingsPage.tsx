import React, { useRef, useState } from "react";
import {
  User,
  Settings,
  Palette,
  Bell,
  Shield,
  Trash2,
  Check,
  AlertCircle,
  LogOut,
  Sun,
  Moon,
  Laptop,
  Globe,
  Camera,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProject } from "../context/ProjectContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage, Language } from "../context/LanguageContext";
import { ThemeMode } from "../types";
import { getInitialsAvatar } from "../lib/avatar";
import { storage } from "../lib/firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

export function SettingsPage() {
  const { user, profile, updateUserProfile, signOut, deleteUserAccount } = useAuth();
  const { currentProject, deleteCurrentProject } = useProject();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "preferences" | "danger">(
    "profile"
  );

  // Profile Form State
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Danger Zone Modals
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateUserProfile({
        displayName,
        username,
        bio,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceToggle = async (key: string, value: boolean) => {
    if (!profile) return;
    const newPrefs = {
      ...profile.preferences,
      [key]: value,
    };
    try {
      await updateUserProfile({ preferences: newPrefs });
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200/70 dark:border-zinc-850">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {t("settings_title")}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {t("settings_subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-zinc-200 dark:border-zinc-800 pb-px">
        {[
          { id: "profile", label: t("settings_tab_profile"), icon: User },
          { id: "appearance", label: t("settings_tab_appearance"), icon: Palette },
          { id: "preferences", label: t("settings_tab_preferences"), icon: Bell },
          { id: "danger", label: t("settings_tab_danger"), icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                isActive
                  ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-semibold"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Profile */}
      {activeTab === "profile" && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-6">
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4" />
              <span>Profile updated successfully</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="flex items-center space-x-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !user) return;

                  if (!file.type.startsWith("image/")) {
                    setSaveError("Selecione um arquivo de imagem.");
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setSaveError("A imagem deve ter no máximo 5 MB.");
                    return;
                  }

                  setUploadingPhoto(true);
                  setSaveError(null);
                  setSaveSuccess(false);
                  try {
                    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
                    const imageRef = storageRef(
                      storage,
                      `profile-images/${user.uid}/${Date.now()}-${crypto.randomUUID()}.${extension}`
                    );
                    await uploadBytes(imageRef, file, {
                      contentType: file.type,
                      cacheControl: "public,max-age=31536000,immutable",
                    });
                    const photoURL = await getDownloadURL(imageRef);
                    await updateUserProfile({ photoURL });
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 3000);
                  } catch (err: any) {
                    console.error("Profile photo upload failed:", err);
                    setSaveError(err?.message || "Não foi possível atualizar a foto de perfil.");
                  } finally {
                    setUploadingPhoto(false);
                  }
                }}
              />

              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="group relative w-14 h-14 rounded-full cursor-pointer disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                title={language === "pt" ? "Alterar foto de perfil" : "Change profile photo"}
                aria-label={language === "pt" ? "Alterar foto de perfil" : "Change profile photo"}
              >
                <img
                  src={
                    profile?.photoURL ||
                    user?.photoURL ||
                    getInitialsAvatar(username || "user")
                  }
                  alt="Avatar"
                  className="w-14 h-14 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 object-cover"
                />
                <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </span>
              </button>

              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {profile?.displayName || user?.displayName || "User"}
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">{user?.email}</p>
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                  className="mt-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer disabled:cursor-wait"
                >
                  {uploadingPhoto
                    ? (language === "pt" ? "Enviando..." : "Uploading...")
                    : (language === "pt" ? "Alterar foto" : "Change photo")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Software architect and maintainer..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium hover:opacity-90 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          {/* Language Selection */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t("settings_language")}
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t("settings_language_desc")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLanguage("pt")}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  language === "pt"
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">🇧🇷</span>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings_lang_pt")}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Interface totalmente em português
                    </p>
                  </div>
                </div>
                {language === "pt" && (
                  <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  language === "en"
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 shadow-xs"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">🇺🇸</span>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings_lang_en")}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      English user interface
                    </p>
                  </div>
                </div>
                {language === "en" && (
                  <Check className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                )}
              </button>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t("settings_theme")}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {t("settings_theme_desc")}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { id: "light", label: t("settings_theme_light"), icon: Sun },
                { id: "dark", label: t("settings_theme_dark"), icon: Moon },
                { id: "system", label: t("settings_theme_system"), icon: Laptop },
              ].map((themeItem) => {
                const Icon = themeItem.icon;
                const isCurrent = theme === themeItem.id;
                return (
                  <button
                    key={themeItem.id}
                    type="button"
                    onClick={() => setTheme(themeItem.id as ThemeMode)}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all ${
                      isCurrent
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 shadow-xs"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {themeItem.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Preferences */}
      {activeTab === "preferences" && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 space-y-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Continuous AI Scan
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Automatically detect dependency drift and anomalies when new commits are logged.
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile?.preferences?.autoAnalysis ?? true}
              onChange={(e) => handlePreferenceToggle("autoAnalysis", e.target.checked)}
              className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Weekly Evolutionary Digest
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Receive summaries of code modifications, resolved regressions, and potential savings.
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile?.preferences?.weeklySummary ?? true}
              onChange={(e) => handlePreferenceToggle("weeklySummary", e.target.checked)}
              className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Experimental Features
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Preview next-generation AST dependency diffing and autonomous hypothesis formulation.
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile?.preferences?.experimentalFeatures ?? false}
              onChange={(e) => handlePreferenceToggle("experimentalFeatures", e.target.checked)}
              className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Tab: Danger Zone */}
      {activeTab === "danger" && (
        <div className="rounded-2xl border border-rose-200/80 dark:border-rose-950/80 bg-white dark:bg-zinc-900/40 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                Delete Current Project ({currentProject?.name})
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Permanently removes telemetry records, rationale graph, and insights for this project.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteProjectConfirm(true)}
              className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30 text-xs font-medium cursor-pointer"
            >
              Delete Project
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                Delete User Account & Profile
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Releases username reservation and deletes all profile data from Firestore.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteAccountConfirm(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Project */}
      {showDeleteProjectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Delete project "{currentProject?.name}"?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This action cannot be undone. All recorded events and insights for this project will be deleted.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteProjectConfirm(false)}
                className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteCurrentProject();
                  setShowDeleteProjectConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Account */}
      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Delete account @{profile?.username}?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              This will permanently delete your authentication record, user profile, and releases your username.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAccountConfirm(false)}
                className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteUserAccount();
                  setShowDeleteAccountConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
              >
                Confirm Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
