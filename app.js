/* =========================================================
   STUDENTHUB
   Main Application
   ========================================================= */

/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://csmizeuuywlonuysktka.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {
  session: null,
  user: null,
  profile: null,

  currentPage: "home",

  studyToolsOpen: false,
  accountMenuOpen: false,
  mobileMenuOpen: false,

  academicSummary: null,
  latestScore: null,

  feedPosts: [],
  activeUsers: [],

  tracker: {
    classes: [],
    chapters: [],
    scores: [],
    selectedClassId: "",
    editingScoreId: null,
    loading: false,
    message: "",
    messageType: ""
  }
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}


function getDisplayName() {
  if (state.profile) {
    return (
      state.profile.display_name ||
      state.profile.full_name ||
      state.profile.name ||
      state.user?.email?.split("@")[0] ||
      "Student"
    );
  }

  return state.user?.email?.split("@")[0] || "Student";
}


function getInitials(name) {
  if (!name) return "S";

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


function setText(selector, value) {
  const element = document.querySelector(selector);

  if (element) {
    element.textContent = value;
  }
}


function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}


function formatDateTime(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}


function getLetterGrade(score) {
  const numericScore = Number(score);

  if (numericScore >= 90) return "A";
  if (numericScore >= 80) return "B";
  if (numericScore >= 70) return "C";
  if (numericScore >= 60) return "D";

  return "F";
}


function getGradeClass(score) {
  const grade = getLetterGrade(score);

  return `grade-${grade.toLowerCase()}`;
}


function calculateAverage(scores) {
  const validScores = scores
    .map(score => Number(score.score))
    .filter(score => !Number.isNaN(score));

  if (!validScores.length) {
    return null;
  }

  const total = validScores.reduce(
    (sum, score) => sum + score,
    0
  );

  return total / validScores.length;
}


function showTrackerMessage(message, type = "success") {
  state.tracker.message = message;
  state.tracker.messageType = type;

  renderCurrentPage();
}


function clearTrackerMessage() {
  state.tracker.message = "";
  state.tracker.messageType = "";
}


/* =========================================================
   LOGIN PAGE
   ========================================================= */

function renderLogin() {
  return `
    <div class="login-page">
      <div class="login-card">

        <div class="login-logo">
          <div class="login-logo-icon">✚</div>
          <div>
            <h1>StudentHub</h1>
            <p>Your CNA class hub</p>
          </div>
        </div>

        <div class="login-header">
          <h2>Welcome back</h2>
          <p>Sign in to continue to StudentHub.</p>
        </div>

        <form id="login-form">

          <div class="form-group">
            <label for="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>

          <div id="login-message" class="form-message"></div>

          <button
            type="submit"
            class="primary-button full-width"
          >
            Sign In
          </button>

          <button
            type="button"
            id="forgot-password-button"
            class="text-button"
          >
            Forgot password?
          </button>

        </form>

      </div>
    </div>
  `;
}


async function handleLogin(event) {
  event.preventDefault();

  const email = document
    .getElementById("login-email")
    ?.value
    .trim();

  const password = document
    .getElementById("login-password")
    ?.value;

  const message = document.getElementById("login-message");

  if (!email || !password) {
    if (message) {
      message.textContent =
        "Please enter your email and password.";
    }

    return;
  }

  if (message) {
    message.textContent = "Signing in...";
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (message) {
      message.textContent = error.message;
    }

    return;
  }
}


async function handleForgotPassword() {
  const email = document
    .getElementById("login-email")
    ?.value
    .trim();

  const message = document.getElementById("login-message");

  if (!email) {
    if (message) {
      message.textContent =
        "Enter your email address first.";
    }

    return;
  }

  if (message) {
    message.textContent =
      "Sending password reset email...";
  }

  const { error } =
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

  if (error) {
    if (message) {
      message.textContent = error.message;
    }

    return;
  }

  if (message) {
    message.textContent =
      "Check your email for the password reset link.";
  }
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (!state.user) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (!error) {
    state.profile = data;
  }
}


/* =========================================================
   APP SHELL
   ========================================================= */

