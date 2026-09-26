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

function escapeHTML(value) {
  if (value === null || value === undefined) {
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

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
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

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
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
  const number = Number(score);

  if (number >= 90) return "A";
  if (number >= 80) return "B";
  if (number >= 70) return "C";
  if (number >= 60) return "D";

  return "F";
}


function getGradeClass(score) {
  return `grade-${getLetterGrade(score).toLowerCase()}`;
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
      (part) => part.charAt(0).toUpperCase()
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
  state.tracker.message = message;
  state.tracker.messageType = type;
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

  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-logo">
          <div class="brand-icon">S</div>

          <div>
            <div class="brand-text">
              StudentHub
            </div>

            <div class="auth-subtitle">
              Your CNA class. One place.
            </div>
          </div>
        </div>

        <form id="login-form" class="auth-form">

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

  const email =
    document.getElementById(
      "login-email"
    )?.value.trim();

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

  const {
    data,
    error
  } = await supabase.auth.signInWithPassword({
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

  state.session = data.session;
  state.user = data.user;

  await loadProfile();

  await updatePresence("online");

  await loadAcademicSummary();
  await loadLatestScore();
  await loadFeed();
  await loadActiveUsers();

  renderApp();
}


async function handleForgotPassword() {
  const email =
    document.getElementById(
      "login-email"
    )?.value.trim();

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

  const {
    error
  } = await supabase.auth.resetPasswordForEmail(
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
}


/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (!state.user) return;

  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Profile loading error:",
      error
    );

    state.profile = null;

    return;
  }

  state.profile = data || null;
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

          <span class="study-arrow ${
            studyOpen
              ? "open"
              : ""
          }">
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
        <span>My Profile</span>
      </button>

      <button
        type="button"
        class="account-menu-item"
        data-account-action="details"
      >
        ⚙️
        <span>Account Details</span>
      </button>

      <button
        type="button"
        class="account-menu-item"
        data-account-action="security"
      >
        🔐
        <span>Password & Security</span>
      </button>

      <button
        type="button"
        class="account-menu-item"
        data-account-action="privacy"
      >
        🛡️
        <span>Privacy</span>
      </button>

      <button
        type="button"
        class="account-menu-item"
        data-account-action="appearance"
      >
        🎨
        <span>Appearance</span>
      </button>

      <button
        type="button"
        class="account-menu-item"
        data-account-action="export"
      >
        📦
        <span>Export My Data</span>
      </button>

      <div class="account-menu-divider"></div>

      <button
        type="button"
        class="account-menu-item danger"
        data-account-action="signout"
      >
        🚪
        <span>Sign Out</span>
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

  if (!app) return;

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
  switch (state.currentPage) {

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
          )}, ${escapeHTML(name)} 👋
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
            style="width: ${progress}%"
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
                  Be the first person to
                  post something.
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
          ${escapeHTML(initials)}
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
        ).replace(/\n/g, "<br>")}
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
                  Classmate activity will
                  appear here.
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
    user.status || "offline";

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
   CHAPTER TRACKER
   ========================================================= */

async function loadChapterTracker() {
  if (!state.user) return;

  state.tracker.loading = true;

  await loadTrackerClasses();
  await loadTrackerChapters();
  await loadTrackerScores();

  state.tracker.loading = false;
}


async function loadTrackerClasses() {
  const {
    data: enrollments,
    error
  } = await supabase
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
}


async function loadTrackerChapters() {
  const {
    data,
    error
  } = await supabase
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
}


