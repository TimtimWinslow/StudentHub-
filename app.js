/* =========================================================
   STUDENTHUB
   Main Application
   ========================================================= */


/* =========================================================
   SUPABASE / BOOT STATE
   ========================================================= */

let supabase = null;


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
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://csmizeuuywlonuysktka.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";


/* =========================================================
   BOOT ERROR SCREEN
   ========================================================= */

function renderBootError(
  title = "StudentHub couldn't start",
  message = "Something prevented StudentHub from loading.",
  details = ""
) {
  const app =
    document.getElementById("app");

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div
      style="
        min-height:100vh;
        box-sizing:border-box;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        background:#071a2b;
        color:#f5f9fc;
        font-family:Arial,Helvetica,sans-serif;
      "
    >
      <div
        style="
          width:100%;
          max-width:560px;
          box-sizing:border-box;
          padding:28px;
          border:1px solid #1d4662;
          border-radius:16px;
          background:#102b42;
          box-shadow:0 20px 60px rgba(0,0,0,.35);
        "
      >
        <div
          style="
            width:56px;
            height:56px;
            display:flex;
            align-items:center;
            justify-content:center;
            border-radius:14px;
            background:#00a6a6;
            color:white;
            font-size:26px;
            font-weight:800;
            margin-bottom:18px;
          "
        >
          S
        </div>

        <h1
          style="
            margin:0 0 10px;
            font-size:26px;
          "
        >
          ${escapeHTML(title)}
        </h1>

        <p
          style="
            margin:0 0 18px;
            color:#a8bdcc;
            line-height:1.6;
          "
        >
          ${escapeHTML(message)}
        </p>

        ${
          details
            ? `
              <div
                style="
                  padding:14px;
                  border-radius:10px;
                  background:#071a2b;
                  border:1px solid #1d4662;
                  color:#a8bdcc;
                  font-size:13px;
                  line-height:1.5;
                  overflow-wrap:anywhere;
                  margin-bottom:18px;
                "
              >
                ${escapeHTML(details)}
              </div>
            `
            : ""
        }

        <button
          type="button"
          onclick="window.location.reload()"
          style="
            border:0;
            border-radius:10px;
            padding:12px 18px;
            background:#00a6a6;
            color:white;
            font-weight:700;
            cursor:pointer;
          "
        >
          Reload StudentHub
        </button>
      </div>
    </div>
  `;
}


function initializeSupabase() {
  try {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      renderBootError(
        "Supabase did not load",
        "StudentHub loaded, but the Supabase library did not load from the CDN.",
        "Check that the Supabase script in index.html appears before app.js and that the deployed site can reach cdn.jsdelivr.net."
      );

      return false;
    }

    supabase =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );

    if (!supabase) {
      renderBootError(
        "Supabase initialization failed",
        "StudentHub could not create its Supabase connection."
      );

      return false;
    }

    return true;

  } catch (error) {
    console.error(
      "Supabase initialization error:",
      error
    );

    renderBootError(
      "StudentHub couldn't connect",
      "The Supabase connection could not be initialized.",
      error?.message || String(error)
    );

    return false;
  }
}


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function escapeHTML(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


function formatDateTime(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );
}


function getLetterGrade(score) {
  const number =
    Number(score);

  if (number >= 90) {
    return "A";
  }

  if (number >= 80) {
    return "B";
  }

  if (number >= 70) {
    return "C";
  }

  if (number >= 60) {
    return "D";
  }

  return "F";
}


function getGradeClass(score) {
  return `grade-${getLetterGrade(score).toLowerCase()}`;
}


function getGreeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}


function getDisplayName() {
  return (
    state.profile?.display_name ||
    state.profile?.full_name ||
    state.profile?.name ||
    state.user?.email?.split("@")[0] ||
    "Student"
  );
}


function getInitials(name) {
  if (!name) {
    return "S";
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0).toUpperCase()
    )
    .join("");
}


function clearTrackerMessage() {
  state.tracker.message = "";
  state.tracker.messageType = "";
}


function showTrackerMessage(
  message,
  type = "success"
) {
  state.tracker.message =
    message;

  state.tracker.messageType =
    type;
}


function getCurrentPageTitle() {
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
    messages: "Messages",
    notifications: "Notifications",
    account: "Account"
  };

  return (
    titles[state.currentPage] ||
    "StudentHub"
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

function renderLogin() {
  const app =
    document.getElementById("app");

  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-logo">

          <div class="brand-icon">
            S
          </div>

          <div>
            <div class="brand-text">
              StudentHub
            </div>

            <div class="auth-subtitle">
              Your CNA class. One place.
            </div>
          </div>

        </div>


        <form
          id="login-form"
          class="auth-form"
        >

          <div>
            <label for="login-email">
              Email
            </label>

            <input
              id="login-email"
              type="email"
              autocomplete="email"
              placeholder="Enter your email"
              required
            />
          </div>


          <div>
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


          <button
            type="button"
            id="forgot-password"
            class="text-button"
          >
            Forgot password?
          </button>


          <div
            id="login-message"
            class="auth-message"
          ></div>

        </form>

      </div>
    </div>
  `;

  attachLoginListeners();
}