function renderApp() {
  document.getElementById("app").innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div class="main-area">

        ${renderTopbar()}

        <main
          id="page-content"
          class="page-content"
        >
          ${renderCurrentPage()}
        </main>

      </div>

    </div>
  `;

  attachAppListeners();
}


function renderSidebar() {
  return `
    <aside
      id="sidebar"
      class="sidebar ${
        state.mobileMenuOpen ? "mobile-open" : ""
      }"
    >

      <div class="sidebar-brand">
        <div class="brand-icon">✚</div>

        <div>
          <div class="brand-name">StudentHub</div>
          <div class="brand-subtitle">CNA Class Hub</div>
        </div>
      </div>

      <nav class="sidebar-nav">

        <button
          class="nav-item ${
            state.currentPage === "home" ? "active" : ""
          }"
          data-nav="home"
        >
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "calendar" ? "active" : ""
          }"
          data-nav="calendar"
        >
          <span class="nav-icon">📅</span>
          <span>Calendar</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "care-team" ? "active" : ""
          }"
          data-nav="care-team"
        >
          <span class="nav-icon">💬</span>
          <span>The Care Team</span>
        </button>

        <button
          class="nav-item study-tools-toggle"
          id="study-tools-toggle"
        >
          <span class="nav-icon">📚</span>
          <span>Study Tools</span>
          <span class="nav-chevron">
            ${state.studyToolsOpen ? "▾" : "▸"}
          </span>
        </button>

        ${
          state.studyToolsOpen
            ? `
              <div class="submenu">

                <button
                  class="submenu-item ${
                    state.currentPage === "flashcards"
                      ? "active"
                      : ""
                  }"
                  data-nav="flashcards"
                >
                  🧠 Flashcards
                </button>

                <button
                  class="submenu-item ${
                    state.currentPage === "quiz-maker"
                      ? "active"
                      : ""
                  }"
                  data-nav="quiz-maker"
                >
                  📝 Quiz Maker
                </button>

                <button
                  class="submenu-item ${
                    state.currentPage === "study-timer"
                      ? "active"
                      : ""
                  }"
                  data-nav="study-timer"
                >
                  ⏱️ Study Timer
                </button>

                <button
                  class="submenu-item ${
                    state.currentPage === "study-checklist"
                      ? "active"
                      : ""
                  }"
                  data-nav="study-checklist"
                >
                  ✅ Study Checklist
                </button>

                <button
                  class="submenu-item ${
                    state.currentPage === "chapter-tracker"
                      ? "active"
                      : ""
                  }"
                  data-nav="chapter-tracker"
                >
                  📖 Chapter Tracker
                </button>

              </div>
            `
            : ""
        }

        <button
          class="nav-item ${
            state.currentPage === "progress" ? "active" : ""
          }"
          data-nav="progress"
        >
          <span class="nav-icon">📈</span>
          <span>Progress</span>
        </button>

      </nav>

      <div class="sidebar-footer">

        <button
          class="nav-item"
          data-nav="account"
        >
          <span class="nav-icon">👤</span>
          <span>Account</span>
        </button>

      </div>

    </aside>

    ${
      state.mobileMenuOpen
        ? `<div id="sidebar-overlay" class="sidebar-overlay"></div>`
        : ""
    }
  `;
}


function renderTopbar() {
  return `
    <header class="topbar">

      <div class="topbar-left">

        <button
          id="mobile-menu-button"
          class="icon-button mobile-menu-button"
          aria-label="Open menu"
        >
          ☰
        </button>

        <div class="topbar-title">
          ${getPageTitle()}
        </div>

      </div>

      <div class="topbar-actions">

        <button
          class="topbar-action"
          data-top-action="messages"
          title="Messages"
        >
          💬
          <span>Messages</span>
        </button>

        <button
          class="topbar-action"
          data-top-action="notifications"
          title="Notifications"
        >
          🔔
          <span>Notifications</span>
        </button>

        <button
          id="account-button"
          class="topbar-profile"
          title="Account"
        >
          <span class="avatar-small">
            ${escapeHtml(
              getInitials(getDisplayName())
            )}
          </span>

          <span class="topbar-profile-name">
            ${escapeHtml(getDisplayName())}
          </span>

          <span>▾</span>
        </button>

        ${
          state.accountMenuOpen
            ? renderAccountMenu()
            : ""
        }

      </div>

    </header>
  `;
}


function getPageTitle() {
  const titles = {
    home: "Home",
    calendar: "Calendar",
    "care-team": "The Care Team",
    flashcards: "Flashcards",
    "quiz-maker": "Quiz Maker",
    "study-timer": "Study Timer",
    "study-checklist": "Study Checklist",
    "chapter-tracker": "Chapter Tracker",
    progress: "Progress",
    account: "Account"
  };

  return titles[state.currentPage] || "StudentHub";
}


function renderAccountMenu() {
  return `
    <div
      id="account-menu"
      class="account-menu"
    >

      <div class="account-menu-header">
        <div class="avatar-large">
          ${escapeHtml(
            getInitials(getDisplayName())
          )}
        </div>

        <div>
          <strong>
            ${escapeHtml(getDisplayName())}
          </strong>

          <small>
            ${escapeHtml(state.user?.email || "")}
          </small>
        </div>
      </div>

      <div class="account-menu-divider"></div>

      <button data-account-action="profile">
        👤 My Profile
      </button>

      <button data-account-action="details">
        ⚙️ Account Details
      </button>

      <button data-account-action="security">
        🔐 Password & Security
      </button>

      <button data-account-action="privacy">
        🔒 Privacy
      </button>

      <button data-account-action="appearance">
        🎨 Appearance
      </button>

      <button data-account-action="export">
        📦 Export My Data
      </button>

      <div class="account-menu-divider"></div>

      <button
        class="danger-menu-item"
        data-account-action="signout"
      >
        🚪 Sign Out
      </button>

    </div>
  `;
}


/* =========================================================
   PAGE ROUTER
   ========================================================= */

function renderCurrentPage() {
  switch (state.currentPage) {

    case "home":
      return renderHome();

    case "chapter-tracker":
      return renderChapterTracker();

    case "calendar":
      return renderComingSoon(
        "📅",
        "Calendar",
        "Your class calendar is coming next."
      );

    case "care-team":
      return renderComingSoon(
        "💬",
        "The Care Team",
        "Your class messaging area is coming next."
      );

    case "flashcards":
      return renderComingSoon(
        "🧠",
        "Flashcards",
        "Create and study flashcard decks here."
      );

    case "quiz-maker":
      return renderComingSoon(
        "📝",
        "Quiz Maker",
        "Build practice quizzes here."
      );

    case "study-timer":
      return renderComingSoon(
        "⏱️",
        "Study Timer",
        "Your study timer is coming next."
      );

    case "study-checklist":
      return renderComingSoon(
        "✅",
        "Study Checklist",
        "Your study checklist is coming next."
      );

    case "progress":
      return renderComingSoon(
        "📈",
        "Progress",
        "Detailed academic analytics are coming next."
      );

    case "account":
      return renderComingSoon(
        "👤",
        "Account",
        "Account settings are coming next."
      );

    default:
      return renderHome();
  }
}


function renderComingSoon(icon, title, description) {
  return `
    <section class="page-section">

      <div class="panel empty-state-panel">

        <div class="panel-body empty-state">

          <div class="empty-state-icon">
            ${icon}
          </div>

          <h2>${escapeHtml(title)}</h2>

          <p>${escapeHtml(description)}</p>

          <span class="status-badge">
            Coming next
          </span>

        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   HOME
   ========================================================= */

