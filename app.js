/* =========================================================
   STUDENTHUB — APP ENGINE
   ========================================================= */

const SUPABASE_URL =
  "https://csmizeuuywlonuysktka.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";

/* =========================================================
   SUPABASE
   ========================================================= */

let supabaseClient = null;

function initializeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
  mobileMenuOpen: false,

  /* Chapter Tracker state */
  trackerClasses: [],
  trackerChapters: [],
  trackerScores: [],
  trackerSelectedClassId: "",
  trackerEditingScoreId: null
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

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

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

  if (!parts.length) return "?";

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTestDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getLetterGrade(score) {
  const number = Number(score);

  if (Number.isNaN(number)) return "—";

  if (number >= 90) return "A";
  if (number >= 80) return "B";
  if (number >= 70) return "C";
  if (number >= 60) return "D";

  return "F";
}

function getGradeClass(score) {
  const grade = getLetterGrade(score);

  if (grade === "A") return "grade-a";
  if (grade === "B") return "grade-b";
  if (grade === "C") return "grade-c";
  if (grade === "D") return "grade-d";
  if (grade === "F") return "grade-f";

  return "";
}

/* =========================================================
   LOADING
   ========================================================= */

function showLoading() {
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
    </div>
  `;
}

/* =========================================================
   LOGIN PAGE
   ========================================================= */

function renderLoginPage(message = "") {
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
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
    ?.addEventListener(
      "submit",
      handleLogin
    );
}

/* =========================================================
   LOGIN
   ========================================================= */

async function handleLogin(event) {
  event.preventDefault();

  const email =
    document.getElementById("login-email")
      ?.value
      .trim();

  const password =
    document.getElementById("login-password")
      ?.value;

  const message =
    document.getElementById("auth-message");

  if (!message) return;

  try {
    if (!supabaseClient) {
      message.textContent =
        "Supabase is not configured yet.";

      return;
    }

    message.textContent = "Signing in...";

    const {
      data,
      error
    } =
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

    message.textContent =
      "Login successful. Loading StudentHub...";

    await loadProfile();

    renderApp();

    await loadHomepageData();

  } catch (error) {

    console.error(
      "StudentHub login error:",
      error
    );

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

  const {
    data,
    error
  } =
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
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div
        id="mobile-overlay"
        class="mobile-overlay"
      ></div>

      <main class="main-area">

        ${renderTopbar()}

        <section id="page-content">
          ${renderCurrentPage()}
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

  if (state.currentPage === "home") {
    loadHomepageData();
  }

  if (state.currentPage === "chapter-tracker") {
    loadChapterTracker();
  }
}

/* =========================================================
   PAGE ROUTER
   ========================================================= */

function renderCurrentPage() {

  switch (state.currentPage) {

    case "chapter-tracker":
      return renderChapterTracker();

    case "calendar":
      return renderComingSoonPage(
        "📅",
        "Calendar",
        "Your class and personal calendar will live here."
      );

    case "care-team":
      return renderComingSoonPage(
        "💬",
        "The Care Team",
        "Your class messaging system will live here."
      );

    case "flashcards":
      return renderComingSoonPage(
        "🧠",
        "Flashcards",
        "Your flashcard decks will live here."
      );

    case "quiz-maker":
      return renderComingSoonPage(
        "📝",
        "Quiz Maker",
        "Your custom quizzes will live here."
      );

    case "study-timer":
      return renderComingSoonPage(
        "⏱️",
        "Study Timer",
        "Your study timer will live here."
      );

    case "study-checklist":
      return renderComingSoonPage(
        "✅",
        "Study Checklist",
        "Your study checklist will live here."
      );

    case "progress":
      return renderComingSoonPage(
        "📈",
        "Progress",
        "Detailed academic analytics will live here."
      );

    case "home":
    default:
      return renderHome();
  }
}

/* =========================================================
   COMING SOON
   ========================================================= */

function renderComingSoonPage(
  icon,
  title,
  description
) {

  return `
    <div class="page">

      <section class="panel">

        <div class="panel-header">
          <h2>
            ${icon} ${escapeHtml(title)}
          </h2>
        </div>

        <div class="panel-body">

          <div class="empty-state">

            <div class="empty-state-icon">
              ${icon}
            </div>

            <strong>
              ${escapeHtml(title)}
            </strong>

            <span>
              ${escapeHtml(description)}
            </span>

          </div>

        </div>

      </section>

    </div>
  `;
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  return `
    <aside
      id="sidebar"
      class="sidebar ${
        state.mobileMenuOpen
          ? "open"
          : ""
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
          type="button"
        >
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "calendar"
              ? "active"
              : ""
          }"
          data-page="calendar"
          type="button"
        >
          <span class="nav-icon">📅</span>
          <span>Calendar</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "care-team"
              ? "active"
              : ""
          }"
          data-page="care-team"
          type="button"
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
          type="button"
        >

          <span class="study-toggle-left">
            <span class="nav-icon">📚</span>
            <span>Study Tools</span>
          </span>

          <span
            class="study-arrow ${
              state.studyToolsOpen
                ? "open"
                : ""
            }"
          >
            ▼
          </span>

        </button>

        <div
          class="study-submenu ${
            state.studyToolsOpen
              ? "open"
              : ""
          }"
        >

          <button
            class="subnav-item"
            data-page="flashcards"
            type="button"
          >
            🧠 Flashcards
          </button>

          <button
            class="subnav-item"
            data-page="quiz-maker"
            type="button"
          >
            📝 Quiz Maker
          </button>

          <button
            class="subnav-item"
            data-page="study-timer"
            type="button"
          >
            ⏱️ Study Timer
          </button>

          <button
            class="subnav-item"
            data-page="study-checklist"
            type="button"
          >
            ✅ Study Checklist
          </button>

          <button
            class="subnav-item ${
              state.currentPage === "chapter-tracker"
                ? "active"
                : ""
            }"
            data-page="chapter-tracker"
            type="button"
          >
            📖 Chapter Tracker
          </button>

        </div>

      </div>

      <div class="sidebar-section">

        <button
          class="nav-item ${
            state.currentPage === "progress"
              ? "active"
              : ""
          }"
          data-page="progress"
          type="button"
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
        type="button"
      >
        ☰
      </button>

      <div class="topbar-actions">

        <button
          id="account-button"
          class="topbar-button"
          title="Account"
          type="button"
        >
          👤
        </button>

        <button
          id="messages-button"
          class="topbar-button"
          title="Messages"
          type="button"
        >
          💬
        </button>

        <button
          id="notifications-button"
          class="topbar-button"
          title="Notifications"
          type="button"
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
        type="button"
      >
        👤 My Profile
      </button>

      <button
        class="account-menu-item"
        data-account="details"
        type="button"
      >
        ⚙️ Account Details
      </button>

      <button
        class="account-menu-item"
        data-account="security"
        type="button"
      >
        🔐 Password & Security
      </button>

      <button
        class="account-menu-item"
        data-account="privacy"
        type="button"
      >
        🛡️ Privacy
      </button>

      <button
        class="account-menu-item"
        data-account="appearance"
        type="button"
      >
        🎨 Appearance
      </button>

      <button
        class="account-menu-item"
        data-account="export"
        type="button"
      >
        📦 Export My Data
      </button>

      <div class="account-menu-divider"></div>

      <button
        id="sign-out-button"
        class="account-menu-item"
        type="button"
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
   CHAPTER TRACKER
   ========================================================= */