function attachLoginListeners() {
  const form =
    document.getElementById(
      "login-form"
    );

  if (form) {
    form.addEventListener(
      "submit",
      handleLogin
    );
  }

  const forgot =
    document.getElementById(
      "forgot-password"
    );

  if (forgot) {
    forgot.addEventListener(
      "click",
      handleForgotPassword
    );
  }
}


async function handleLogin(event) {
  event.preventDefault();

  if (!supabase) {
    return;
  }

  const email =
    document
      .getElementById(
        "login-email"
      )
      ?.value
      .trim();

  const password =
    document.getElementById(
      "login-password"
    )?.value;

  const message =
    document.getElementById(
      "login-message"
    );

  if (!email || !password) {
    if (message) {
      message.textContent =
        "Please enter your email and password.";
    }

    return;
  }

  if (message) {
    message.textContent =
      "Signing you in...";
  }

  try {
    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(
        "Login error:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to sign in.";
      }

      return;
    }

    state.session =
      data.session;

    state.user =
      data.user;

    await loadProfile();
    await updatePresence("online");
    await loadAcademicSummary();
    await loadLatestScore();
    await loadFeed();
    await loadActiveUsers();

    renderApp();

  } catch (error) {
    console.error(
      "Unexpected login error:",
      error
    );

    if (message) {
      message.textContent =
        error?.message ||
        "Unable to sign in.";
    }
  }
}


async function handleForgotPassword() {
  if (!supabase) {
    return;
  }

  const email =
    document
      .getElementById(
        "login-email"
      )
      ?.value
      .trim();

  const message =
    document.getElementById(
      "login-message"
    );

  if (!email) {
    if (message) {
      message.textContent =
        "Enter your email first.";
    }

    return;
  }

  try {
    const {
      error
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin
        }
      );

    if (error) {
      console.error(
        "Password reset error:",
        error
      );

      if (message) {
        message.textContent =
          error.message ||
          "Unable to send reset email.";
      }

      return;
    }

    if (message) {
      message.textContent =
        "Password reset instructions were sent to your email.";
    }

  } catch (error) {
    console.error(
      "Unexpected password reset error:",
      error
    );

    if (message) {
      message.textContent =
        error?.message ||
        "Unable to send reset email.";
    }
  }
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabase
        .from("profiles")
        .select("*")
        .eq(
          "id",
          state.user.id
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Profile loading error:",
        error
      );

      state.profile = null;
      return;
    }

    state.profile =
      data || null;

  } catch (error) {
    console.error(
      "Unexpected profile error:",
      error
    );

    state.profile = null;
  }
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  const activePage =
    state.currentPage;

  const studyPages = [
    "flashcards",
    "quiz-maker",
    "study-timer",
    "study-checklist",
    "chapter-tracker"
  ];

  const studyOpen =
    state.studyToolsOpen ||
    studyPages.includes(activePage);

  return `
    <aside
      class="sidebar ${
        state.mobileMenuOpen
          ? "open"
          : ""
      }"
    >

      <div class="sidebar-brand">

        <div class="brand-icon">
          S
        </div>

        <div class="brand-text">
          StudentHub
        </div>

      </div>


      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Main
        </div>

        <nav class="sidebar-nav">

          ${renderNavItem(
            "home",
            "🏠",
            "Home"
          )}

          ${renderNavItem(
            "calendar",
            "📅",
            "Calendar"
          )}

          ${renderNavItem(
            "care-team",
            "💬",
            "The Care Team"
          )}

        </nav>

      </div>


      <div class="sidebar-section">

        <button
          type="button"
          class="study-toggle"
        >

          <span class="study-toggle-left">

            <span class="nav-icon">
              📚
            </span>

            <span>
              Study Tools
            </span>

          </span>

          <span
            class="study-arrow ${
              studyOpen
                ? "open"
                : ""
            }"
          >
            ›
          </span>

        </button>


        <div
          class="study-submenu ${
            studyOpen
              ? "open"
              : ""
          }"
        >

          ${renderSubnavItem(
            "flashcards",
            "🧠",
            "Flashcards"
          )}

          ${renderSubnavItem(
            "quiz-maker",
            "📝",
            "Quiz Maker"
          )}

          ${renderSubnavItem(
            "study-timer",
            "⏱️",
            "Study Timer"
          )}

          ${renderSubnavItem(
            "study-checklist",
            "✅",
            "Study Checklist"
          )}

          ${renderSubnavItem(
            "chapter-tracker",
            "📖",
            "Chapter Tracker"
          )}

        </div>

      </div>


      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Academic
        </div>

        <nav class="sidebar-nav">

          ${renderNavItem(
            "progress",
            "📈",
            "Progress"
          )}

        </nav>

      </div>

    </aside>
  `;
}


