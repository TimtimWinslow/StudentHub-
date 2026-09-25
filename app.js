/* =========================================================
   STUDENTHUB — APP ENGINE
   ========================================================= */

/*
  IMPORTANT:
  Replace these two values with your existing Supabase
  project URL and anon/public key.

  Supabase Dashboard:
  Project Settings → API
*/

const SUPABASE_URL = "https://csmizeuuywlonuysktka.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";

/* =========================================================
   SUPABASE
   ========================================================= */

let supabaseClient = null;

function initializeSupabase() {
  if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY
) {
    return false;
  }

  if (!window.supabase) {
    console.error("Supabase library has not loaded.");
    return false;
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  return true;
}

/* =========================================================
   APP STATE
   ========================================================= */

const state = {
  session: null,
  user: null,
  profile: null,
  currentPage: "home",
  studyToolsOpen: false,
  accountMenuOpen: false,
  mobileMenuOpen: false
};

/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getDisplayName() {
  if (!state.profile) {
    return (
      state.user?.user_metadata?.full_name ||
      state.user?.user_metadata?.name ||
      state.user?.email?.split("@")[0] ||
      "Student"
    );
  }

  return (
    state.profile.full_name ||
    state.profile.display_name ||
    state.profile.name ||
    state.user?.email?.split("@")[0] ||
    "Student"
  );
}