function renderHome() {
  return `
    <section class="page-section">

      <div class="page-header">

        <div>
          <div class="eyebrow">
            STUDENTHUB
          </div>

          <h1>
            ${escapeHtml(getGreeting())},
            ${escapeHtml(getDisplayName())} 👋
          </h1>

          <p>
            Your CNA class. Your progress. Your community.
          </p>
        </div>

      </div>

      <div class="home-grid">

        <div class="home-left">

          ${renderStatusPanel()}

          ${renderFeedPanel()}

        </div>

        <div class="home-right">

          ${renderActivePanel()}

        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   STATUS REPORT
   ========================================================= */

function renderStatusPanel() {
  const summary = state.academicSummary;

  const average =
    summary?.overall_average !== null &&
    summary?.overall_average !== undefined
      ? `${Number(summary.overall_average).toFixed(2)}%`
      : "—";

  const gpa =
    summary?.gpa !== null &&
    summary?.gpa !== undefined
      ? Number(summary.gpa).toFixed(2)
      : "—";

  const letter =
    summary?.overall_letter_grade || "—";

  const tests =
    summary?.total_tests ??
    summary?.tests_completed ??
    0;

  const consistency =
    summary?.score_consistency !== null &&
    summary?.score_consistency !== undefined
      ? Number(summary.score_consistency).toFixed(2)
      : "—";

  return `
    <div class="panel">

      <div class="panel-header">

        <div>
          <h2>📊 Status Report</h2>
          <p>Your current academic snapshot.</p>
        </div>

        <button
          class="small-button"
          data-nav="chapter-tracker"
        >
          View Tracker
        </button>

      </div>

      <div class="panel-body">

        <div class="status-grid">

          <div class="status-item">
            <span>Overall Average</span>
            <strong>${average}</strong>
          </div>

          <div class="status-item">
            <span>GPA</span>
            <strong>${gpa}</strong>
          </div>

          <div class="status-item">
            <span>Letter Grade</span>
            <strong>${letter}</strong>
          </div>

          <div class="status-item">
            <span>Tests Completed</span>
            <strong>${tests}</strong>
          </div>

          <div class="status-item">
            <span>Score Consistency</span>
            <strong>${consistency}</strong>
          </div>

          <div class="status-item">
            <span>Latest Score</span>
            <strong>
              ${
                state.latestScore?.score !== undefined
                  ? `${state.latestScore.score}%`
                  : "—"
              }
            </strong>
          </div>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   MAIN FEED
   ========================================================= */

function renderFeedPanel() {
  return `
    <div class="panel">

      <div class="panel-header">

        <div>
          <h2>📰 Main Feed</h2>
          <p>Stay connected with your class.</p>
        </div>

      </div>

      <div class="panel-body">

        <form id="create-post-form">

          <div class="feed-compose">

            <div class="avatar-small">
              ${escapeHtml(
                getInitials(getDisplayName())
              )}
            </div>

            <textarea
              id="post-content"
              placeholder="Share something with the class..."
              rows="3"
            ></textarea>

          </div>

          <div class="feed-compose-actions">

            <span class="muted-text">
              Post to The Care Team
            </span>

            <button
              type="submit"
              class="primary-button"
            >
              Post
            </button>

          </div>

        </form>

        <div
          id="feed-posts"
          class="feed-posts"
        >
          ${
            state.feedPosts.length
              ? state.feedPosts
                  .map(renderFeedPost)
                  .join("")
              : `
                <div class="empty-feed">
                  <div>📰</div>
                  <p>
                    No posts yet. Be the first to say something!
                  </p>
                </div>
              `
          }
        </div>

      </div>

    </div>
  `;
}


function renderFeedPost(post) {
  const profile = post.profile || {};

  const name =
    profile.display_name ||
    profile.full_name ||
    "Student";

  const reactions =
    post.feed_reactions || [];

  const heartCount = reactions.filter(
    reaction =>
      reaction.reaction === "heart"
  ).length;

  const currentUserReacted =
    reactions.some(
      reaction =>
        reaction.user_id === state.user?.id &&
        reaction.reaction === "heart"
    );

  return `
    <article
      class="feed-post"
      data-post-id="${post.id}"
    >

      <div class="feed-post-header">

        <div class="avatar-small">
          ${escapeHtml(getInitials(name))}
        </div>

        <div class="feed-post-author">

          <strong>
            ${escapeHtml(name)}
          </strong>

          <span>
            ${formatDateTime(post.created_at)}
          </span>

        </div>

        ${
          post.pinned
            ? `<span class="status-badge">📌 Pinned</span>`
            : ""
        }

      </div>

      <div class="feed-post-content">
        ${escapeHtml(post.content)}
      </div>

      <div class="feed-post-actions">

        <button
          class="post-action ${
            currentUserReacted ? "active" : ""
          }"
          data-react-post="${post.id}"
        >
          <span class="reaction-heart">
            ${currentUserReacted ? "❤️" : "♡"}
          </span>

          <span class="reaction-count">
            ${heartCount || ""}
          </span>
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   ACTIVE USERS
   ========================================================= */

function renderActivePanel() {
  return `
    <div class="panel">

      <div class="panel-header">

        <div>
          <h2>🟢 Who's Active</h2>
          <p>Your classmates' current status.</p>
        </div>

      </div>

      <div class="panel-body">

        <div class="active-users">

          ${
            state.activeUsers.length
              ? state.activeUsers
                  .map(user => {

                    const profile =
                      user.profile || {};

                    const name =
                      profile.display_name ||
                      profile.full_name ||
                      "Student";

                    const status =
                      user.status || "offline";

                    return `
                      <div class="active-user">

                        <div class="avatar-small">
                          ${escapeHtml(
                            getInitials(name)
                          )}
                        </div>

                        <div class="active-user-info">

                          <strong>
                            ${escapeHtml(name)}
                          </strong>

                          <span class="presence ${status}">
                            <span class="presence-dot"></span>
                            ${escapeHtml(
                              status.charAt(0).toUpperCase() +
                              status.slice(1)
                            )}
                          </span>

                        </div>

                      </div>
                    `;
                  })
                  .join("")
              : `
                <div class="empty-state-small">
                  <div>👥</div>
                  <p>No active classmates yet.</p>
                </div>
              `
          }

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   CHAPTER TRACKER
   ========================================================= */

function renderChapterTracker() {
  const tracker = state.tracker;

  const scores = tracker.scores || [];
  const chapters = tracker.chapters || [];

  const average = calculateAverage(scores);

  const completedChapterIds = new Set(
    scores.map(score => String(score.chapter_id))
  );

  const completedCount =
    chapters.filter(chapter =>
      completedChapterIds.has(String(chapter.id))
    ).length;

  return `
    <section class="page-section">

      <div class="page-header">

        <div>
          <div class="eyebrow">
            STUDY TOOLS
          </div>

          <h1>📖 Chapter Tracker</h1>

          <p>
            Track your chapter test scores and academic progress.
          </p>
        </div>

      </div>

      ${
        tracker.message
          ? `
            <div
              class="tracker-message ${
                tracker.messageType === "error"
                  ? "error"
                  : "success"
              }"
            >
              ${escapeHtml(tracker.message)}
            </div>
          `
          : ""
      }

      <div class="tracker-summary-grid">

        <div class="panel tracker-stat-card">
          <span>Chapters Completed</span>
          <strong>
            ${completedCount} / ${chapters.length || 0}
          </strong>
        </div>

        <div class="panel tracker-stat-card">
          <span>Tests Recorded</span>
          <strong>${scores.length}</strong>
        </div>

        <div class="panel tracker-stat-card">
          <span>Current Average</span>
          <strong>
            ${
              average === null
                ? "—"
                : `${average.toFixed(2)}%`
            }
          </strong>
        </div>

      </div>

      <div class="panel">

        <div class="panel-header">

          <div>
            <h2>
              ${tracker.editingScoreId
                ? "✏️ Edit Score"
                : "➕ Add Chapter Score"}
            </h2>

            <p>
              Scores are saved to your StudentHub academic record.
            </p>
          </div>

        </div>

        <div class="panel-body">

          ${
            tracker.classes.length === 0
              ? `
                <div class="empty-state-small">
                  <div>🏫</div>
                  <h3>No classes found</h3>
                  <p>
                    You need to be enrolled in a class before
                    recording chapter scores.
                  </p>
                </div>
              `
              : `
                <form id="score-form">

                  <div class="form-grid">

                    <div class="form-group">

                      <label for="tracker-class">
                        Class
                      </label>

                      <select
                        id="tracker-class"
                        required
                      >

                        <option value="">
                          Select a class
                        </option>

                        ${tracker.classes
                          .map(classItem => `
                            <option
                              value="${classItem.id}"
                              ${
                                tracker.selectedClassId ===
                                classItem.id
                                  ? "selected"
                                  : ""
                              }
                            >
                              ${escapeHtml(classItem.name)}
                            </option>
                          `)
                          .join("")}

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

                        ${chapters
                          .map(chapter => `
                            <option
                              value="${chapter.id}"
                            >
                              Chapter
                              ${escapeHtml(
                                chapter.chapter_number
                              )}
                              —
                              ${escapeHtml(
                                chapter.title
                              )}
                            </option>
                          `)
                          .join("")}

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
                        placeholder="e.g. 94"
                        required
                      />

                    </div>


                    <div class="form-group">

                      <label for="tracker-date">
                        Test Date
                      </label>

                      <input
                        id="tracker-date"
                        type="date"
                        value="${
                          new Date()
                            .toISOString()
                            .split("T")[0]
                        }"
                        required
                      />

                    </div>

                  </div>

                  <div class="form-actions">

                    <button
                      type="submit"
                      class="primary-button"
                    >
                      ${
                        tracker.editingScoreId
                          ? "Update Score"
                          : "Add Score"
                      }
                    </button>

                    ${
                      tracker.editingScoreId
                        ? `
                          <button
                            type="button"
                            id="cancel-score-edit"
                            class="secondary-button"
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

      </div>


      <div class="panel">

        <div class="panel-header">

          <div>
            <h2>📚 Chapter Progress</h2>
            <p>
              Your recorded scores by chapter.
            </p>
          </div>

        </div>

        <div class="panel-body">

          ${
            chapters.length === 0
              ? `
                <div class="empty-state-small">
                  <div>📖</div>
                  <p>
                    No chapters have been added yet.
                  </p>
                </div>
              `
              : `
                <div class="chapter-list">

                  ${chapters
                    .map(chapter =>
                      renderChapterCard(
                        chapter,
                        scores
                      )
                    )
                    .join("")}

                </div>
              `
          }

        </div>

      </div>

    </section>
  `;
}


function renderChapterCard(chapter, scores) {
  const chapterScores = scores
    .filter(
      score =>
        String(score.chapter_id) ===
        String(chapter.id)
    )
    .sort(
      (a, b) =>
        new Date(b.test_date) -
        new Date(a.test_date)
    );

  const latest =
    chapterScores[0] || null;

  const completed =
    chapterScores.length > 0;

  return `
    <div class="chapter-card">

      <div class="chapter-card-header">

        <div>

          <div class="chapter-number">
            CHAPTER
            ${escapeHtml(
              chapter.chapter_number
            )}
          </div>

          <h3>
            ${escapeHtml(chapter.title)}
          </h3>

        </div>

        <span
          class="status-badge ${
            completed
              ? "completed"
              : "pending"
          }"
        >
          ${
            completed
              ? "✓ Completed"
              : "Pending"
          }
        </span>

      </div>


      ${
        latest
          ? `
            <div class="chapter-latest">

              <div class="chapter-score-main">

                <strong>
                  ${Number(latest.score).toFixed(2)}%
                </strong>

                <span
                  class="grade-pill ${getGradeClass(
                    latest.score
                  )}"
                >
                  ${getLetterGrade(latest.score)}
                </span>

              </div>

              <div class="chapter-test-date">
                Tested ${formatDate(latest.test_date)}
              </div>

            </div>
          `
          : `
            <div class="chapter-pending">
              No score recorded yet.
            </div>
          `
      }


      ${
        chapterScores.length
          ? `
            <div class="score-history">

              <div class="score-history-title">
                Score History
              </div>

              ${chapterScores
                .map(score => `
                  <div
                    class="score-history-row"
                    data-score-row="${score.id}"
                  >

                    <div class="score-history-info">

                      <strong>
                        ${Number(score.score).toFixed(2)}%
                      </strong>

                      <span
                        class="grade-pill ${getGradeClass(
                          score.score
                        )}"
                      >
                        ${getLetterGrade(score.score)}
                      </span>

                      <span>
                        ${formatDate(
                          score.test_date
                        )}
                      </span>

                    </div>

                    <div class="score-history-actions">

                      <button
                        class="small-button"
                        data-edit-score="${score.id}"
                      >
                        Edit
                      </button>

                      <button
                        class="small-button danger-button"
                        data-delete-score="${score.id}"
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                `)
                .join("")}

            </div>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   CHAPTER TRACKER DATA
   ========================================================= */