async function loadTrackerScores() {
  if (!state.user) return;

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
    query = query.eq(
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
            Number(item.score || 0),
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
          Enter and manage your chapter
          test scores.
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
              ? `${average.toFixed(
                  2
                )}%`
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
          Add your first chapter test
          score above.
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
                    ${value.toFixed(
                      0
                    )}%
                  </div>

                </div>


                <div
                  class="chapter-score-main"
                >

                  <span>
                    ${value.toFixed(
                      2
                    )}%
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

async function handleScoreSubmit(event) {
  event.preventDefault();

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
    Number.isNaN(numericScore) ||
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

  state.tracker.loading = true;

  const scoreData = {
    user_id: state.user.id,
    class_id: classId,
    chapter_id: Number(
      chapterId
    ),
    score: numericScore,
    test_date: testDate
  };

  let result;

  if (wasEditing) {

    result = await supabase
      .from("scores")
      .update({
        class_id: classId,
        chapter_id: Number(
          chapterId
        ),
        score: numericScore,
        test_date: testDate,
        updated_at:
          new Date().toISOString()
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
      .insert(
        scoreData
      );

  }

  if (result.error) {
    console.error(
      "Score save error:",
      result.error
    );

    state.tracker.loading = false;

    showTrackerMessage(
      result.error.message ||
        "Unable to save the score.",
      "error"
    );

    renderApp();

    return;
  }

  state.tracker.loading = false;
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

function handleEditScore(scoreId) {
  const score =
    state.tracker.scores.find(
      (item) =>
        item.id === scoreId
    );

  if (!score) return;

  state.tracker.editingScoreId =
    scoreId;

  state.tracker.selectedClassId =
    score.class_id;

  renderApp();

  setTimeout(() => {
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
  }, 50);
}


/* =========================================================
   DELETE SCORE
   ========================================================= */

async function handleDeleteScore(
  scoreId
) {
  const confirmed =
    window.confirm(
      "Are you sure you want to delete this score?"
    );

  if (!confirmed) {
    return;
  }

  state.tracker.loading = true;

  const {
    error
  } = await supabase
    .from("scores")
    .delete()
    .eq("id", scoreId)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    console.error(
      "Delete score error:",
      error
    );

    state.tracker.loading = false;

    showTrackerMessage(
      error.message ||
        "Unable to delete the score.",
      "error"
    );

    renderApp();

    return;
  }

  state.tracker.loading = false;
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
  if (!state.user) {
    return;
  }

  const {
    data,
    error
  } = await supabase
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
}


/* =========================================================
   LATEST SCORE
   ========================================================= */

async function loadLatestScore() {
  if (!state.user) {
    return;
  }

  const {
    data,
    error
  } = await supabase
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
}


/* =========================================================
   FEED LOADING
   ========================================================= */

async function loadFeed() {
  if (!state.user) {
    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("feed_posts")
    .select(`
      id,
      user_id,
      content,
      pinned,
      created_at,
      updated_at,
      profiles:user_id (
        id,
        display_name,
        full_name,
        avatar_url
      ),
      feed_reactions (
        id,
        user_id,
        reaction
      )
    `)
    .order(
      "pinned",
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
    .limit(50);

  if (error) {
    console.error(
      "Feed loading error:",
      error
    );

    state.feedPosts = [];

    return;
  }

  state.feedPosts =
    data || [];
}


/* =========================================================
   CREATE FEED POST
   ========================================================= */

async function handleCreatePost() {
  if (!state.user) {
    return;
  }

  const input =
    document.getElementById(
      "feed-post-input"
    );

  if (!input) {
    return;
  }

  const content =
    input.value.trim();

  if (!content) {
    return;
  }

  const {
    error
  } = await supabase
    .from("feed_posts")
    .insert({
      user_id:
        state.user.id,
      content
    });

  if (error) {
    console.error(
      "Create post error:",
      error
    );

    window.alert(
      error.message ||
        "Unable to create your post."
    );

    return;
  }

  await loadFeed();

  renderApp();
}


/* =========================================================
   FEED REACTIONS
   ========================================================= */

async function handleFeedReaction(
  postId,
  reaction = "heart"
) {
  if (!state.user) {
    return;
  }

  const {
    data: existing
  } = await supabase
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
      reaction
    )
    .maybeSingle();

  if (existing) {

    await supabase
      .from("feed_reactions")
      .delete()
      .eq(
        "id",
        existing.id
      );

  } else {

    await supabase
      .from("feed_reactions")
      .insert({
        post_id: postId,
        user_id:
          state.user.id,
        reaction
      });

  }

  await loadFeed();

  renderApp();
}


/* =========================================================
   DELETE FEED POST
   ========================================================= */

async function handleDeletePost(
  postId
) {
  if (!state.user) {
    return;
  }

  const confirmed =
    window.confirm(
      "Delete this post?"
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } = await supabase
    .from("feed_posts")
    .delete()
    .eq(
      "id",
      postId
    )
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    console.error(
      "Delete post error:",
      error
    );

    window.alert(
      error.message ||
        "Unable to delete the post."
    );

    return;
  }

  await loadFeed();

  renderApp();
}


/* =========================================================
   ACTIVE USERS
   ========================================================= */

async function loadActiveUsers() {
  const {
    data,
    error
  } = await supabase
    .from("user_presence")
    .select(`
      user_id,
      status,
      last_seen_at,
      profiles:user_id (
        id,
        display_name,
        full_name,
        avatar_url
      )
    `);

  if (error) {
    console.error(
      "Active users error:",
      error
    );

    state.activeUsers = [];

    return;
  }

  state.activeUsers =
    data || [];
}


/* =========================================================
   PRESENCE
   ========================================================= */

async function updatePresence(
  status = "online"
) {
  if (!state.user) {
    return;
  }

  const {
    error
  } = await supabase
    .from("user_presence")
    .upsert(
      {
        user_id:
          state.user.id,
        status,
        last_seen_at:
          new Date().toISOString()
      },
      {
        onConflict:
          "user_id"
      }
    );

  if (error) {
    console.error(
      "Presence update error:",
      error
    );
  }
}


/* =========================================================
   PROGRESS PAGE
   ========================================================= */

function renderProgressPage() {
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

  const lowest =
    summary?.lowest_score;

  const highest =
    summary?.highest_score;

  const tests =
    summary?.total_tests || 0;

  return `
    <section class="page-header">

      <div>
        <div class="page-eyebrow">
          Academic Overview
        </div>

        <h1>
          📈 Progress
        </h1>

        <p>
          Your academic performance at a glance.
        </p>
      </div>

    </section>


    <section class="tracker-summary-grid">

      <div class="tracker-stat-card">
        <span>
          Overall Average
        </span>

        <strong>
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


      <div class="tracker-stat-card">
        <span>
          GPA
        </span>

        <strong>
          ${
            gpa !== null &&
            gpa !== undefined
              ? Number(
                  gpa
                ).toFixed(2)
              : "—"
          }
        </strong>
      </div>


      <div class="tracker-stat-card">
        <span>
          Letter Grade
        </span>

        <strong>
          ${escapeHTML(
            letter || "—"
          )}
        </strong>
      </div>


      <div class="tracker-stat-card">
        <span>
          Tests Completed
        </span>

        <strong>
          ${tests}
        </strong>
      </div>

    </section>


    <section class="panel">

      <div class="panel-header">

        <div>
          <span class="panel-kicker">
            Performance
          </span>

          <h2>
            Score Overview
          </h2>
        </div>

      </div>

      <div class="panel-body">

        <div class="status-list">

          <div class="status-item">
            <span class="status-label">
              Highest Score
            </span>

            <strong class="status-value">
              ${
                highest !== null &&
                highest !== undefined
                  ? `${Number(
                      highest
                    ).toFixed(2)}%`
                  : "—"
              }
            </strong>
          </div>


          <div class="status-item">
            <span class="status-label">
              Lowest Score
            </span>

            <strong class="status-value">
              ${
                lowest !== null &&
                lowest !== undefined
                  ? `${Number(
                      lowest
                    ).toFixed(2)}%`
                  : "—"
              }
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

        </div>


        <button
          type="button"
          class="primary-button"
          data-page="chapter-tracker"
        >
          Open Chapter Tracker
        </button>

      </div>

    </section>
  `;
}


/* =========================================================
   ACCOUNT PAGE
   ========================================================= */

function renderAccountPage() {
  const name =
    getDisplayName();

  const email =
    state.user?.email ||
    "—";

  return `
    <section class="page-header">

      <div>
        <div class="page-eyebrow">
          Settings
        </div>

        <h1>
          👤 Account
        </h1>

        <p>
          Manage your StudentHub account.
        </p>
      </div>

    </section>


    <section class="panel">

      <div class="panel-header">

        <div>
          <span class="panel-kicker">
            Profile
          </span>

          <h2>
            Account Information
          </h2>
        </div>

      </div>

      <div class="panel-body">

        <div class="status-list">

          <div class="status-item">
            <span class="status-label">
              Name
            </span>

            <strong class="status-value">
              ${escapeHTML(name)}
            </strong>
          </div>


          <div class="status-item">
            <span class="status-label">
              Email
            </span>

            <strong class="status-value">
              ${escapeHTML(email)}
            </strong>
          </div>

        </div>


        <button
          type="button"
          class="danger-button"
          data-account-action="signout"
        >
          Sign Out
        </button>

      </div>

    </section>
  `;
}


/* =========================================================
   PLACEHOLDER PAGE
   ========================================================= */

function renderPlaceholderPage(
  icon,
  title,
  description
) {
  return `
    <section class="page-header">

      <div>
        <div class="page-eyebrow">
          StudentHub
        </div>

        <h1>
          ${icon}
          ${escapeHTML(title)}
        </h1>

        <p>
          ${escapeHTML(
            description
          )}
        </p>
      </div>

    </section>


    <section class="panel">

      <div class="panel-body">

        <div class="empty-state">

          <div class="empty-icon">
            ${icon}
          </div>

          <h3>
            Coming next
          </h3>

          <p>
            This section is part of the
            StudentHub build and will be
            connected to its database features.
          </p>

        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   ACCOUNT ACTIONS
   ========================================================= */

async function handleAccountAction(
  action
) {
  state.accountMenuOpen = false;

  if (action === "signout") {
    await handleSignOut();
    return;
  }

  if (action === "profile") {
    state.currentPage =
      "account";

    renderApp();

    return;
  }

  if (action === "details") {
    state.currentPage =
      "account";

    renderApp();

    return;
  }

  if (action === "security") {
    state.currentPage =
      "account";

    renderApp();

    return;
  }

  if (action === "privacy") {
    state.currentPage =
      "account";

    renderApp();

    return;
  }

  if (action === "appearance") {
    state.currentPage =
      "account";

    renderApp();

    return;
  }

  if (action === "export") {
    await requestDataExport();
    return;
  }
}


/* =========================================================
   DATA EXPORT REQUEST
   ========================================================= */

async function requestDataExport() {
  if (!state.user) {
    return;
  }

  const {
    error
  } = await supabase
    .from(
      "data_export_requests"
    )
    .insert({
      user_id:
        state.user.id,
      status: "requested"
    });

  if (error) {
    console.error(
      "Data export error:",
      error
    );

    window.alert(
      error.message ||
        "Unable to request your data export."
    );

    return;
  }

  window.alert(
    "Your data export request has been submitted."
  );
}


/* =========================================================
   SIGN OUT
   ========================================================= */

async function handleSignOut() {
  try {
    await updatePresence(
      "offline"
    );

    await supabase.auth.signOut();

  } catch (error) {
    console.error(
      "Sign out error:",
      error
    );
  }
}


/* =========================================================
   APP LISTENERS
   ========================================================= */

function attachAppListeners() {

  /* Navigation */

  document
    .querySelectorAll(
      "[data-page]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const page =
            button.dataset.page;

          state.currentPage =
            page;

          state.accountMenuOpen =
            false;

          state.mobileMenuOpen =
            false;

          renderApp();

          if (
            page ===
            "chapter-tracker"
          ) {

            await loadChapterTracker();

            renderApp();
          }

          if (
            page === "home"
          ) {

            await loadAcademicSummary();
            await loadLatestScore();
            await loadFeed();
            await loadActiveUsers();

            renderApp();
          }

        }
      );

    });


  /* Study Tools */

  const studyToggle =
    document.querySelector(
      ".study-toggle"
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


  /* Mobile Menu */

  const mobileMenuButton =
    document.querySelector(
      ".mobile-menu-button"
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


  const mobileOverlay =
    document.querySelector(
      ".mobile-overlay"
    );

  if (mobileOverlay) {

    mobileOverlay.addEventListener(
      "click",
      () => {

        state.mobileMenuOpen =
          false;

        renderApp();

      }
    );

  }


  /* Account */

  const accountButton =
    document.querySelector(
      '[data-action="account"]'
    );

  if (accountButton) {

    accountButton.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

        state.accountMenuOpen =
          !state.accountMenuOpen;

        renderApp();

      }
    );

  }


  document
    .querySelectorAll(
      "[data-account-action]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          handleAccountAction(
            button.dataset
              .accountAction
          );

        }
      );

    });


  /* Messages */

  const messagesButton =
    document.querySelector(
      '[data-action="messages"]'
    );

  if (messagesButton) {

    messagesButton.addEventListener(
      "click",
      () => {

        state.currentPage =
          "care-team";

        renderApp();

      }
    );

  }


  /* Notifications */

  const notificationsButton =
    document.querySelector(
      '[data-action="notifications"]'
    );

  if (notificationsButton) {

    notificationsButton.addEventListener(
      "click",
      () => {

        state.currentPage =
          "notifications";

        renderApp();

      }
    );

  }


  /* Feed */

  const createPostButton =
    document.querySelector(
      '[data-action="create-post"]'
    );

  if (createPostButton) {

    createPostButton.addEventListener(
      "click",
      handleCreatePost
    );

  }


  document
    .querySelectorAll(
      "[data-react-post]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          handleFeedReaction(
            button.dataset
              .reactPost,
            button.dataset
              .reaction ||
              "heart"
          );

        }
      );

    });


  document
    .querySelectorAll(
      "[data-delete-post]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          handleDeletePost(
            button.dataset
              .deletePost
          );

        }
      );

    });


  /* Chapter Tracker */

  const scoreForm =
    document.getElementById(
      "score-form"
    );

  if (scoreForm) {

    scoreForm.addEventListener(
      "submit",
      handleScoreSubmit
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

        state.tracker
          .selectedClassId =
          event.target.value;

        await loadTrackerScores();

        renderApp();

      }
    );

  }


  document
    .querySelectorAll(
      "[data-edit-score]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          handleEditScore(
            button.dataset
              .editScore
          );

        }
      );

    });


  document
    .querySelectorAll(
      "[data-delete-score]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          handleDeleteScore(
            button.dataset
              .deleteScore
          );

        }
      );

    });


  const cancelScoreButton =
    document.querySelector(
      '[data-action="cancel-score"]'
    );

  if (cancelScoreButton) {

    cancelScoreButton.addEventListener(
      "click",
      () => {

        state.tracker
          .editingScoreId =
          null;

        clearTrackerMessage();

        renderApp();

      }
    );

  }

}


/* =========================================================
   AUTH STATE
   ========================================================= */

supabase.auth.onAuthStateChange(
  (event, session) => {

    if (
      event ===
      "SIGNED_OUT"
    ) {

      state.session = null;
      state.user = null;
      state.profile = null;

      state.academicSummary =
        null;

      state.latestScore =
        null;

      state.feedPosts =
        [];

      state.activeUsers =
        [];

      renderLogin();

      return;
    }


    if (
      event === "SIGNED_IN"
    ) {

      setTimeout(
        async () => {

          if (!session) {
            return;
          }

          state.session =
            session;

          state.user =
            session.user;

          await loadProfile();
          await updatePresence(
            "online"
          );

          await loadAcademicSummary();
          await loadLatestScore();
          await loadFeed();
          await loadActiveUsers();

          renderApp();

        },
        0
      );

    }

  }
);


/* =========================================================
   INITIALIZE STUDENTHUB
   ========================================================= */

async function initializeApp() {

  const app =
    document.getElementById(
      "app"
    );

  if (app) {

    app.innerHTML = `
      <div class="loading-screen">

        <div class="loading-spinner"></div>

        <h2>
          StudentHub
        </h2>

        <p>
          Loading your class hub...
        </p>

      </div>
    `;

  }


  const {
    data,
    error
  } = await supabase.auth.getSession();


  if (error) {

    console.error(
      "Session error:",
      error
    );

    renderLogin();

    return;
  }


  const session =
    data?.session;


  if (!session) {

    renderLogin();

    return;
  }


  state.session =
    session;

  state.user =
    session.user;


  await loadProfile();
  await updatePresence(
    "online"
  );

  await loadAcademicSummary();
  await loadLatestScore();
  await loadFeed();
  await loadActiveUsers();


  renderApp();
}


/* =========================================================
   GLOBAL ERROR LOGGING
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {

    console.error(
      "StudentHub error:",
      event.error ||
        event.message
    );

  }
);


window.addEventListener(
  "unhandledrejection",
  (event) => {

    console.error(
      "StudentHub promise error:",
      event.reason
    );

  }
);


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);