function renderChapterTracker() {

  const selectedClass =
    state.trackerClasses.find(
      (item) =>
        item.id ===
        state.trackerSelectedClassId
    );

  const classOptions =
    state.trackerClasses
      .map(
        (item) => `
          <option
            value="${escapeHtml(item.id)}"
            ${
              item.id ===
              state.trackerSelectedClassId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(item.name)}
          </option>
        `
      )
      .join("");

  const editingScore =
    state.trackerScores.find(
      (score) =>
        score.id ===
        state.trackerEditingScoreId
    );

  const chapterOptions =
    state.trackerChapters
      .map(
        (chapter) => `
          <option
            value="${escapeHtml(
              chapter.id
            )}"
            ${
              editingScore &&
              String(
                editingScore.chapter_id
              ) ===
                String(chapter.id)
                ? "selected"
                : ""
            }
          >
            Chapter ${escapeHtml(
              chapter.chapter_number
            )}
            — ${escapeHtml(
              chapter.title
            )}
          </option>
        `
      )
      .join("");

  const scoreValue =
    editingScore?.score ??
    "";

  const dateValue =
    editingScore?.test_date ??
    "";

  const completedChapterIds =
    new Set(
      state.trackerScores.map(
        (score) =>
          String(score.chapter_id)
      )
    );

  const completedCount =
    completedChapterIds.size;

  const totalChapters =
    state.trackerChapters.length;

  const progress =
    totalChapters
      ? Math.round(
          (completedCount /
            totalChapters) *
            100
        )
      : 0;

  return `
    <div class="page">

      <section class="welcome-section">

        <h1>
          📖 Chapter Tracker
        </h1>

        <p>
          Track your chapter test scores and academic progress.
        </p>

      </section>

      <section class="panel">

        <div class="panel-header">

          <div>

            <h2>
              ${editingScore
                ? "✏️ Edit Score"
                : "➕ Add Chapter Score"}
            </h2>

            <p class="panel-subtitle">
              Scores are saved directly to your StudentHub academic record.
            </p>

          </div>

        </div>

        <div class="panel-body">

          ${
            state.trackerClasses.length === 0
              ? `
                <div class="empty-state">

                  <div class="empty-state-icon">
                    📚
                  </div>

                  <strong>
                    No class found
                  </strong>

                  <span>
                    You need to be enrolled in a class before adding scores.
                  </span>

                </div>
              `
              : `
                <form
                  id="chapter-score-form"
                  class="auth-form"
                >

                  <div class="form-group">

                    <label for="tracker-class">
                      Class
                    </label>

                    <select
                      id="tracker-class"
                      required
                    >
                      ${classOptions}
                    </select>

                  </div>

                  <div class="form-group">

                    <label for="tracker-chapter">
                      Chapter
                    </label>

                    <select
                      id="tracker-chapter"
                      required
                    >

                      <option value="">
                        Select a chapter
                      </option>

                      ${chapterOptions}

                    </select>

                  </div>

                  <div class="form-group">

                    <label for="tracker-score">
                      Score
                    </label>

                    <input
                      id="tracker-score"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value="${escapeHtml(
                        scoreValue
                      )}"
                      placeholder="Enter score"
                      required
                    />

                  </div>

                  <div class="form-group">

                    <label for="tracker-test-date">
                      Test Date
                    </label>

                    <input
                      id="tracker-test-date"
                      type="date"
                      value="${escapeHtml(
                        dateValue
                      )}"
                      required
                    />

                  </div>

                  <div
                    id="tracker-form-message"
                    class="auth-message"
                    aria-live="polite"
                  ></div>

                  <div
                    style="
                      display:flex;
                      gap:10px;
                      flex-wrap:wrap;
                    "
                  >

                    <button
                      type="submit"
                      class="primary-button"
                      id="save-score-button"
                    >
                      ${
                        editingScore
                          ? "Save Changes"
                          : "Add Score"
                      }
                    </button>

                    ${
                      editingScore
                        ? `
                          <button
                            type="button"
                            class="secondary-button"
                            id="cancel-edit-score"
                          >
                            Cancel
                          </button>
                        `
                        : ""
                    }

                  </div>

                </form>
              `
          }

        </div>

      </section>

      ${
        state.trackerClasses.length > 0
          ? `
            <section class="panel">

              <div class="panel-header">

                <div>

                  <h2>📊 Chapter Progress</h2>

                  <p class="panel-subtitle">
                    ${
                      selectedClass
                        ? escapeHtml(
                            selectedClass.name
                          )
                        : "Select a class"
                    }
                  </p>

                </div>

                <div class="status-value">
                  ${completedCount}/${totalChapters}
                  · ${progress}%
                </div>

              </div>

              <div class="panel-body">

                <div class="status-list">

                  ${state.trackerChapters
                    .map(
                      (chapter) => {

                        const chapterScores =
                          state.trackerScores.filter(
                            (score) =>
                              String(
                                score.chapter_id
                              ) ===
                              String(
                                chapter.id
                              )
                          );

                        const latestScore =
                          [...chapterScores]
                            .sort(
                              (
                                a,
                                b
                              ) =>
                                new Date(
                                  b.test_date ||
                                  b.created_at
                                ) -
                                new Date(
                                  a.test_date ||
                                  a.created_at
                                )
                            )[0];

                        const completed =
                          chapterScores.length >
                          0;

                        return `
                          <div
                            class="status-item"
                            style="
                              align-items:flex-start;
                              gap:16px;
                            "
                          >

                            <div
                              style="
                                flex:1;
                                min-width:0;
                              "
                            >

                              <div
                                class="status-label"
                              >
                                Chapter
                                ${escapeHtml(
                                  chapter.chapter_number
                                )}
                              </div>

                              <div
                                style="
                                  margin-top:4px;
                                  font-size:.9rem;
                                  opacity:.8;
                                "
                              >
                                ${escapeHtml(
                                  chapter.title
                                )}
                              </div>

                            </div>

                            <div
                              style="
                                text-align:right;
                                min-width:110px;
                              "
                            >

                              ${
                                completed
                                  ? `
                                    <div
                                      class="status-value"
                                    >
                                      ${Number(
                                        latestScore.score
                                      ).toFixed(
                                        0
                                      )}%

                                      <span
                                        class="${getGradeClass(
                                          latestScore.score
                                        )}"
                                      >
                                        ${getLetterGrade(
                                          latestScore.score
                                        )}
                                      </span>
                                    </div>

                                    <div
                                      style="
                                        font-size:.78rem;
                                        opacity:.7;
                                        margin-top:3px;
                                      "
                                    >
                                      ${formatTestDate(
                                        latestScore.test_date
                                      )}
                                    </div>
                                  `
                                  : `
                                    <div
                                      class="status-value"
                                      style="opacity:.65;"
                                    >
                                      Pending
                                    </div>
                                  `
                              }

                            </div>

                          </div>
                        `;
                      }
                    )
                    .join("")}

                </div>

              </div>

            </section>

            <section class="panel">

              <div class="panel-header">

                <div>

                  <h2>📝 Score History</h2>

                  <p class="panel-subtitle">
                    ${
                      selectedClass
                        ? escapeHtml(
                            selectedClass.name
                          )
                        : ""
                    }
                  </p>

                </div>

              </div>

              <div class="panel-body">

                ${
                  state.trackerScores.length === 0
                    ? `
                      <div class="empty-state">

                        <div class="empty-state-icon">
                          📝
                        </div>

                        <strong>
                          No scores yet
                        </strong>

                        <span>
                          Add your first chapter score above.
                        </span>

                      </div>
                    `
                    : `
                      <div
                        class="status-list"
                      >

                        ${[
                          ...state.trackerScores
                        ]
                          .sort(
                            (
                              a,
                              b
                            ) =>
                              new Date(
                                b.test_date ||
                                b.created_at
                              ) -
                              new Date(
                                a.test_date ||
                                a.created_at
                              )
                          )
                          .map(
                            (
                              score
                            ) => {

                              const chapter =
                                state.trackerChapters.find(
                                  (
                                    item
                                  ) =>
                                    String(
                                      item.id
                                    ) ===
                                    String(
                                      score.chapter_id
                                    )
                                );

                              return `
                                <div
                                  class="status-item"
                                  style="
                                    align-items:center;
                                    gap:12px;
                                  "
                                >

                                  <div
                                    style="
                                      flex:1;
                                      min-width:0;
                                    "
                                  >

                                    <div
                                      class="status-label"
                                    >
                                      ${
                                        chapter
                                          ? `Chapter ${escapeHtml(
                                              chapter.chapter_number
                                            )}`
                                          : "Chapter"
                                      }
                                    </div>

                                    <div
                                      style="
                                        font-size:.82rem;
                                        opacity:.7;
                                        margin-top:3px;
                                      "
                                    >
                                      ${formatTestDate(
                                        score.test_date
                                      )}
                                    </div>

                                  </div>

                                  <div
                                    class="status-value"
                                  >
                                    ${Number(
                                      score.score
                                    ).toFixed(
                                      0
                                    )}%

                                    <span
                                      class="${getGradeClass(
                                        score.score
                                      )}"
                                    >
                                      ${getLetterGrade(
                                        score.score
                                      )}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    class="small-button"
                                    data-edit-score="${escapeHtml(
                                      score.id
                                    )}"
                                  >
                                    ✏️
                                  </button>

                                  <button
                                    type="button"
                                    class="post-action danger"
                                    data-delete-score="${escapeHtml(
                                      score.id
                                    )}"
                                  >
                                    🗑️
                                  </button>

                                </div>
                              `;
                            }
                          )
                          .join("")}

                      </div>
                    `
                }

              </div>

            </section>
          `
          : ""
      }

    </div>
  `;
}