async function loadTrackerClasses() {
  if (!state.user) return;

  const { data: enrollments, error } =
    await supabase
      .from("enrollments")
      .select("class_id, role")
      .eq("student_id", state.user.id);

  if (error) {
    console.error(
      "Unable to load enrollments:",
      error
    );

    state.tracker.classes = [];
    return;
  }

  const classIds = [
    ...new Set(
      (enrollments || [])
        .map(row => row.class_id)
        .filter(Boolean)
    )
  ];

  if (!classIds.length) {
    state.tracker.classes = [];
    return;
  }

  const { data: classes, error: classError } =
    await supabase
      .from("classes")
      .select("id, name, invite_code")
      .in("id", classIds)
      .order("name");

  if (classError) {
    console.error(
      "Unable to load classes:",
      classError
    );

    state.tracker.classes = [];
    return;
  }

  state.tracker.classes = classes || [];

  if (
    !state.tracker.selectedClassId &&
    state.tracker.classes.length
  ) {
    state.tracker.selectedClassId =
      state.tracker.classes[0].id;
  }
}


async function loadTrackerChapters() {
  const { data, error } =
    await supabase
      .from("chapters")
      .select("*")
      .order("chapter_number", {
        ascending: true
      });

  if (error) {
    console.error(
      "Unable to load chapters:",
      error
    );

    state.tracker.chapters = [];
    return;
  }

  state.tracker.chapters = data || [];
}