function renderNavItem(
  page,
  icon,
  label
) {
  return `
    <button
      type="button"
      class="nav-item ${
        state.currentPage === page
          ? "active"
          : ""
      }"
      data-page="${page}"
    >

      <span class="nav-icon">
        ${icon}
      </span>

      <span>
        ${label}
      </span>

    </button>
  `;
}


function renderSubnavItem(
  page,
  icon,
  label
) {
  return `
    <button
      type="button"
      class="subnav-item ${
        state.currentPage === page
          ? "active"
          : ""
      }"
      data-page="${page}"
    >

      <span>
        ${icon}
      </span>

      <span>
        ${label}
      </span>

    </button>
  `;
}


/* =========================================================
   TOP BAR
   ========================================================= */

function renderTopbar() {
  const name =
    getDisplayName();

  const initials =
    getInitials(name);

  return `
    <header class="topbar">

      <button
        type="button"
        class="mobile-menu-button"
        aria-label="Open menu"
      >
        ☰
      </button>


      <div class="topbar-title">
        ${escapeHTML(
          getCurrentPageTitle()
        )}
      </div>


      <div class="topbar-actions">

        <button
          type="button"
          class="topbar-button"
          data-action="messages"
          title="Messages"
        >
          💬
        </button>


        <button
          type="button"
          class="topbar-button"
          data-action="notifications"
          title="Notifications"
        >
          🔔

          <span
            class="notification-badge"
          >
            0
          </span>
        </button>


        <button
          type="button"
          class="topbar-button account-button"
          data-action="account"
          title="Account"
        >
          <span class="avatar small">
            ${escapeHTML(initials)}
          </span>
        </button>

      </div>


      ${
        state.accountMenuOpen
          ? renderAccountMenu()
          : ""
      }

    </header>
  `;
}


/* =========================================================
   ACCOUNT MENU
   ========================================================= */

function renderAccountMenu() {
  return `
    <div class="account-menu">

      <button
        type="button"
        class="account-menu-item"
        data-account-action="profile"
      >
        👤
        <span>
          My Profile
        </span>
      </button>


      <button
        type="button"
        class="account-menu-item"
        data-account-action="details"
      >
        ⚙️
        <span>
          Account Details
        </span>
      </button>


      <button
        type="button"
        class="account-menu-item"
        data-account-action="security"
      >
        🔐
        <span>
          Password & Security
        </span>
      </button>


      <button
        type="button"
        class="account-menu-item"
        data-account-action="privacy"
      >
        🛡️
        <span>
          Privacy
        </span>
      </button>


      <button
        type="button"
        class="account-menu-item"
        data-account-action="appearance"
      >
        🎨
        <span>
          Appearance
        </span>
      </button>


      <button
        type="button"
        class="account-menu-item"
        data-account-action="export"
      >
        📦
        <span>
          Export My Data
        </span>
      </button>


      <div class="account-menu-divider"></div>


      <button
        type="button"
        class="account-menu-item danger"
        data-account-action="signout"
      >
        🚪
        <span>
          Sign Out
        </span>
      </button>

    </div>
  `;
}


/* =========================================================
   APP SHELL
   ========================================================= */