/* =========================================================
   CHAPTER TRACKER — LOAD CLASSES
   ========================================================= */

async function loadTrackerClasses() {

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    data: enrollments,
    error
  } =
    await supabaseClient
      .from("enrollments")
      .select(
        "class_id, role"
      )
      .eq(
        "student_id",
        state.user.id
      );

  if (error) {

    console.error(
      "Class enrollment loading error:",
      error
    );

    state.trackerClasses = [];

    return;
  }

  if (
    !enrollments ||
    enrollments.length === 0
  ) {

    state.trackerClasses = [];

    return;
  }

  const classIds =
    [
      ...new Set(
        enrollments
          .map(
            (item) =>
              item.class_id
          )
          .filter(Boolean)
      )
    ];

  if (!classIds.length) {

    state.trackerClasses = [];

    return;
  }

  const {
    data: classes,
    error: classesError
  } =
    await supabaseClient
      .from("classes")
      .select(
        "id, name"
      )
      .in(
        "id",
        classIds
      )
      .order(
        "name",
        {
          ascending: true
        }
      );

  if (classesError) {

    console.error(
      "Class loading error:",
      classesError
    );

    state.trackerClasses = [];

    return;
  }

  state.trackerClasses =
    classes || [];

  if (
    !state.trackerSelectedClassId &&
    state.trackerClasses.length
  ) {

    state.trackerSelectedClassId =
      state.trackerClasses[0].id;

  }
}