async function loadTrackerScores() {
  if (!state.user) return;

  if (!state.tracker.selectedClassId) {
    state.tracker.scores = [];
    return;
  }

  const { data, error } =
    await supabase
      .from("scores")
      .select("*")
      .eq("user_id", state.user.id)
      .eq(
        "class_id",
        state.tracker.selectedClassId
      )
      .order("test_date", {
        ascending: false
      })
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(
      "Unable to load scores:",
      error
    );

    state.tracker.scores = [];
    return;
  }

  state.tracker.scores = data || [];
}


async function loadChapterTracker() {
  state.tracker.loading = true;

  await loadTrackerClasses();
  await loadTrackerChapters();
  await loadTrackerScores();

  state.tracker.loading = false;

  renderCurrentPage();
}


/* =========================================================
   ADD / EDIT SCORE
   ========================================================= */

async function handleScoreSubmit(event) {
  event.preventDefault();

  const classId =
    document.getElementById("tracker-class")?.value;

  const chapterId =
    document.getElementById("tracker-chapter")?.value;

  const scoreValue =
    document.getElementById("tracker-score")?.value;

  const testDate =
    document.getElementById("tracker-date")?.value;

  if (!classId || !chapterId || !scoreValue || !testDate) {
    showTrackerMessage(
      "Please complete all score fields.",
      "error"
    );

    return;
  }

  const numericScore = Number(scoreValue);

  if (
    Number.isNaN(numericScore) ||
    numericScore < 0 ||
    numericScore > 100
  ) {
    showTrackerMessage(
      "Score must be between 0 and 100.",
      "error"
    );

    return;
  }

  state.tracker.selectedClassId = classId;

  let result;

  if (state.tracker.editingScoreId) {

    result = await supabase
      .from("scores")
      .update({
        class_id: classId,
        chapter_id: Number(chapterId),
        score: numericScore,
        test_date: testDate,
        updated_at: new Date().toISOString()
      })
      .eq(
        "id",
        state.tracker.editingScoreId
      )
      .eq(
        "user_id",
        state.user.id
      );

  } else {

    result = await supabase
      .from("scores")
      .insert({
        user_id: state.user.id,
        class_id: classId,
        chapter_id: Number(chapterId),
        score: numericScore,
        test_date: testDate
      });

  }

  if (result.error) {
    console.error(
      "Score save error:",
      result.error
    );

    showTrackerMessage(
      result.error.message ||
        "Unable to save score.",
      "error"
    );

    return;
  }

  state.tracker.editingScoreId = null;

  state.tracker.message =
    state.tracker.editingScoreId
      ? "Score updated successfully."
      : "Score saved successfully.";

  state.tracker.messageType = "success";

  await loadTrackerScores();

  await refreshAcademicData();

  renderApp();
}