function renderApp() {
  const app =
    document.getElementById("app");

  if (!app) {
    return;
  }

  if (!state.user) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}


      ${
        state.mobileMenuOpen
          ? `
            <div
              class="mobile-overlay"
            ></div>
          `
          : ""
      }


      <div class="main-area">

        ${renderTopbar()}


        <main class="page">

          ${renderCurrentPage()}

        </main>

      </div>

    </div>
  `;

  attachAppListeners();
}


/* =========================================================
   PAGE ROUTER
   ========================================================= */

function renderCurrentPage() {
  switch (
    state.currentPage
  ) {

    case "home":
      return renderHomePage();

    case "calendar":
      return renderPlaceholderPage(
        "📅",
        "Calendar",
        "Your class calendar and important events will appear here."
      );

    case "care-team":
      return renderPlaceholderPage(
        "💬",
        "The Care Team",
        "Your class messaging space will appear here."
      );

    case "flashcards":
      return renderPlaceholderPage(
        "🧠",
        "Flashcards",
        "Create and study flashcard decks here."
      );

    case "quiz-maker":
      return renderPlaceholderPage(
        "📝",
        "Quiz Maker",
        "Build practice quizzes and track your attempts here."
      );

    case "study-timer":
      return renderPlaceholderPage(
        "⏱️",
        "Study Timer",
        "Your study timer will appear here."
      );

    case "study-checklist":
      return renderPlaceholderPage(
        "✅",
        "Study Checklist",
        "Keep track of your study tasks here."
      );

    case "chapter-tracker":
      return renderChapterTracker();

    case "progress":
      return renderProgressPage();

    case "messages":
      return renderPlaceholderPage(
        "💬",
        "Messages",
        "Your messages will appear here."
      );

    case "notifications":
      return renderPlaceholderPage(
        "🔔",
        "Notifications",
        "Your notifications will appear here."
      );

    case "account":
      return renderAccountPage();

    default:
      return renderHomePage();
  }
}


/* =========================================================
   HOME PAGE
   ========================================================= */

function renderHomePage() {
  const name =
    getDisplayName();

  return `
    <section class="welcome-section">

      <div>

        <div class="page-eyebrow">
          StudentHub
        </div>

        <h1>
          ${escapeHTML(
            getGreeting()
          )},
          ${escapeHTML(name)}
          👋
        </h1>

        <p>
          Your CNA class. Your progress.
          Your community. One place.
        </p>

      </div>

    </section>


    <section class="home-grid">

      <div class="panel">
        ${renderStatusReport()}
      </div>


      <div class="panel">
        ${renderMainFeed()}
      </div>


      <div class="panel">
        ${renderActiveUsers()}
      </div>

    </section>
  `;
}


/* =========================================================
   STATUS REPORT
   ========================================================= */

function renderStatusReport() {
  const summary =
    state.academicSummary;

  const average =
    summary?.overall_average;

  const gpa =
    summary?.gpa;

  const letter =
    summary?.overall_letter_grade;

  const consistency =
    summary?.score_consistency;

  const tests =
    summary?.total_tests || 0;

  const latest =
    state.latestScore;

  const latestScore =
    latest?.score;

  const progress =
    tests > 0
      ? Math.min(
          100,
          Math.round(
            Number(tests) * 10
          )
        )
      : 0;

  return `
    <div class="panel-header">

      <div>

        <span class="panel-kicker">
          Academic
        </span>

        <h2>
          📊 Status Report
        </h2>

      </div>

    </div>


    <div class="panel-body">

      <div class="status-list">

        <div class="status-item">

          <span class="status-label">
            Overall Average
          </span>

          <strong class="status-value">
            ${
              average !== null &&
              average !== undefined
                ? `${Number(
                    average
                  ).toFixed(2)}%`
                : "—"
            }
          </strong>

        </div>


        <div class="status-item">

          <span class="status-label">
            GPA
          </span>

          <strong class="status-value">
            ${
              gpa !== null &&
              gpa !== undefined
                ? Number(gpa).toFixed(2)
                : "—"
            }
          </strong>

        </div>


        <div class="status-item">

          <span class="status-label">
            Letter Grade
          </span>

          <strong class="status-value">
            ${escapeHTML(
              letter || "—"
            )}
          </strong>

        </div>


        <div class="status-item">

          <span class="status-label">
            Score Consistency
          </span>

          <strong class="status-value">
            ${
              consistency !== null &&
              consistency !== undefined
                ? Number(
                    consistency
                  ).toFixed(2)
                : "—"
            }
          </strong>

        </div>


        <div class="status-item">

          <span class="status-label">
            Tests Completed
          </span>

          <strong class="status-value">
            ${tests}
          </strong>

        </div>


        <div class="status-item">

          <span class="status-label">
            Latest Score
          </span>

          <strong class="status-value">
            ${
              latestScore !== null &&
              latestScore !== undefined
                ? `${Number(
                    latestScore
                  ).toFixed(0)}%`
                : "—"
            }
          </strong>

        </div>

      </div>


      <div class="status-progress">

        <div class="progress-header">

          <span>
            Overall Progress
          </span>

          <strong>
            ${progress}%
          </strong>

        </div>


        <div class="progress-bar">

          <div
            class="progress-fill"
            style="width:${progress}%"
          ></div>

        </div>

      </div>


      <button
        type="button"
        class="secondary-button"
        data-page="progress"
      >
        View Full Progress
      </button>

    </div>
  `;
}


/* =========================================================
   MAIN FEED
   ========================================================= */

function renderMainFeed() {
  return `
    <div class="panel-header">

      <div>

        <span class="panel-kicker">
          Class Community
        </span>

        <h2>
          📰 Main Feed
        </h2>

      </div>

    </div>


    <div class="panel-body">

      <div class="feed-composer">

        <textarea
          id="feed-post-input"
          placeholder="Share something with your class..."
          rows="3"
        ></textarea>


        <div class="composer-actions">

          <button
            type="button"
            class="primary-button"
            data-action="create-post"
          >
            Post
          </button>

        </div>

      </div>


      <div class="feed-list">

        ${
          state.feedPosts.length
            ? state.feedPosts
                .map(
                  renderFeedPost
                )
                .join("")
            : `
              <div class="empty-state">

                <div class="empty-icon">
                  💬
                </div>

                <h3>
                  No posts yet
                </h3>

                <p>
                  Be the first person to post something.
                </p>

              </div>
            `
        }

      </div>

    </div>
  `;
}


function renderFeedPost(post) {
  const profile =
    post.profiles || {};

  const displayName =
    profile.display_name ||
    profile.full_name ||
    "Student";

  const initials =
    getInitials(displayName);

  const reactions =
    post.feed_reactions || [];

  const heartCount =
    reactions.filter(
      (item) =>
        item.reaction === "heart"
    ).length;

  const reacted =
    reactions.some(
      (item) =>
        item.user_id ===
          state.user?.id &&
        item.reaction === "heart"
    );

  const isOwner =
    post.user_id ===
    state.user?.id;

  return `
    <article
      class="feed-post"
      data-post-id="${escapeHTML(
        post.id
      )}"
    >

      <div class="post-header">

        <div class="avatar">
          ${escapeHTML(
            initials
          )}
        </div>


        <div class="post-user">

          <strong>
            ${escapeHTML(
              displayName
            )}
          </strong>

          <span class="post-time">
            ${escapeHTML(
              formatDateTime(
                post.created_at
              )
            )}
          </span>

        </div>

      </div>


      <div class="post-content">
        ${escapeHTML(
          post.content
        ).replace(
          /\n/g,
          "<br>"
        )}
      </div>


      <div class="post-actions">

        <button
          type="button"
          class="post-action ${
            reacted
              ? "active"
              : ""
          }"
          data-react-post="${escapeHTML(
            post.id
          )}"
          data-reaction="heart"
        >
          ❤️
          ${heartCount}
        </button>


        ${
          isOwner
            ? `
              <button
                type="button"
                class="post-action danger"
                data-delete-post="${escapeHTML(
                  post.id
                )}"
              >
                Delete
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================================
   ACTIVE USERS
   ========================================================= */

function renderActiveUsers() {
  const users =
    [...state.activeUsers]
      .sort(
        (a, b) => {
          const order = {
            online: 0,
            idle: 1,
            offline: 2
          };

          return (
            (order[a.status] ?? 3) -
            (order[b.status] ?? 3)
          );
        }
      )
      .slice(0, 8);

  return `
    <div class="panel-header">

      <div>

        <span class="panel-kicker">
          Classmates
        </span>

        <h2>
          🟢 Who's Active
        </h2>

      </div>

    </div>


    <div class="panel-body">

      <div class="active-list">

        ${
          users.length
            ? users
                .map(
                  renderActiveUser
                )
                .join("")
            : `
              <div class="empty-state">

                <div class="empty-icon">
                  💤
                </div>

                <h3>
                  No activity yet
                </h3>

                <p>
                  Classmate activity will appear here.
                </p>

              </div>
            `
        }

      </div>

    </div>
  `;
}


function renderActiveUser(user) {
  const profile =
    user.profiles || {};

  const displayName =
    profile.display_name ||
    profile.full_name ||
    "Student";

  const initials =
    getInitials(displayName);

  const status =
    user.status ||
    "offline";

  return `
    <div class="active-user">

      <div class="avatar small">
        ${escapeHTML(initials)}
      </div>


      <div class="active-user-info">

        <strong class="active-user-name">
          ${escapeHTML(
            displayName
          )}
        </strong>


        <span
          class="active-user-status"
        >

          <span
            class="status-dot ${escapeHTML(
              status
            )}"
          ></span>

          ${escapeHTML(status)}

        </span>

      </div>

    </div>
  `;
}


/* =========================================================
   CHAPTER TRACKER DATA
   ========================================================= */

async function loadChapterTracker() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  state.tracker.loading = true;

  await loadTrackerClasses();
  await loadTrackerChapters();
  await loadTrackerScores();

  state.tracker.loading = false;
}


async function loadTrackerClasses() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {
    const {
      data: enrollments,
      error
    } =
      await supabase
        .from("enrollments")
        .select(`
          class_id,
          classes (
            id,
            name
          )
        `)
        .eq(
          "student_id",
          state.user.id
        );

    if (error) {
      console.error(
        "Classes loading error:",
        error
      );

      state.tracker.classes = [];
      return;
    }

    state.tracker.classes =
      (enrollments || [])
        .map(
          (item) =>
            item.classes
        )
        .filter(Boolean);

    if (
      !state.tracker.selectedClassId &&
      state.tracker.classes.length
    ) {
      state.tracker.selectedClassId =
        state.tracker.classes[0].id;
    }

  } catch (error) {
    console.error(
      "Unexpected classes error:",
      error
    );

    state.tracker.classes = [];
  }
}


async function loadTrackerChapters() {
  if (!supabase) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await supabase
        .from("chapters")
        .select(`
          id,
          chapter_number,
          title
        `)
        .order(
          "chapter_number",
          {
            ascending: true
          }
        );

    if (error) {
      console.error(
        "Chapters loading error:",
        error
      );

      state.tracker.chapters = [];
      return;
    }

    state.tracker.chapters =
      data || [];

  } catch (error) {
    console.error(
      "Unexpected chapters error:",
      error
    );

    state.tracker.chapters = [];
  }
}


async function loadTrackerScores() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {
    let query =
      supabase
        .from("scores")
        .select(`
          id,
          user_id,
          class_id,
          chapter_id,
          score,
          test_date,
          created_at,
          updated_at,
          chapters (
            id,
            chapter_number,
            title
          ),
          classes (
            id,
            name
          )
        `)
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
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    if (
      state.tracker.selectedClassId
    ) {
      query =
        query.eq(
          "class_id",
          state.tracker.selectedClassId
        );
    }

    const {
      data,
      error
    } = await query;

    if (error) {
      console.error(
        "Scores loading error:",
        error
      );

      state.tracker.scores = [];
      return;
    }

    state.tracker.scores =
      data || [];

  } catch (error) {
    console.error(
      "Unexpected scores error:",
      error
    );

    state.tracker.scores = [];
  }
}


/* =========================================================
   CHAPTER TRACKER PAGE
   ========================================================= */

function renderChapterTracker() {
  const scores =
    state.tracker.scores;

  const completed =
    new Set(
      scores
        .map(
          (item) =>
            item.chapter_id
        )
        .filter(Boolean)
    ).size;

  const totalChapters =
    state.tracker.chapters.length;

  const average =
    scores.length
      ? scores.reduce(
          (sum, item) =>
            sum +
            Number(
              item.score || 0
            ),
          0
        ) / scores.length
      : null;

  const latest =
    scores.length
      ? scores[0]
      : null;

  const editing =
    state.tracker.editingScoreId
      ? state.tracker.scores.find(
          (item) =>
            item.id ===
            state.tracker.editingScoreId
        )
      : null;

  return `
    <section class="page-header">

      <div>

        <div class="page-eyebrow">
          Academic Tools
        </div>

        <h1>
          📖 Chapter Tracker
        </h1>

        <p>
          Enter and manage your chapter test scores.
        </p>

      </div>

    </section>


    <section class="tracker-summary-grid">

      <div class="tracker-stat-card">

        <span>
          Chapters Completed
        </span>

        <strong>
          ${completed}
          /
          ${totalChapters || "—"}
        </strong>

      </div>


      <div class="tracker-stat-card">

        <span>
          Tests Recorded
        </span>

        <strong>
          ${scores.length}
        </strong>

      </div>


      <div class="tracker-stat-card">

        <span>
          Current Average
        </span>

        <strong>
          ${
            average !== null
              ? `${average.toFixed(2)}%`
              : "—"
          }
        </strong>

      </div>


      <div class="tracker-stat-card">

        <span>
          Latest Score
        </span>

        <strong>
          ${
            latest
              ? `${Number(
                  latest.score
                ).toFixed(0)}%`
              : "—"
          }
        </strong>

      </div>

    </section>


    <section class="panel tracker-panel">

      <div class="panel-header">

        <div>

          <span class="panel-kicker">
            Score Entry
          </span>

          <h2>
            ${
              editing
                ? "Edit Score"
                : "Add Test Score"
            }
          </h2>

        </div>

      </div>


      <div class="panel-body">

        ${
          state.tracker.message
            ? `
              <div
                class="tracker-message ${
                  state.tracker.messageType
                }"
              >
                ${escapeHTML(
                  state.tracker.message
                )}
              </div>
            `
            : ""
        }


        <form
          id="score-form"
          class="form-grid"
        >

          <div>

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

              ${state.tracker.classes
                .map(
                  (classItem) => `
                    <option
                      value="${escapeHTML(
                        classItem.id
                      )}"
                      ${
                        state.tracker
                          .selectedClassId ===
                        classItem.id
                          ? "selected"
                          : ""
                      }
                    >
                      ${escapeHTML(
                        classItem.name
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </div>


          <div>

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

              ${state.tracker.chapters
                .map(
                  (chapter) => `
                    <option
                      value="${chapter.id}"
                      ${
                        editing &&
                        Number(
                          editing.chapter_id
                        ) ===
                          Number(
                            chapter.id
                          )
                          ? "selected"
                          : ""
                      }
                    >
                      Chapter
                      ${escapeHTML(
                        chapter.chapter_number
                      )}
                      —
                      ${escapeHTML(
                        chapter.title
                      )}
                    </option>
                  `
                )
                .join("")}

            </select>

          </div>


          <div>

            <label for="tracker-score">
              Score
            </label>

            <input
              id="tracker-score"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Example: 94"
              value="${
                editing
                  ? escapeHTML(
                      editing.score
                    )
                  : ""
              }"
              required
            />

          </div>


          <div>

            <label for="tracker-date">
              Test Date
            </label>

            <input
              id="tracker-date"
              type="date"
              value="${
                editing
                  ? escapeHTML(
                      editing.test_date
                    )
                  : ""
              }"
              required
            />

          </div>


          <div class="form-actions">

            <button
              type="submit"
              class="primary-button"
              ${
                state.tracker.loading
                  ? "disabled"
                  : ""
              }
            >
              ${
                editing
                  ? "Update Score"
                  : "Save Score"
              }
            </button>


            ${
              editing
                ? `
                  <button
                    type="button"
                    class="secondary-button"
                    data-action="cancel-score"
                  >
                    Cancel
                  </button>
                `
                : ""
            }

          </div>

        </form>

      </div>

    </section>


    <section class="panel">

      <div class="panel-header">

        <div>

          <span class="panel-kicker">
            Your Records
          </span>

          <h2>
            Chapter Scores
          </h2>

        </div>

      </div>


      <div class="panel-body">

        ${renderChapterScoreList()}

      </div>

    </section>
  `;
}


/* =========================================================
   CHAPTER SCORE LIST
   ========================================================= */

function renderChapterScoreList() {
  if (
    !state.tracker.scores.length
  ) {
    return `
      <div class="empty-state">

        <div class="empty-icon">
          📚
        </div>

        <h3>
          No scores recorded yet
        </h3>

        <p>
          Add your first chapter test score above.
        </p>

      </div>
    `;
  }

  return `
    <div class="chapter-list">

      ${state.tracker.scores
        .map(
          (score) => {

            const chapter =
              score.chapters ||
              {};

            const number =
              chapter.chapter_number;

            const title =
              chapter.title ||
              "Chapter";

            const value =
              Number(score.score);

            const grade =
              getLetterGrade(value);

            return `
              <article
                class="chapter-card"
              >

                <div
                  class="chapter-card-header"
                >

                  <div>

                    <div
                      class="chapter-number"
                    >
                      Chapter
                      ${escapeHTML(
                        number
                      )}
                    </div>

                    <h3>
                      ${escapeHTML(
                        title
                      )}
                    </h3>

                  </div>


                  <div
                    class="chapter-latest"
                  >
                    ${value.toFixed(0)}%
                  </div>

                </div>


                <div
                  class="chapter-score-main"
                >

                  <span>
                    ${value.toFixed(2)}%
                  </span>

                  <span
                    class="grade-pill ${getGradeClass(
                      value
                    )}"
                  >
                    ${grade}
                  </span>

                </div>


                <div
                  class="chapter-test-date"
                >
                  Test Date:
                  ${escapeHTML(
                    formatDate(
                      score.test_date
                    )
                  )}
                </div>


                <div
                  class="score-history-actions"
                >

                  <button
                    type="button"
                    class="secondary-button"
                    data-edit-score="${escapeHTML(
                      score.id
                    )}"
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    class="danger-button"
                    data-delete-score="${escapeHTML(
                      score.id
                    )}"
                  >
                    Delete
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("")}

    </div>
  `;
}


/* =========================================================
   SCORE SUBMISSION
   ========================================================= */

async function handleScoreSubmit(
  event
) {
  event.preventDefault();

  if (
    !supabase ||
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

  const scoreValue =
    document.getElementById(
      "tracker-score"
    )?.value;

  const testDate =
    document.getElementById(
      "tracker-date"
    )?.value;

  if (
    !classId ||
    !chapterId ||
    !scoreValue ||
    !testDate
  ) {
    showTrackerMessage(
      "Please complete all score fields.",
      "error"
    );

    renderApp();

    return;
  }

  const numericScore =
    Number(scoreValue);

  if (
    Number.isNaN(
      numericScore
    ) ||
    numericScore < 0 ||
    numericScore > 100
  ) {
    showTrackerMessage(
      "Score must be between 0 and 100.",
      "error"
    );

    renderApp();

    return;
  }

  const wasEditing =
    Boolean(
      state.tracker.editingScoreId
    );

  state.tracker.loading =
    true;

  const scoreData = {
    user_id:
      state.user.id,

    class_id:
      classId,

    chapter_id:
      Number(chapterId),

    score:
      numericScore,

    test_date:
      testDate
  };

  let result;

  try {

    if (wasEditing) {

      result =
        await supabase
          .from("scores")
          .update({
            class_id:
              classId,

            chapter_id:
              Number(chapterId),

            score:
              numericScore,

            test_date:
              testDate,

            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            state.tracker
              .editingScoreId
          )
          .eq(
            "user_id",
            state.user.id
          );

    } else {

      result =
        await supabase
          .from("scores")
          .insert(
            scoreData
          );

    }

  } catch (error) {

    console.error(
      "Score save exception:",
      error
    );

    state.tracker.loading =
      false;

    showTrackerMessage(
      error?.message ||
        "Unable to save the score.",
      "error"
    );

    renderApp();

    return;
  }

  if (result.error) {

    console.error(
      "Score save error:",
      result.error
    );

    state.tracker.loading =
      false;

    showTrackerMessage(
      result.error.message ||
        "Unable to save the score.",
      "error"
    );

    renderApp();

    return;
  }

  state.tracker.loading =
    false;

  state.tracker.editingScoreId =
    null;

  await loadTrackerScores();
  await loadAcademicSummary();
  await loadLatestScore();

  showTrackerMessage(
    wasEditing
      ? "Score updated successfully."
      : "Score added successfully.",
    "success"
  );

  renderApp();
}


/* =========================================================
   EDIT SCORE
   ========================================================= */

function handleEditScore(
  scoreId
) {
  const score =
    state.tracker.scores.find(
      (item) =>
        item.id === scoreId
    );

  if (!score) {
    return;
  }

  state.tracker.editingScoreId =
    scoreId;

  state.tracker.selectedClassId =
    score.class_id;

  renderApp();

  setTimeout(
    () => {
      const form =
        document.getElementById(
          "score-form"
        );

      if (form) {
        form.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    },
    50
  );
}


/* =========================================================
   DELETE SCORE
   ========================================================= */

async function handleDeleteScore(
  scoreId
) {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  const confirmed =
    window.confirm(
      "Are you sure you want to delete this score?"
    );

  if (!confirmed) {
    return;
  }

  state.tracker.loading =
    true;

  try {

    const {
      error
    } =
      await supabase
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
      throw error;
    }

  } catch (error) {

    console.error(
      "Delete score error:",
      error
    );

    state.tracker.loading =
      false;

    showTrackerMessage(
      error?.message ||
        "Unable to delete the score.",
      "error"
    );

    renderApp();

    return;
  }

  state.tracker.loading =
    false;

  state.tracker.editingScoreId =
    null;

  await loadTrackerScores();
  await loadAcademicSummary();
  await loadLatestScore();

  showTrackerMessage(
    "Score deleted successfully.",
    "success"
  );

  renderApp();
}


/* =========================================================
   ACADEMIC SUMMARY
   ========================================================= */

async function loadAcademicSummary() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabase
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
      console.error(
        "Academic summary error:",
        error
      );

      state.academicSummary =
        null;

      return;
    }

    state.academicSummary =
      data || null;

  } catch (error) {

    console.error(
      "Unexpected academic summary error:",
      error
    );

    state.academicSummary =
      null;
  }
}


/* =========================================================
   LATEST SCORE
   ========================================================= */

async function loadLatestScore() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await supabase
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
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        "Latest score error:",
        error
      );

      state.latestScore =
        null;

      return;
    }

    state.latestScore =
      data || null;

  } catch (error) {

    console.error(
      "Unexpected latest score error:",
      error
    );

    state.latestScore =
      null;
  }
}


/* =========================================================
   FEED LOADING
   ========================================================= */

async function loadFeed() {
  if (
    !supabase ||
    !state.user
  ) {
    return;
  }

  try {

    const {
      data,
      error
    } =
      await