/* =========================================================
   CHAPTER TRACKER — LOAD CHAPTERS
   ========================================================= */

async function loadTrackerChapters() {

  if (!supabaseClient) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("chapters")
      .select(
        "id, chapter_number, title"
      )
      .order(
        "chapter_number",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(
      "Chapter loading error:",
      error
    );

    state.trackerChapters = [];

    return;
  }

  state.trackerChapters =
    data || [];
}

/* =========================================================
   CHAPTER TRACKER — LOAD SCORES
   ========================================================= */

async function loadTrackerScores() {

  if (
    !supabaseClient ||
    !state.user ||
    !state.trackerSelectedClassId
  ) {
    state.trackerScores = [];

    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("scores")
      .select(
        "id, class_id, chapter_id, score, test_date, created_at, updated_at"
      )
      .eq(
        "user_id",
        state.user.id
      )
      .eq(
        "class_id",
        state.trackerSelectedClassId
      )
      .order(
        "test_date",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(
      "Score loading error:",
      error
    );

    state.trackerScores = [];

    return;
  }

  state.trackerScores =
    data || [];
}

/* =========================================================
   CHAPTER TRACKER — LOAD EVERYTHING
   ========================================================= */

async function loadChapterTracker() {

  const content =
    document.getElementById(
      "page-content"
    );

  if (!content) {
    return;
  }

  try {

    await Promise.all([
      loadTrackerClasses(),
      loadTrackerChapters()
    ]);

    await loadTrackerScores();

    content.innerHTML =
      renderChapterTracker();

    attachChapterTrackerListeners();

  } catch (error) {

    console.error(
      "Chapter Tracker loading error:",
      error
    );

    content.innerHTML = `
      <div class="page">

        <section class="panel">

          <div class="panel-body">

            <div class="empty-state">

              <div class="empty-state-icon">
                ⚠️
              </div>

              <strong>
                Chapter Tracker couldn't load
              </strong>

              <span>
                Please refresh the page and try again.
              </span>

            </div>

          </div>

        </section>

      </div>
    `;
  }
}

/* =========================================================
   CHAPTER TRACKER — LISTENERS
   ========================================================= */

function attachChapterTrackerListeners() {

  const form =
    document.getElementById(
      "chapter-score-form"
    );

  if (form) {

    form.addEventListener(
      "submit",
      saveChapterScore
    );

  }

  const classSelect =
    document.getElementById(
      "tracker-class"
    );

  if (classSelect) {

    classSelect.addEventListener(
      "change",
      async (event) => {

        state.trackerSelectedClassId =
          event.target.value;

        state.trackerEditingScoreId =
          null;

        await loadTrackerScores();

        const content =
          document.getElementById(
            "page-content"
          );

        if (content) {

          content.innerHTML =
            renderChapterTracker();

          attachChapterTrackerListeners();

        }

      }
    );

  }

  document
    .querySelectorAll(
      "[data-edit-score]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            editChapterScore(
              button.dataset.editScore
            );

          }
        );

      }
    );

  document
    .querySelectorAll(
      "[data-delete-score]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            deleteChapterScore(
              button.dataset.deleteScore
            );

          }
        );

      }
    );

  const cancelButton =
    document.getElementById(
      "cancel-edit-score"
    );

  if (cancelButton) {

    cancelButton.addEventListener(
      "click",
      () => {

        state.trackerEditingScoreId =
          null;

        const content =
          document.getElementById(
            "page-content"
          );

        if (content) {

          content.innerHTML =
            renderChapterTracker();

          attachChapterTrackerListeners();

        }

      }
    );

  }
}