/* =========================================================
   EDIT SCORE
   ========================================================= */

function beginEditScore(scoreId) {
  const score = state.tracker.scores.find(
    item => String(item.id) === String(scoreId)
  );

  if (!score) return;

  state.tracker.editingScoreId = score.id;
  state.tracker.selectedClassId = score.class_id;

  clearTrackerMessage();

  renderCurrentPage();

  requestAnimationFrame(() => {

    const chapterInput =
      document.getElementById(
        "tracker-chapter"
      );

    const scoreInput =
      document.getElementById(
        "tracker-score"
      );

    const dateInput =
      document.getElementById(
        "tracker-date"
      );

    if (chapterInput) {
      chapterInput.value =
        score.chapter_id;
    }

    if (scoreInput) {
      scoreInput.value =
        score.score;
    }

    if (dateInput) {
      dateInput.value =
        score.test_date;
    }

    document
      .getElementById("tracker-score")
      ?.focus();
  });
}


/* =========================================================
   DELETE SCORE
   ========================================================= */

async function deleteScore(scoreId) {
  const score =
    state.tracker.scores.find(
      item =>
        String(item.id) ===
        String(scoreId)
    );

  if (!score) return;

  const confirmed = window.confirm(
    "Delete this score? This cannot be undone."
  );

  if (!confirmed) return;

  const { error } =
    await supabase
      .from("scores")
      .delete()
      .eq("id", scoreId)
      .eq("user_id", state.user.id);

  if (error) {
    console.error(
      "Score delete error:",
      error
    );

    showTrackerMessage(
      error.message ||
        "Unable to delete score.",
      "error"
    );

    return;
  }

  state.tracker.editingScoreId = null;

  state.tracker.message =
    "Score deleted successfully.";

  state.tracker.messageType =
    "success";

  await loadTrackerScores();

  await refreshAcademicData();

  renderApp();
}