function getInitials(name) {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {
  document.getElementById("app").innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
    </div>
  `;
}

/* =========================================================
   LOGIN PAGE
   ========================================================= */

function renderLoginPage(message = "") {
  document.getElementById("app").innerHTML = `
    <main class="auth-page">
      <section class="auth-card">

        <div class="auth-logo">🎓</div>

        <h1>Welcome to StudentHub</h1>

        <p class="auth-subtitle">
          Your personal academic and study hub.
        </p>

        <form id="login-form" class="auth-form">

          <div class="form-group">
            <label for="login-email">
              Email
            </label>

            <input
              id="login-email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="form-group">
            <label for="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            class="primary-button"
          >
            Sign In
          </button>

        </form>

        <div
          id="auth-message"
          class="auth-message"
        >
          ${escapeHtml(message)}
        </div>

      </section>
    </main>
  `;

  document
    .getElementById("login-form")
    .addEventListener("submit", handleLogin);
}

/* =========================================================
   LOGIN
   ========================================================= */

async function handleLogin(event) {
  event.preventDefault();

  const email =
    document.getElementById("login-email").value.trim();

  const password =
    document.getElementById("login-password").value;

  const message =
    document.getElementById("auth-message");

  try {
    if (!supabaseClient) {
      message.textContent =
        "Supabase is not configured yet.";
      return;
    }

    message.textContent = "Signing in...";

    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      message.textContent =
        "Login error: " + error.message;
      return;
    }

    state.session = data.session;
    state.user = data.user;

    message.textContent = "Login successful. Loading your StudentHub...";

    await loadProfile();

    renderApp();

  } catch (error) {
    console.error("StudentHub login/load error:", error);

    message.textContent =
      "StudentHub error: " +
      (error?.message || String(error));
  }
}

/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (!supabaseClient || !state.user) {
    return;
  }

  /*
    We use the existing profiles table.
    If your existing profile columns differ,
    we will adjust this after testing.
  */

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();

  if (error) {
    console.warn(
      "Profile could not be loaded:",
      error.message
    );

    return;
  }

  state.profile = data;
}

/* =========================================================
   MAIN APP
   ========================================================= */

function renderApp() {
  document.getElementById("app").innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div
        id="mobile-overlay"
        class="mobile-overlay"
      ></div>

      <main class="main-area">

        ${renderTopbar()}

        <section id="page-content">
          ${renderHome()}
        </section>

      </main>

      ${
        state.accountMenuOpen
          ? renderAccountMenu()
          : ""
      }

    </div>
  `;

  attachAppListeners();
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  return `
    <aside
      id="sidebar"
      class="sidebar ${
        state.mobileMenuOpen ? "open" : ""
      }"
    >

      <div class="sidebar-brand">

        <div class="brand-icon">
          🎓
        </div>

        <div class="brand-text">
          StudentHub
        </div>

      </div>

      <nav class="sidebar-nav">

        <button
          class="nav-item ${
            state.currentPage === "home"
              ? "active"
              : ""
          }"
          data-page="home"
        >
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        <button
          class="nav-item"
          data-page="calendar"
        >
          <span class="nav-icon">📅</span>
          <span>Calendar</span>
        </button>

        <button
          class="nav-item"
          data-page="care-team"
        >
          <span class="nav-icon">💬</span>
          <span>The Care Team</span>
        </button>

      </nav>

      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Study Tools
        </div>

        <button
          id="study-toggle"
          class="nav-item study-toggle"
        >

          <span class="study-toggle-left">
            <span class="nav-icon">📚</span>
            <span>Study Tools</span>
          </span>

          <span
            class="study-arrow ${
              state.studyToolsOpen ? "open" : ""
            }"
          >
            ▼
          </span>

        </button>

        <div
          class="study-submenu ${
            state.studyToolsOpen ? "open" : ""
          }"
        >

          <button
            class="subnav-item"
            data-page="flashcards"
          >
            🧠 Flashcards
          </button>

          <button
            class="subnav-item"
            data-page="quiz-maker"
          >
            📝 Quiz Maker
          </button>

          <button
            class="subnav-item"
            data-page="study-timer"
          >
            ⏱️ Study Timer
          </button>

          <button
            class="subnav-item"
            data-page="study-checklist"
          >
            ✅ Study Checklist
          </button>

          <button
            class="subnav-item"
            data-page="chapter-tracker"
          >
            📖 Chapter Tracker
          </button>

        </div>

      </div>

      <div class="sidebar-section">

        <button
          class="nav-item"
          data-page="progress"
        >
          <span class="nav-icon">📈</span>
          <span>Progress</span>
        </button>

      </div>

    </aside>
  `;
}

/* =========================================================
   TOPBAR
   ========================================================= */

function renderTopbar() {
  return `
    <header class="topbar">

      <button
        id="mobile-menu-button"
        class="mobile-menu-button"
        aria-label="Open menu"
      >
        ☰
      </button>

      <div class="topbar-actions">

        <button
          id="account-button"
          class="topbar-button"
          title="Account"
        >
          👤
        </button>

        <button
          id="messages-button"
          class="topbar-button"
          title="Messages"
        >
          💬
        </button>

        <button
          id="notifications-button"
          class="topbar-button"
          title="Notifications"
        >
          🔔

          <span
            id="notification-badge"
            class="notification-badge"
            style="display:none;"
          >
            0
          </span>
        </button>

      </div>

    </header>
  `;
}

/* =========================================================
   ACCOUNT MENU
   ========================================================= */

function renderAccountMenu() {
  return `
    <div
      id="account-menu"
      class="account-menu"
    >

      <button
        class="account-menu-item"
        data-account="profile"
      >
        👤 My Profile
      </button>

      <button
        class="account-menu-item"
        data-account="details"
      >
        ⚙️ Account Details
      </button>

      <button
        class="account-menu-item"
        data-account="security"
      >
        🔐 Password & Security
      </button>

      <button
        class="account-menu-item"
        data-account="privacy"
      >
        🛡️ Privacy
      </button>

      <button
        class="account-menu-item"
        data-account="appearance"
      >
        🎨 Appearance
      </button>

      <button
        class="account-menu-item"
        data-account="export"
      >
        📦 Export My Data
      </button>

      <div class="account-menu-divider"></div>

      <button
        id="sign-out-button"
        class="account-menu-item"
      >
        🚪 Sign Out
      </button>

    </div>
  `;
}

/* =========================================================
   HOMEPAGE
   ========================================================= */

function renderHome() {
  const name = getDisplayName();

  return `
    <div class="page">

      <section class="welcome-section">

        <h1>
          ${escapeHtml(getGreeting())},
          ${escapeHtml(name)} 👋
        </h1>

        <p>
          Welcome back to StudentHub.
        </p>

      </section>

      <div class="home-grid">

        ${renderStatusPanel()}

        ${renderFeedPanel()}

        ${renderActivePanel()}

      </div>

    </div>
  `;
}

/* =========================================================
   STATUS REPORT
   ========================================================= */

function renderStatusPanel() {
  return `
    <section class="panel">

      <div class="panel-header">
        <h2>📊 Status Report</h2>
      </div>

      <div class="panel-body">

        <div class="status-list">

          <div class="status-item">
            <span class="status-label">
              Overall Progress
            </span>

            <span
              id="status-progress"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Overall Average
            </span>

            <span
              id="status-average"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              GPA
            </span>

            <span
              id="status-gpa"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Letter Grade
            </span>

            <span
              id="status-grade"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Score Consistency
            </span>

            <span
              id="status-consistency"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Tests Completed
            </span>

            <span
              id="status-tests"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Latest Score
            </span>

            <span
              id="status-latest"
              class="status-value"
            >
              —
            </span>
          </div>

          <div class="status-item">
            <span class="status-label">
              Current Chapter
            </span>

            <span
              id="status-chapter"
              class="status-value"
            >
              —
            </span>
          </div>

        </div>

      </div>

    </section>
  `;
}

/* =========================================================
   FEED
   ========================================================= */

function renderFeedPanel() {
  return `
    <section class="panel feed-panel">

      <div class="panel-header">
        <div>
          <h2>📰 Main Feed</h2>
          <p class="panel-subtitle">
            Stay connected with your class.
          </p>
        </div>
      </div>

      <div class="panel-body">

        <div class="feed-composer">

          <textarea
            id="post-content"
            placeholder="What's happening?"
            maxlength="2000"
          ></textarea>

          <div class="feed-composer-footer">

            <span class="composer-hint">
              Share an update with The Care Team.
            </span>

            <button
              id="create-post-button"
              class="small-button"
              type="button"
            >
              Post
            </button>

          </div>

        </div>

        <div
          id="feed-message"
          class="feed-message"
          aria-live="polite"
        ></div>

        <div id="feed-list">

          <div class="empty-state">
            Loading feed...
          </div>

        </div>

      </div>

    </section>
  `;
}

/* =========================================================
   ACTIVE USERS
   ========================================================= */

function renderActivePanel() {
  return `
    <section class="panel active-panel">

      <div class="panel-header">
        <div>
          <h2>🟢 Who's Active</h2>
          <p class="panel-subtitle">
            See who's currently around StudentHub.
          </p>
        </div>
      </div>

      <div class="panel-body">

        <div
          id="active-user-list"
          class="active-list"
        >

          <div class="empty-state">
            Loading active users...
          </div>

        </div>

        <button
          id="view-all-active-button"
          class="secondary-button"
          type="button"
        >
          View All
        </button>

      </div>

    </section>
  `;
}

/* =========================================================
   APP EVENT LISTENERS
   ========================================================= */

function attachAppListeners() {

  document
    .querySelectorAll("[data-page]")
    .forEach((button) => {

      button.addEventListener("click", () => {

        state.currentPage =
          button.dataset.page;

        state.mobileMenuOpen = false;

        renderApp();

        if (
          state.currentPage === "home"
        ) {
          loadHomepageData();
        }

      });

    });

  const studyToggle =
    document.getElementById("study-toggle");

  if (studyToggle) {
    studyToggle.addEventListener(
      "click",
      () => {

        state.studyToolsOpen =
          !state.studyToolsOpen;

        renderApp();

      }
    );
  }

  const accountButton =
    document.getElementById("account-button");

  if (accountButton) {
    accountButton.addEventListener(
      "click",
      () => {

        state.accountMenuOpen =
          !state.accountMenuOpen;

        renderApp();

      }
    );
  }

  const signOutButton =
    document.getElementById(
      "sign-out-button"
    );

  if (signOutButton) {
    signOutButton.addEventListener(
      "click",
      signOut
    );
  }

  const mobileMenuButton =
    document.getElementById(
      "mobile-menu-button"
    );

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener(
      "click",
      () => {

        state.mobileMenuOpen =
          !state.mobileMenuOpen;

        renderApp();

      }
    );
  }

  const overlay =
    document.getElementById(
      "mobile-overlay"
    );

  if (overlay) {
    overlay.addEventListener(
      "click",
      () => {

        state.mobileMenuOpen = false;

        renderApp();

      }
    );
  }

  const createPostButton =
    document.getElementById(
      "create-post-button"
    );

  if (createPostButton) {
    createPostButton.addEventListener(
      "click",
      createPost
    );
  }

  const messagesButton =
    document.getElementById(
      "messages-button"
    );

  if (messagesButton) {
    messagesButton.addEventListener(
      "click",
      () => navigateTo("care-team")
    );
  }

  const notificationsButton =
    document.getElementById(
      "notifications-button"
    );

  if (notificationsButton) {
    notificationsButton.addEventListener(
      "click",
      () => {

        alert(
          "Notifications will be connected next."
        );

      }
    );
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function navigateTo(page) {
  state.currentPage = page;
  state.accountMenuOpen = false;
  state.mobileMenuOpen = false;

  renderApp();
}

/* =========================================================
   SIGN OUT
   ========================================================= */

async function signOut() {
  if (!supabaseClient) {
    return;
  }

  await supabaseClient.auth.signOut();

  state.session = null;
  state.user = null;
  state.profile = null;

  renderLoginPage();
}

/* =========================================================
   FEED DATA
   ========================================================= */

async function loadFeed() {
  const feedList =
    document.getElementById("feed-list");

  if (!feedList || !supabaseClient) {
    return;
  }

  feedList.innerHTML = `
    <div class="empty-state">
      Loading feed...
    </div>
  `;

  const { data, error } =
    await supabaseClient
      .from("feed_posts")
      .select("*")
      .order("pinned", {
        ascending: false
      })
      .order("created_at", {
        ascending: false
      })
      .limit(20);

  if (error) {
    console.error(
      "Feed loading error:",
      error
    );

    feedList.innerHTML = `
      <div class="empty-state">
        Unable to load feed right now.
      </div>
    `;

    return;
  }

  if (!data || data.length === 0) {
    feedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📰</div>
        <strong>No posts yet</strong>
        <span>Be the first to share something with the class.</span>
      </div>
    `;

    return;
  }

  feedList.innerHTML = data
    .map((post) => {

      const isOwnPost =
        post.user_id === state.user?.id;

      const name =
        isOwnPost
          ? getDisplayName()
          : "Student";

      const initials =
        getInitials(name);

      const pinnedBadge =
        post.pinned
          ? `
            <span class="post-badge">
              📌 Pinned
            </span>
          `
          : "";

      const editedBadge =
        post.updated_at &&
        post.updated_at !== post.created_at
          ? `
            <span class="post-edited">
              · edited
            </span>
          `
          : "";

      const ownActions =
        isOwnPost
          ? `
            <button
              class="post-action"
              type="button"
              data-edit-post="${escapeHtml(post.id)}"
            >
              ✏️ Edit
            </button>

            <button
              class="post-action danger"
              type="button"
              data-delete-post="${escapeHtml(post.id)}"
            >
              🗑️ Delete
            </button>
          `
          : "";

      return `
        <article
          class="feed-post"
          data-post-id="${escapeHtml(post.id)}"
        >

          <div class="post-header">

            <div class="avatar">
              ${escapeHtml(initials)}
            </div>

            <div class="post-author-area">

              <div class="post-user">
                ${escapeHtml(name)}
              </div>

              <div class="post-time">
                ${formatDate(post.created_at)}
                ${editedBadge}
              </div>

            </div>

            ${pinnedBadge}

          </div>

          <div class="post-content">
            ${escapeHtml(post.content)}
          </div>

          <div class="post-actions">

            <button
              class="post-action"
              type="button"
              data-react-post="${escapeHtml(post.id)}"
            >
              ❤️ React
            </button>

            <button
              class="post-action"
              type="button"
              data-comment-post="${escapeHtml(post.id)}"
            >
              💬 Comment
            </button>

            ${ownActions}

          </div>

        </article>
      `;
    })
    .join("");
}

/* =========================================================
   CREATE POST
   ========================================================= */

async function createPost() {
  const textarea =
    document.getElementById(
      "post-content"
    );

  if (!textarea || !supabaseClient) {
    return;
  }

  const content =
    textarea.value.trim();

  if (!content) {
    return;
  }

  const button =
    document.getElementById(
      "create-post-button"
    );

  button.disabled = true;
  button.textContent = "Posting...";

  const { error } =
    await supabaseClient
      .from("feed_posts")
      .insert({
        user_id: state.user.id,
        content
      });

  if (error) {
    console.error(error);

    button.disabled = false;
    button.textContent = "Post";

    alert(
      "Unable to create the post."
    );

    return;
  }

  textarea.value = "";

  button.disabled = false;
  button.textContent = "Post";

  await loadFeed();
}

/* =========================================================
   ACTIVE USERS
   ========================================================= */

async function loadActiveUsers() {
  const list =
    document.getElementById(
      "active-user-list"
    );

  if (!list || !supabaseClient) {
    return;
  }

  list.innerHTML = `
    <div class="empty-state">
      Loading active users...
    </div>
  `;

  const { data: presenceData, error: presenceError } =
    await supabaseClient
      .from("user_presence")
      .select("user_id, status, last_seen_at")
      .order("status");

  if (presenceError) {
    console.error(
      "Presence loading error:",
      presenceError
    );

    list.innerHTML = `
      <div class="empty-state">
        Unable to load active users.
      </div>
    `;

    return;
  }

  if (
    !presenceData ||
    presenceData.length === 0
  ) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🟢</div>
        <strong>No one is showing as active yet.</strong>
        <span>Your status will appear here when presence is enabled.</span>
      </div>
    `;

    return;
  }

  const userIds =
    presenceData.map(
      (user) => user.user_id
    );

  const { data: profilesData, error: profilesError } =
    await supabaseClient
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

  if (profilesError) {
    console.error(
      "Profile loading error:",
      profilesError
    );
  }

  const profileMap = {};

  (profilesData || []).forEach(
    (profile) => {
      profileMap[profile.id] =
        profile.display_name ||
        "Student";
    }
  );

  list.innerHTML = presenceData
    .map((user) => {

      const name =
        user.user_id === state.user?.id
          ? getDisplayName()
          : (
              profileMap[user.user_id] ||
              "Student"
            );

      const status =
        user.status || "offline";

      const statusText =
        status.charAt(0).toUpperCase() +
        status.slice(1);

      return `
        <div
          class="active-user"
          data-user-id="${escapeHtml(
            user.user_id
          )}"
        >

          <div class="avatar">
            ${escapeHtml(
              getInitials(name)
            )}
          </div>

          <span
            class="status-dot ${escapeHtml(
              status
            )}"
            aria-label="${escapeHtml(
              statusText
            )}"
          ></span>

          <div class="active-user-info">

            <div class="active-user-name">
              ${escapeHtml(name)}
            </div>

            <div class="active-user-status">
              ${escapeHtml(statusText)}
            </div>

          </div>

        </div>
      `;
    })
    .join("");
}

/* =========================================================
   PRESENCE
   ========================================================= */

async function updatePresence(status = "online") {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const { error } =
    await supabaseClient
      .from("user_presence")
      .upsert({
        user_id: state.user.id,
        status,
        last_seen_at:
          new Date().toISOString()
      });

  if (error) {
    console.warn(
      "Presence update failed:",
      error.message
    );
  }
}

/* =========================================================
   ACADEMIC DATA
   ========================================================= */

async function loadAcademicSummary() {
  if (!supabaseClient || !state.user) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .from("student_academic_summary")
      .select("*")
      .eq("user_id", state.user.id)
      .maybeSingle();

  if (error) {
    console.warn(
      "Academic summary unavailable:",
      error.message
    );

    setText("status-progress", "—");
    setText("status-average", "—");
    setText("status-gpa", "—");
    setText("status-grade", "—");
    setText("status-consistency", "—");
    setText("status-tests", "0");

    return;
  }

  if (!data) {
    setText("status-progress", "No data");
    setText("status-average", "—");
    setText("status-gpa", "—");
    setText("status-grade", "—");
    setText("status-consistency", "—");
    setText("status-tests", "0");

    return;
  }

  const average = data.overall_average;

  const progress =
    data.total_tests
      ? Math.min(
          100,
          Number(data.total_tests) * 10
        )
      : 0;

  setText(
    "status-progress",
    `${progress}%`
  );

  setText(
    "status-average",
    average !== null
      ? `${Number(average).toFixed(1)}%`
      : "—"
  );

  setText(
    "status-gpa",
    data.gpa !== null
      ? Number(data.gpa).toFixed(2)
      : "—"
  );

  setText(
    "status-grade",
    data.overall_letter_grade || "—"
  );

  setText(
    "status-consistency",
    data.score_consistency !== null
      ? Number(data.score_consistency).toFixed(1)
      : "—"
  );

  setText(
    "status-tests",
    data.total_tests ?? "0"
  );
}

/* =========================================================
   LATEST SCORE
   ========================================================= */

async function loadLatestScore() {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .from("student_score_details")
      .select("*")
      .eq("user_id", state.user.id)
      .order("test_date", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (error || !data) {
    return;
  }

  setText(
    "status-latest",
    data.score !== null
      ? `${Number(data.score).toFixed(0)}%`
      : "—"
  );

  setText(
    "status-chapter",
    data.title ||
      (data.chapter_number
        ? `Chapter ${data.chapter_number}`
        : "—")
  );
}

/* =========================================================
   HOMEPAGE DATA
   ========================================================= */

async function loadHomepageData() {
  await Promise.all([
    loadAcademicSummary(),
    loadLatestScore(),
    loadFeed(),
    loadActiveUsers(),
    updatePresence("online")
  ]);
}

/* =========================================================
   TEXT HELPER
   ========================================================= */

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

/* =========================================================
   AUTH STATE
   ========================================================= */

async function initializeApp() {
  showLoading();

  const configured =
    initializeSupabase();

  if (!configured) {
    renderLoginPage(
      "Supabase connection needs to be configured in app.js."
    );

    return;
  }

  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();

  state.session = session;
  state.user = session?.user || null;

  if (!state.user) {
    renderLoginPage();
    return;
  }

  await loadProfile();

  renderApp();

  await loadHomepageData();

  supabaseClient.auth.onAuthStateChange(
    async (_event, session) => {

      state.session = session;
      state.user = session?.user || null;

      if (!state.user) {
        state.profile = null;
        renderLoginPage();
        return;
      }

      await loadProfile();

      renderApp();

      await loadHomepageData();
    }
  );
}

/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);