/* =========================================================
   CHAPTER TRACKER — SAVE SCORE
   ========================================================= */

async function saveChapterScore(event) {

  event.preventDefault();

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const classId =
    document.getElementById(
      "tracker-class"
    )?.value;

  const chapterId =
    document.getElementById(
      "tracker-chapter"
    )?.value;

  const scoreInput =
    document.getElementById(
      "tracker-score"
    )?.value;

  const testDate =
    document.getElementById(
      "tracker-test-date"
    )?.value;

  const message =
    document.getElementById(
      "tracker-form-message"
    );

  const button =
    document.getElementById(
      "save-score-button"
    );

  const score =
    Number(scoreInput);

  if (
    !classId ||
    !chapterId ||
    !testDate ||
    Number.isNaN(score)
  ) {

    if (message) {
      message.textContent =
        "Please complete every field.";
    }

    return;
  }

  if (
    score < 0 ||
    score > 100
  ) {

    if (message) {
      message.textContent =
        "Score must be between 0 and 100.";
    }

    return;
  }

  if (button) {

    button.disabled = true;
    button.textContent =
      state.trackerEditingScoreId
        ? "Saving..."
        : "Adding...";

  }

  try {

    let error = null;

    if (state.trackerEditingScoreId) {

      const result =
        await supabaseClient
          .from("scores")
          .update({
            class_id: classId,
            chapter_id:
              Number(chapterId),
            score,
            test_date,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            state.trackerEditingScoreId
          )
          .eq(
            "user_id",
            state.user.id
          );

      error = result.error;

    } else {

      const result =
        await supabaseClient
          .from("scores")
          .insert({
            user_id:
              state.user.id,
            class_id: classId,
            chapter_id:
              Number(chapterId),
            score,
            test_date
          });

      error = result.error;
    }

    if (error) {
      throw error;
    }

    state.trackerSelectedClassId =
      classId;

    state.trackerEditingScoreId =
      null;

    await loadTrackerScores();

    const content =
      document.getElementById(
        "page-content"
      );

    if (content) {

      content.innerHTML =
        renderChapterTracker();

      attachChapterTrackerListeners();

    }

  } catch (error) {

    console.error(
      "Score save error:",
      error
    );

    if (message) {

      message.textContent =
        "Unable to save the score: " +
        (
          error?.message ||
          "Unknown error."
        );

    }

    if (button) {

      button.disabled = false;

      button.textContent =
        state.trackerEditingScoreId
          ? "Save Changes"
          : "Add Score";

    }
  }
}

/* =========================================================
   CHAPTER TRACKER — EDIT
   ========================================================= */

function editChapterScore(scoreId) {

  const score =
    state.trackerScores.find(
      (item) =>
        String(item.id) ===
        String(scoreId)
    );

  if (!score) {
    return;
  }

  state.trackerEditingScoreId =
    score.id;

  state.trackerSelectedClassId =
    score.class_id;

  const content =
    document.getElementById(
      "page-content"
    );

  if (!content) {
    return;
  }

  content.innerHTML =
    renderChapterTracker();

  attachChapterTrackerListeners();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   CHAPTER TRACKER — DELETE
   ========================================================= */

async function deleteChapterScore(
  scoreId
) {

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const score =
    state.trackerScores.find(
      (item) =>
        String(item.id) ===
        String(scoreId)
    );

  if (!score) {
    return;
  }

  const confirmed =
    window.confirm(
      "Delete this chapter score? This cannot be undone."
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("scores")
      .delete()
      .eq(
        "id",
        scoreId
      )
      .eq(
        "user_id",
        state.user.id
      );

  if (error) {

    console.error(
      "Score deletion error:",
      error
    );

    alert(
      "Unable to delete this score."
    );

    return;
  }

  if (
    state.trackerEditingScoreId ===
    scoreId
  ) {

    state.trackerEditingScoreId =
      null;

  }

  await loadTrackerScores();

  const content =
    document.getElementById(
      "page-content"
    );

  if (content) {

    content.innerHTML =
      renderChapterTracker();

    attachChapterTrackerListeners();

  }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function attachAppListeners() {

  document
    .querySelectorAll("[data-page]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          state.currentPage =
            button.dataset.page;

          state.mobileMenuOpen =
            false;

          state.accountMenuOpen =
            false;

          renderApp();

        }
      );

    });

  const studyToggle =
    document.getElementById(
      "study-toggle"
    );

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
    document.getElementById(
      "account-button"
    );

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

        state.mobileMenuOpen =
          false;

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

  document
    .querySelectorAll("[data-react-post]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          togglePostReaction(
            button.dataset.reactPost
          );

        }
      );

    });

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

  state.currentPage =
    page;

  state.accountMenuOpen =
    false;

  state.mobileMenuOpen =
    false;

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
   FEED — LOAD
   ========================================================= */