/* =========================================================
   CANCEL EDIT
   ========================================================= */

function cancelScoreEdit() {
  state.tracker.editingScoreId = null;
  clearTrackerMessage();

  renderCurrentPage();
}


/* =========================================================
   FEED
   ========================================================= */

async function loadFeed() {
  const { data, error } =
    await supabase
      .from("feed_posts")
      .select(`
        *,
        feed_reactions (
          id,
          user_id,
          reaction
        )
      `)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(
      "Unable to load feed:",
      error
    );

    state.feedPosts = [];
    return;
  }

  const posts = data || [];

  const userIds = [
    ...new Set(
      posts.map(post => post.user_id)
    )
  ];

  if (userIds.length) {
    const { data: profiles } =
      await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

    const profileMap = {};

    (profiles || []).forEach(profile => {
      profileMap[profile.id] = profile;
    });

    posts.forEach(post => {
      post.profile =
        profileMap[post.user_id] || null;
    });
  }

  state.feedPosts = posts;
}


async function togglePostReaction(postId) {
  if (!state.user) return;

  const post =
    state.feedPosts.find(
      item => item.id === postId
    );

  if (!post) return;

  const reactions =
    post.feed_reactions || [];

  const existing =
    reactions.find(
      reaction =>
        reaction.user_id === state.user.id &&
        reaction.reaction === "heart"
    );

  if (existing) {

    const { error } =
      await supabase
        .from("feed_reactions")
        .delete()
        .eq("id", existing.id);

    if (error) {
      console.error(error);
      return;
    }

  } else {

    const { error } =
      await supabase
        .from("feed_reactions")
        .insert({
          post_id: postId,
          user_id: state.user.id,
          reaction: "heart"
        });

    if (error) {
      console.error(error);
      return;
    }
  }

  await loadFeed();

  if (state.currentPage === "home") {
    renderApp();
  }
}


async function createPost(event) {
  event.preventDefault();

  const textarea =
    document.getElementById(
      "post-content"
    );

  const content =
    textarea?.value.trim();

  if (!content) return;

  const { error } =
    await supabase
      .from("feed_posts")
      .insert({
        user_id: state.user.id,
        content
      });

  if (error) {
    console.error(
      "Unable to create post:",
      error
    );

    return;
  }

  await loadFeed();

  renderApp();
}


/* =========================================================
   ACTIVE USERS / PRESENCE
   ========================================================= */

async function updatePresence(status = "online") {
  if (!state.user) return;

  const { error } =
    await supabase
      .from("user_presence")
      .upsert({
        user_id: state.user.id,
        status,
        last_seen_at:
          new Date().toISOString()
      });

  if (error) {
    console.error(
      "Presence update error:",
      error
    );
  }
}


async function loadActiveUsers() {
  const { data, error } =
    await supabase
      .from("user_presence")
      .select("*")
      .order("status", {
        ascending: true
      })
      .limit(20);

  if (error) {
    console.error(
      "Unable to load active users:",
      error
    );

    state.activeUsers = [];
    return;
  }

  const users = data || [];

  const userIds = [
    ...new Set(
      users.map(user => user.user_id)
    )
  ];

  if (!userIds.length) {
    state.activeUsers = [];
    return;
  }

  const { data: profiles } =
    await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

  const profileMap = {};

  (profiles || []).forEach(profile => {
    profileMap[profile.id] = profile;
  });

  state.activeUsers = users.map(user => ({
    ...user,
    profile:
      profileMap[user.user_id] || null
  }));
}


/* =========================================================
   ACADEMIC DATA
   ========================================================= */

async function loadAcademicSummary() {
  if (!state.user) return;

  const { data, error } =
    await supabase
      .from("student_academic_summary")
      .select("*")
      .eq("user_id", state.user.id)
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load academic summary:",
      error
    );

    state.academicSummary = null;
    return;
  }

  state.academicSummary = data;
}


async function loadLatestScore() {
  if (!state.user) return;

  const { data, error } =
    await supabase
      .from("scores")
      .select(`
        *,
        chapters (
          chapter_number,
          title
        )
      `)
      .eq("user_id", state.user.id)
      .order("test_date", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load latest score:",
      error
    );

    state.latestScore = null;
    return;
  }

  state.latestScore = data;
}


async function refreshAcademicData() {
  await Promise.all([
    loadAcademicSummary(),
    loadLatestScore()
  ]);
}