async function loadFeed() {

  const feedList =
    document.getElementById(
      "feed-list"
    );

  if (
    !feedList ||
    !supabaseClient
  ) {
    return;
  }

  feedList.innerHTML = `
    <div class="empty-state">
      Loading feed...
    </div>
  `;

  const {
    data: posts,
    error: postsError
  } =
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

  if (postsError) {

    console.error(
      "Feed loading error:",
      postsError
    );

    feedList.innerHTML = `
      <div class="empty-state">
        Unable to load feed right now.
      </div>
    `;

    return;
  }

  if (
    !posts ||
    posts.length === 0
  ) {

    feedList.innerHTML = `
      <div class="empty-state">

        <div class="empty-state-icon">
          📰
        </div>

        <strong>
          No posts yet
        </strong>

        <span>
          Be the first to share something with the class.
        </span>

      </div>
    `;

    return;
  }

  const postIds =
    posts.map(
      (post) => post.id
    );

  const {
    data: reactions,
    error: reactionsError
  } =
    await supabaseClient
      .from("feed_reactions")
      .select(
        "post_id, user_id, reaction"
      )
      .in(
        "post_id",
        postIds
      );

  if (reactionsError) {

    console.error(
      "Reaction loading error:",
      reactionsError
    );

  }

  const reactionMap = {};

  (reactions || []).forEach(
    (reaction) => {

      if (
        !reactionMap[
          reaction.post_id
        ]
      ) {

        reactionMap[
          reaction.post_id
        ] = {
          count: 0,
          reactedByUser: false
        };

      }

      reactionMap[
        reaction.post_id
      ].count += 1;

      if (
        reaction.user_id ===
        state.user?.id
      ) {

        reactionMap[
          reaction.post_id
        ].reactedByUser = true;

      }

    }
  );

  feedList.innerHTML =
    posts
      .map((post) => {

        const isOwnPost =
          post.user_id ===
          state.user?.id;

        const name =
          isOwnPost
            ? getDisplayName()
            : "Student";

        const initials =
          getInitials(name);

        const reactionInfo =
          reactionMap[
            post.id
          ] || {
            count: 0,
            reactedByUser: false
          };

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
          post.updated_at !==
            post.created_at
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
                data-edit-post="${escapeHtml(
                  post.id
                )}"
              >
                ✏️ Edit
              </button>

              <button
                class="post-action danger"
                type="button"
                data-delete-post="${escapeHtml(
                  post.id
                )}"
              >
                🗑️ Delete
              </button>
            `
            : "";

        return `
          <article
            class="feed-post"
            data-post-id="${escapeHtml(
              post.id
            )}"
          >

            <div class="post-header">

              <div class="avatar">
                ${escapeHtml(
                  initials
                )}
              </div>

              <div class="post-author-area">

                <div class="post-user">
                  ${escapeHtml(name)}
                </div>

                <div class="post-time">
                  ${formatDate(
                    post.created_at
                  )}
                  ${editedBadge}
                </div>

              </div>

              ${pinnedBadge}

            </div>

            <div class="post-content">
              ${escapeHtml(
                post.content
              )}
            </div>

            <div class="post-actions">

              <button
                class="post-action ${
                  reactionInfo.reactedByUser
                    ? "active"
                    : ""
                }"
                type="button"
                data-react-post="${escapeHtml(
                  post.id
                )}"
                data-reaction-count="${reactionInfo.count}"
              >

                <span class="reaction-heart">
                  ❤️
                </span>

                <span class="reaction-label">
                  ${
                    reactionInfo.reactedByUser
                      ? "Reacted"
                      : "React"
                  }
                </span>

                ${
                  reactionInfo.count > 0
                    ? `
                      <span class="reaction-count">
                        ${reactionInfo.count}
                      </span>
                    `
                    : ""
                }

              </button>

              ${ownActions}

            </div>

          </article>
        `;

      })
      .join("");

  document
    .querySelectorAll(
      "[data-react-post]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          togglePostReaction(
            button.dataset.reactPost
          );

        }
      );

    });
}

/* =========================================================
   FEED — REACTION
   ========================================================= */

async function togglePostReaction(
  postId
) {

  if (
    !supabaseClient ||
    !state.user ||
    !postId
  ) {
    return;
  }

  const button =
    document.querySelector(
      `[data-react-post="${postId}"]`
    );

  if (!button) {
    return;
  }

  if (
    button.dataset.loading ===
    "true"
  ) {
    return;
  }

  button.dataset.loading =
    "true";

  const wasReacted =
    button.classList.contains(
      "active"
    );

  const {
    data: existingReaction,
    error: findError
  } =
    await supabaseClient
      .from("feed_reactions")
      .select("id")
      .eq(
        "post_id",
        postId
      )
      .eq(
        "user_id",
        state.user.id
      )
      .eq(
        "reaction",
        "heart"
      )
      .maybeSingle();

  if (findError) {

    console.error(
      "Reaction lookup error:",
      findError
    );

    button.dataset.loading =
      "false";

    return;
  }

  let success =
    false;

  if (existingReaction) {

    const {
      error
    } =
      await supabaseClient
        .from("feed_reactions")
        .delete()
        .eq(
          "id",
          existingReaction.id
        );

    if (error) {

      console.error(
        "Reaction removal error:",
        error
      );

    } else {

      success = true;

    }

  } else {

    const {
      error
    } =
      await supabaseClient
        .from("feed_reactions")
        .insert({
          post_id: postId,
          user_id:
            state.user.id,
          reaction: "heart"
        });

    if (error) {

      console.error(
        "Reaction creation error:",
        error
      );

    } else {

      success = true;

    }

  }

  if (!success) {

    button.dataset.loading =
      "false";

    return;
  }

  const currentCount =
    Number(
      button.dataset.reactionCount ||
      0
    );

  const newCount =
    existingReaction
      ? Math.max(
          0,
          currentCount - 1
        )
      : currentCount + 1;

  button.dataset.reactionCount =
    String(newCount);

  button.classList.toggle(
    "active",
    !existingReaction
  );

  button.innerHTML = `
    <span class="reaction-heart">
      ❤️
    </span>

    <span class="reaction-label">
      ${
        existingReaction
          ? "React"
          : "Reacted"
      }
    </span>

    ${
      newCount > 0
        ? `
          <span class="reaction-count">
            ${newCount}
          </span>
        `
        : ""
    }
  `;

  if (!wasReacted) {

    button.classList.add(
      "reaction-pop"
    );

    setTimeout(() => {

      button.classList.remove(
        "reaction-pop"
      );

    }, 300);

  }

  const count =
    button.querySelector(
      ".reaction-count"
    );

  if (count) {

    count.classList.remove(
      "reaction-count-pop"
    );

    void count.offsetWidth;

    count.classList.add(
      "reaction-count-pop"
    );

  }

  button.dataset.loading =
    "false";
}

/* =========================================================
   CREATE POST
   ========================================================= */

async function createPost() {

  const textarea =
    document.getElementById(
      "post-content"
    );

  if (
    !textarea ||
    !supabaseClient ||
    !state.user
  ) {
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

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Posting...";

  }

  const {
    error
  } =
    await supabaseClient
      .from("feed_posts")
      .insert({
        user_id:
          state.user.id,
        content
      });

  if (error) {

    console.error(
      "Post creation error:",
      error
    );

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Post";

    }

    alert(
      "Unable to create the post."
    );

    return;
  }

  textarea.value = "";

  if (button) {

    button.disabled =
      false;

    button.textContent =
      "Post";

  }

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

  if (
    !list ||
    !supabaseClient
  ) {
    return;
  }

  list.innerHTML = `
    <div class="empty-state">
      Loading active users...
    </div>
  `;

  const {
    data: presenceData,
    error: presenceError
  } =
    await supabaseClient
      .from("user_presence")
      .select(
        "user_id, status, last_seen_at"
      )
      .order(
        "status"
      );

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

        <div class="empty-state-icon">
          🟢
        </div>

        <strong>
          No one is showing as active yet.
        </strong>

        <span>
          Your status will appear here when presence is enabled.
        </span>

      </div>
    `;

    return;
  }

  const userIds =
    presenceData.map(
      (user) =>
        user.user_id
    );

  const {
    data: profilesData,
    error: profilesError
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, display_name"
      )
      .in(
        "id",
        userIds
      );

  if (profilesError) {

    console.error(
      "Profile loading error:",
      profilesError
    );

  }

  const profileMap = {};

  (profilesData || []).forEach(
    (profile) => {

      profileMap[
        profile.id
      ] =
        profile.display_name ||
        "Student";

    }
  );

  list.innerHTML =
    presenceData
      .map((user) => {

        const name =
          user.user_id ===
          state.user?.id
            ? getDisplayName()
            : (
                profileMap[
                  user.user_id
                ] ||
                "Student"
              );

        const status =
          user.status ||
          "offline";

        const statusText =
          status
            .charAt(0)
            .toUpperCase() +
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
                ${escapeHtml(
                  statusText
                )}
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

async function updatePresence(
  status = "online"
) {

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("user_presence")
      .upsert({
        user_id:
          state.user.id,
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
   ACADEMIC SUMMARY
   ========================================================= */

async function loadAcademicSummary() {

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "student_academic_summary"
      )
      .select("*")
      .eq(
        "user_id",
        state.user.id
      )
      .maybeSingle();

  if (error) {

    console.warn(
      "Academic summary unavailable:",
      error.message
    );

    setText(
      "status-progress",
      "—"
    );

    setText(
      "status-average",
      "—"
    );

    setText(
      "status-gpa",
      "—"
    );

    setText(
      "status-grade",
      "—"
    );

    setText(
      "status-consistency",
      "—"
    );

    setText(
      "status-tests",
      "0"
    );

    return;
  }

  if (!data) {

    setText(
      "status-progress",
      "No data"
    );

    setText(
      "status-average",
      "—"
    );

    setText(
      "status-gpa",
      "—"
    );

    setText(
      "status-grade",
      "—"
    );

    setText(
      "status-consistency",
      "—"
    );

    setText(
      "status-tests",
      "0"
    );

    return;
  }

  const average =
    data.overall_average;

  const progress =
    data.total_tests
      ? Math.min(
          100,
          Number(
            data.total_tests
          ) * 10
        )
      : 0;

  setText(
    "status-progress",
    `${progress}%`
  );

  setText(
    "status-average",
    average !== null
      ? `${Number(
          average
        ).toFixed(1)}%`
      : "—"
  );

  setText(
    "status-gpa",
    data.gpa !== null
      ? Number(
          data.gpa
        ).toFixed(2)
      : "—"
  );

  setText(
    "status-grade",
    data.overall_letter_grade ||
      "—"
  );

  setText(
    "status-consistency",
    data.score_consistency !==
      null
      ? Number(
          data.score_consistency
        ).toFixed(1)
      : "—"
  );

  setText(
    "status-tests",
    data.total_tests ??
      "0"
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

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "student_score_details"
      )
      .select("*")
      .eq(
        "user_id",
        state.user.id
      )
      .order(
        "test_date",
        {
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();

  if (error || !data) {
    return;
  }

  setText(
    "status-latest",
    data.score !== null
      ? `${Number(
          data.score
        ).toFixed(0)}%`
      : "—"
  );

  setText(
    "status-chapter",
    data.title ||
      (
        data.chapter_number
          ? `Chapter ${data.chapter_number}`
          : "—"
      )
  );
}

/* =========================================================
   HOMEPAGE DATA
   ========================================================= */

async function loadHomepageData() {

  await updatePresence(
    "online"
  );

  await Promise.all([
    loadAcademicSummary(),
    loadLatestScore(),
    loadFeed(),
    loadActiveUsers()
  ]);
}

/* =========================================================
   INITIALIZE APP
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

  state.session =
    session;

  state.user =
    session?.user ||
    null;

  if (!state.user) {

    renderLoginPage();

    setupAuthListener();

    return;
  }

  await loadProfile();

  renderApp();

  await loadHomepageData();

  setupAuthListener();
}

/* =========================================================
   AUTH LISTENER
   ========================================================= */

function setupAuthListener() {

  if (!supabaseClient) {
    return;
  }

  supabaseClient.auth.onAuthStateChange(
    async (
      _event,
      session
    ) => {

      state.session =
        session;

      state.user =
        session?.user ||
        null;

      if (!state.user) {

        state.profile =
          null;

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