async function loadHomepageData() {
  await Promise.all([
    loadFeed(),
    loadActiveUsers(),
    loadAcademicSummary(),
    loadLatestScore()
  ]);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

async function navigateTo(page) {
  state.currentPage = page;
  state.mobileMenuOpen = false;
  state.accountMenuOpen = false;

  renderApp();

  if (page === "home") {
    await loadHomepageData();
    renderApp();
    return;
  }

  if (page === "chapter-tracker") {
    await loadChapterTracker();
    return;
  }
}


function toggleStudyTools() {
  state.studyToolsOpen =
    !state.studyToolsOpen;

  renderApp();
}


function toggleAccountMenu() {
  state.accountMenuOpen =
    !state.accountMenuOpen;

  renderApp();
}


function toggleMobileMenu() {
  state.mobileMenuOpen =
    !state.mobileMenuOpen;

  renderApp();
}


/* =========================================================
   TOPBAR ACTIONS
   ========================================================= */

function handleTopbarAction(action) {
  if (action === "messages") {
    navigateTo("care-team");
    return;
  }

  if (action === "notifications") {
    window.alert(
      "Notifications will be connected next."
    );
  }
}


async function handleAccountAction(action) {

  switch (action) {

    case "signout":
      await signOut();
      break;

    case "profile":
      state.accountMenuOpen = false;
      navigateTo("account");
      break;

    case "details":
    case "security":
    case "privacy":
    case "appearance":
    case "export":
      window.alert(
        "This account feature will be connected next."
      );
      break;
  }
}


/* =========================================================
   SIGN OUT
   ========================================================= */

async function signOut() {
  await updatePresence("offline");

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    console.error(
      "Sign out error:",
      error
    );
  }
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function attachAppListeners() {

  /* Sidebar navigation */

  document
    .querySelectorAll("[data-nav]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.nav;

          navigateTo(page);
        }
      );
    });


  /* Study tools */

  document
    .getElementById(
      "study-tools-toggle"
    )
    ?.addEventListener(
      "click",
      toggleStudyTools
    );


  /* Mobile menu */

  document
    .getElementById(
      "mobile-menu-button"
    )
    ?.addEventListener(
      "click",
      toggleMobileMenu
    );


  document
    .getElementById(
      "sidebar-overlay"
    )
    ?.addEventListener(
      "click",
      () => {
        state.mobileMenuOpen = false;
        renderApp();
      }
    );


  /* Account menu */

  document
    .getElementById(
      "account-button"
    )
    ?.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        toggleAccountMenu();
      }
    );


  document
    .querySelectorAll(
      "[data-account-action]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          handleAccountAction(
            button.dataset.accountAction
          );
        }
      );
    });


  /* Topbar */

  document
    .querySelectorAll(
      "[data-top-action]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          handleTopbarAction(
            button.dataset.topAction
          );
        }
      );
    });


  /* Feed */

  document
    .getElementById(
      "create-post-form"
    )
    ?.addEventListener(
      "submit",
      createPost
    );


  document
    .querySelectorAll(
      "[data-react-post]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          togglePostReaction(
            button.dataset.reactPost
          );
        }
      );
    });


  /* Chapter Tracker */

  document
    .getElementById(
      "score-form"
    )
    ?.addEventListener(
      "submit",
      handleScoreSubmit
    );


  document
    .getElementById(
      "cancel-score-edit"
    )
    ?.addEventListener(
      "click",
      cancelScoreEdit
    );


  document
    .querySelectorAll(
      "[data-edit-score]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          beginEditScore(
            button.dataset.editScore
          );
        }
      );
    });


  document
    .querySelectorAll(
      "[data-delete-score]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteScore(
            button.dataset.deleteScore
          );
        }
      );
    });


  /* Tracker class selection */

  document
    .getElementById(
      "tracker-class"
    )
    ?.addEventListener(
      "change",
      async event => {

        state.tracker.selectedClassId =
          event.target.value;

        state.tracker.editingScoreId =
          null;

        clearTrackerMessage();

        await loadTrackerScores();

        renderCurrentPage();
      }
    );
}


/* =========================================================
   AUTH LISTENER
   ========================================================= */

function setupAuthListener() {

  supabase.auth.onAuthStateChange(
    async (_event, session) => {

      state.session = session;
      state.user = session?.user || null;

      if (!state.user) {

        state.profile = null;

        document.getElementById(
          "app"
        ).innerHTML = renderLogin();

        attachLoginListeners();

        return;
      }

      await loadProfile();

      await updatePresence("online");

      state.currentPage = "home";

      await loadHomepageData();

      renderApp();
    }
  );
}


/* =========================================================
   LOGIN LISTENERS
   ========================================================= */

function attachLoginListeners() {

  document
    .getElementById(
      "login-form"
    )
    ?.addEventListener(
      "submit",
      handleLogin
    );


  document
    .getElementById(
      "forgot-password-button"
    )
    ?.addEventListener(
      "click",
      handleForgotPassword
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeApp() {

  const {
    data: {
      session
    }
  } =
    await supabase.auth.getSession();

  state.session = session;
  state.user = session?.user || null;

  if (!state.user) {

    document.getElementById(
      "app"
    ).innerHTML = renderLogin();

    attachLoginListeners();

    setupAuthListener();

    return;
  }

  await loadProfile();

  await updatePresence("online");

  state.currentPage = "home";

  await loadHomepageData();

  renderApp();

  setupAuthListener();
}


/* =========================================================
   PRESENCE CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (state.user) {
      updatePresence("offline");
    }

  }
);


/* =========================================================
   START STUDENTHUB
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);