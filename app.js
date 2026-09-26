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
  if (state.profile) {
    return (
      state.profile.display_name ||
      state.profile.full_name ||
      state.profile.name ||
      state.user?.user_metadata?.display_name ||
      state.user?.email?.split("@")[0] ||
      "Student"
    );
  }

  return (
    state.user?.user_metadata?.display_name ||
    state.user?.email?.split("@")[0] ||
    "Student"
  );
}


function getInitials(name) {
  if (!name) {
    return "S";
  }

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .substring(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(
    `${dateValue}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
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
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );
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
  return `grade-${getLetterGrade(score).toLowerCase()}`;
}


function calculateAverage(scores) {
  const validScores = (scores || [])
    .map(item => Number(item.score))
    .filter(
      score => !Number.isNaN(score)
    );

  if (!validScores.length) {
    return null;
  }

  const total = validScores.reduce(
    (sum, score) => sum + score,
    0
  );

  return total / validScores.length;
}


function getToday() {
  return new Date()
    .toISOString()
    .split("T")[0];
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

  renderApp();
}


/* =========================================================
   LOGIN
   ========================================================= */

function renderLogin() {
  return `
    <div class="auth-page">

      <div class="auth-card">

        <div class="auth-logo">
          ✚
        </div>

        <h1>StudentHub</h1>

        <p class="auth-subtitle">
          Your CNA class hub.
          Sign in to continue.
        </p>

        <form
          id="login-form"
          class="auth-form"
        >

          <div class="form-group">

            <label for="login-email">
              Email
            </label>

            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
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
              placeholder="Enter your password"
              autocomplete="current-password"
              required
            />

          </div>

          <div
            id="login-message"
            class="auth-message"
          ></div>

          <button
            type="submit"
            class="primary-button"
          >
            Sign In
          </button>

          <button
            type="button"
            id="forgot-password-button"
            class="secondary-button"
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

  const email =
    document
      .getElementById("login-email")
      ?.value
      .trim();

  const password =
    document
      .getElementById("login-password")
      ?.value;

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
      "Signing in...";
  }

  const {
    error
  } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    if (message) {
      message.textContent =
        error.message;
    }

    return;
  }
}


async function handleForgotPassword() {
  const email =
    document
      .getElementById("login-email")
      ?.value
      .trim();

  const message =
    document.getElementById(
      "login-message"
    );

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
    if (message) {
      message.textContent =
        error.message;
    }

    return;
  }

  if (message) {
    message.textContent =
      "Check your email for the password reset link.";
  }
}


function attachLoginListeners() {
  document
    .getElementById("login-form")
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
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (!state.user) {
    return;
  }

  const {
    data,
    error
  } =
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load profile:",
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
          ✚
        </div>

        <div>
          <div class="brand-text">
            StudentHub
          </div>

          <div
            style="
              color: var(--text-muted);
              font-size: 11px;
              margin-top: 2px;
            "
          >
            CNA Class Hub
          </div>
        </div>

      </div>


      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Main
        </div>

        <nav class="sidebar-nav">

          <button
            class="nav-item ${
              state.currentPage === "home"
                ? "active"
                : ""
            }"
            data-nav="home"
          >
            <span class="nav-icon">
              🏠
            </span>

            <span>
              Home
            </span>
          </button>


          <button
            class="nav-item ${
              state.currentPage === "calendar"
                ? "active"
                : ""
            }"
            data-nav="calendar"
          >
            <span class="nav-icon">
              📅
            </span>

            <span>
              Calendar
            </span>
          </button>


          <button
            class="nav-item ${
              state.currentPage === "care-team"
                ? "active"
                : ""
            }"
            data-nav="care-team"
          >
            <span class="nav-icon">
              💬
            </span>

            <span>
              The Care Team
            </span>
          </button>

        </nav>

      </div>


      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Study
        </div>


        <nav class="sidebar-nav">

          <button
            id="study-tools-toggle"
            class="nav-item study-toggle"
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
                state.studyToolsOpen
                  ? "open"
                  : ""
              }"
            >
              ▾
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
              class="subnav-item ${
                state.currentPage ===
                "flashcards"
                  ? "active"
                  : ""
              }"
              data-nav="flashcards"
            >
              🧠 Flashcards
            </button>


            <button
              class="subnav-item ${
                state.currentPage ===
                "quiz-maker"
                  ? "active"
                  : ""
              }"
              data-nav="quiz-maker"
            >
              📝 Quiz Maker
            </button>


            <button
              class="subnav-item ${
                state.currentPage ===
                "study-timer"
                  ? "active"
                  : ""
              }"
              data-nav="study-timer"
            >
              ⏱️ Study Timer
            </button>


            <button
              class="subnav-item ${
                state.currentPage ===
                "study-checklist"
                  ? "active"
                  : ""
              }"
              data-nav="study-checklist"
            >
              ✅ Study Checklist
            </button>


            <button
              class="subnav-item ${
                state.currentPage ===
                "chapter-tracker"
                  ? "active"
                  : ""
              }"
              data-nav="chapter-tracker"
            >
              📖 Chapter Tracker
            </button>

          </div>

        </nav>

      </div>


      <div class="sidebar-section">

        <div class="sidebar-section-title">
          Academic
        </div>

        <nav class="sidebar-nav">

          <button
            class="nav-item ${
              state.currentPage ===
              "progress"
                ? "active"
                : ""
            }"
            data-nav="progress"
          >
            <span class="nav-icon">
              📈
            </span>

            <span>
              Progress
            </span>
          </button>

        </nav>

      </div>


      <div
        style="
          margin-top: auto;
          padding-top: 20px;
        "
      >

        <button
          class="nav-item"
          data-nav="account"
        >
          <span class="nav-icon">
            👤
          </span>

          <span>
            Account
          </span>
        </button>

      </div>

    </aside>


    ${
      state.mobileMenuOpen
        ? `
          <div
            id="sidebar-overlay"
            class="mobile-overlay"
          ></div>
        `
        : ""
    }
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


      <div
        style="
          font-weight: 700;
          color: var(--text-secondary);
        "
      >
        ${escapeHtml(getPageTitle())}
      </div>


      <div class="topbar-actions">


        <button
          class="topbar-button"
          data-top-action="messages"
          title="Messages"
        >
          💬
        </button>


        <button
          class="topbar-button"
          data-top-action="notifications"
          title="Notifications"
        >
          🔔
        </button>


        <button
          id="account-button"
          class="topbar-button"
          title="Account"
        >
          👤
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
    "care-team":
      "The Care Team",
    flashcards: "Flashcards",
    "quiz-maker":
      "Quiz Maker",
    "study-timer":
      "Study Timer",
    "study-checklist":
      "Study Checklist",
    "chapter-tracker":
      "Chapter Tracker",
    progress: "Progress",
    account: "Account"
  };

  return (
    titles[state.currentPage] ||
    "StudentHub"
  );
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

      <div
        style="
          padding: 12px;
          display: flex;
          gap: 10px;
          align-items: center;
        "
      >

        <div class="avatar">
          ${escapeHtml(
            getInitials(
              getDisplayName()
            )
          )}
        </div>

        <div
          style="
            min-width: 0;
          "
        >

          <strong>
            ${escapeHtml(
              getDisplayName()
            )}
          </strong>

          <div
            style="
              color: var(--text-muted);
              font-size: 12px;
              margin-top: 3px;
              overflow: hidden;
              text-overflow: ellipsis;
            "
          >
            ${escapeHtml(
              state.user?.email || ""
            )}
          </div>

        </div>

      </div>


      <div class="account-menu-divider"></div>


      <button
        class="account-menu-item"
        data-account-action="profile"
      >
        👤 My Profile
      </button>


      <button
        class="account-menu-item"
        data-account-action="details"
      >
        ⚙️ Account Details
      </button>


      <button
        class="account-menu-item"
        data-account-action="security"
      >
        🔐 Password & Security
      </button>


      <button
        class="account-menu-item"
        data-account-action="privacy"
      >
        🔒 Privacy
      </button>


      <button
        class="account-menu-item"
        data-account-action="appearance"
      >
        🎨 Appearance
      </button>


      <button
        class="account-menu-item"
        data-account-action="export"
      >
        📦 Export My Data
      </button>


      <div class="account-menu-divider"></div>


      <button
        class="account-menu-item"
        style="color: var(--danger);"
        data-account-action="signout"
      >
        🚪 Sign Out
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

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

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


function renderComingSoon(
  icon,
  title,
  description
) {
  return `
    <section class="page">

      <div class="panel">

        <div class="panel-body">

          <div class="empty-state">

            <div
              style="
                font-size: 40px;
                margin-bottom: 10px;
              "
            >
              ${icon}
            </div>

            <h2>
              ${escapeHtml(title)}
            </h2>

            <p
              style="
                margin-top: 8px;
              "
            >
              ${escapeHtml(
                description
              )}
            </p>

          </div>

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
    <section>

      <div class="welcome-section">

        <h1>
          ${escapeHtml(
            getGreeting()
          )},
          ${escapeHtml(
            getDisplayName()
          )} 👋
        </h1>

        <p>
          Your CNA class. Your progress. Your community.
        </p>

      </div>


      <div class="home-grid">

        <div class="panel">

          <div class="panel-header">

            <h2>
              📊 Status Report
            </h2>

            <button
              class="small-button"
              data-nav="chapter-tracker"
            >
              View Tracker
            </button>

          </div>

          <div class="panel-body">

            ${renderStatusPanel()}

          </div>

        </div>


        <div class="panel">

          <div class="panel-header">

            <h2>
              📰 Main Feed
            </h2>

          </div>

          <div class="panel-body">

            ${renderFeedPanel()}

          </div>

        </div>


        <div class="panel active-panel">

          <div class="panel-header">

            <h2>
              🟢 Who's Active
            </h2>

          </div>

          <div class="panel-body">

            ${renderActivePanel()}

          </div>

        </div>

      </div>

    </section>
  `;
}


/* =========================================================
   STATUS REPORT
   ========================================================= */

function renderStatusPanel() {
  const summary =
    state.academicSummary;

  const average =
    summary?.overall_average !==
      null &&
    summary?.overall_average !==
      undefined
      ? `${Number(
          summary.overall_average
        ).toFixed(2)}%`
      : "—";


  const gpa =
    summary?.gpa !== null &&
    summary?.gpa !== undefined
      ? Number(
          summary.gpa
        ).toFixed(2)
      : "—";


  const letter =
    summary?.overall_letter_grade ||
    "—";


  const tests =
    summary?.total_tests ??
    summary?.tests_completed ??
    0;


  const consistency =
    summary?.score_consistency !==
      null &&
    summary?.score_consistency !==
      undefined
      ? Number(
          summary.score_consistency
        ).toFixed(2)
      : "—";


  const latest =
    state.latestScore?.score;


  return `
    <div class="status-list">

      <div class="status-item">
        <span class="status-label">
          Overall Average
        </span>

        <strong class="status-value">
          ${average}
        </strong>
      </div>


      <div class="status-item">
        <span class="status-label">
          GPA
        </span>

        <strong class="status-value">
          ${gpa}
        </strong>
      </div>


      <div class="status-item">
        <span class="status-label">
          Letter Grade
        </span>

        <strong class="status-value">
          ${letter}
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
          Score Consistency
        </span>

        <strong class="status-value">
          ${consistency}
        </strong>
      </div>


      <div class="status-item">
        <span class="status-label">
          Latest Score
        </span>

        <strong class="status-value">
          ${
            latest !== undefined &&
            latest !== null
              ? `${Number(
                  latest
                ).toFixed(2)}%`
              : "—"
          }
        </strong>
      </div>

    </div>
  `;
}


/* =========================================================
   FEED
   ========================================================= */

function renderFeedPanel() {
  return `
    <div>

      <form
        id="create-post-form"
        class="feed-composer"
      >

        <textarea
          id="post-content"
          placeholder="Share something with the class..."
          rows="3"
        ></textarea>


        <div class="feed-composer-footer">

          <button
            type="submit"
            class="small-button"
          >
            Post
          </button>

        </div>

      </form>


      <div>

        ${
          state.feedPosts.length
            ? state.feedPosts
                .map(renderFeedPost)
                .join("")
            : `
              <div class="empty-state">
                📰
                <br />
                <br />
                No posts yet.
                Be the first to say something!
              </div>
            `
        }

      </div>

    </div>
  `;
}


function renderFeedPost(post) {
  const profile =
    post.profile || {};

  const name =
    profile.display_name ||
    profile.full_name ||
    profile.name ||
    "Student";


  const reactions =
    post.feed_reactions || [];


  const heartCount =
    reactions.filter(
      reaction =>
        reaction.reaction ===
        "heart"
    ).length;


  const currentUserReacted =
    reactions.some(
      reaction =>
        reaction.user_id ===
          state.user?.id &&
        reaction.reaction ===
          "heart"
    );


  return `
    <article class="feed-post">

      <div class="post-header">

        <div class="avatar">
          ${escapeHtml(
            getInitials(name)
          )}
        </div>


        <div>

          <div class="post-user">
            ${escapeHtml(name)}
          </div>

          <div class="post-time">
            ${formatDateTime(
              post.created_at
            )}
          </div>

        </div>

      </div>


      <div class="post-content">
        ${escapeHtml(
          post.content
        )}
      </div>


      <div class="post-actions">

        <button
          class="post-action ${
            currentUserReacted
              ? "active"
              : ""
          }"
          data-react-post="${escapeHtml(
            post.id
          )}"
        >

          <span class="reaction-heart">
            ${
              currentUserReacted
                ? "❤️"
                : "♡"
            }
          </span>

          <span class="reaction-count">
            ${
              heartCount
                ? heartCount
                : ""
            }
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
    <div class="active-list">

      ${
        state.activeUsers.length
          ? state.activeUsers
              .map(user => {

                const profile =
                  user.profile ||
                  {};

                const name =
                  profile.display_name ||
                  profile.full_name ||
                  profile.name ||
                  "Student";

                const status =
                  user.status ||
                  "offline";

                return `
                  <div class="active-user">

                    <div class="avatar">
                      ${escapeHtml(
                        getInitials(
                          name
                        )
                      )}
                    </div>

                    <div class="active-user-info">

                      <div
                        class="active-user-name"
                      >
                        ${escapeHtml(
                          name
                        )}
                      </div>

                      <div
                        class="active-user-status"
                      >
                        ${escapeHtml(
                          status
                        )}
                      </div>

                    </div>

                    <span
                      class="status-dot ${escapeHtml(
                        status
                      )}"
                    ></span>

                  </div>
                `;
              })
              .join("")
          : `
            <div class="empty-state">
              👥
              <br /><br />
              No active classmates yet.
            </div>
          `
      }

    </div>
  `;
}


/* =========================================================
   CHAPTER TRACKER
   ========================================================= */

function renderChapterTracker() {
  const tracker =
    state.tracker;

  const scores =
    tracker.scores || [];

  const chapters =
    tracker.chapters || [];


  const average =
    calculateAverage(scores);


  const completedChapterIds =
    new Set(
      scores.map(
        score =>
          String(
            score.chapter_id
          )
      )
    );


  const completedCount =
    chapters.filter(
      chapter =>
        completedChapterIds.has(
          String(chapter.id)
        )
    ).length;


  return `
    <section>

      <div class="page-header">

        <h1>
          📖 Chapter Tracker
        </h1>

        <p>
          Track your chapter test scores
          and academic progress.
        </p>

      </div>


      ${
        tracker.message
          ? `
            <div
              class="tracker-message ${
                tracker.messageType ===
                "error"
                  ? "error"
                  : "success"
              }"
            >
              ${escapeHtml(
                tracker.message
              )}
            </div>
          `
          : ""
      }


      <div
        class="tracker-summary-grid"
      >

        <div
          class="panel tracker-stat-card"
        >
          <span>
            Chapters Completed
          </span>

          <strong>
            ${completedCount}
            /
            ${chapters.length}
          </strong>
        </div>


        <div
          class="panel tracker-stat-card"
        >
          <span>
            Tests Recorded
          </span>

          <strong>
            ${scores.length}
          </strong>
        </div>


        <div
          class="panel tracker-stat-card"
        >
          <span>
            Current Average
          </span>

          <strong>
            ${
              average === null
                ? "—"
                : `${average.toFixed(
                    2
                  )}%`
            }
          </strong>
        </div>

      </div>


      <div
        class="panel"
        style="margin-bottom: 20px;"
      >

        <div class="panel-header">

          <div>
            <h2>
              ${
                tracker.editingScoreId
                  ? "✏️ Edit Score"
                  : "➕ Add Chapter Score"
              }
            </h2>

            <p
              style="
                color: var(--text-secondary);
                margin-top: 4px;
                font-size: 13px;
              "
            >
              Scores are saved to
              your existing academic record.
            </p>
          </div>

        </div>


        <div class="panel-body">

          ${
            tracker.classes.length ===
            0
              ? `
                <div
                  class="empty-state"
                >
                  🏫
                  <br /><br />

                  <strong>
                    No classes found
                  </strong>

                  <br /><br />

                  You need to be enrolled
                  in a class before
                  recording scores.
                </div>
              `
              : `
                <form
                  id="score-form"
                >

                  <div
                    class="form-grid"
                  >

                    <div
                      class="form-group"
                    >

                      <label
                        for="tracker-class"
                      >
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
                          .map(
                            classItem => `
                              <option
                                value="${escapeHtml(
                                  classItem.id
                                )}"
                                ${
                                  tracker.selectedClassId ===
                                  classItem.id
                                    ? "selected"
                                    : ""
                                }
                              >
                                ${escapeHtml(
                                  classItem.name
                                )}
                              </option>
                            `
                          )
                          .join("")}

                      </select>

                    </div>


                    <div
                      class="form-group"
                    >

                      <label
                        for="tracker-chapter"
                      >
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
                          .map(
                            chapter => `
                              <option
                                value="${escapeHtml(
                                  chapter.id
                                )}"
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
                            `
                          )
                          .join("")}

                      </select>

                    </div>


                    <div
                      class="form-group"
                    >

                      <label
                        for="tracker-score"
                      >
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


                    <div
                      class="form-group"
                    >

                      <label
                        for="tracker-date"
                      >
                        Test Date
                      </label>

                      <input
                        id="tracker-date"
                        type="date"
                        value="${getToday()}"
                        required
                      />

                    </div>

                  </div>


                  <div
                    class="form-actions"
                  >

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

            <h2>
              📚 Chapter Progress
            </h2>

            <p
              style="
                color: var(--text-secondary);
                margin-top: 4px;
                font-size: 13px;
              "
            >
              Your recorded scores by chapter.
            </p>

          </div>

        </div>


        <div class="panel-body">

          ${
            chapters.length === 0
              ? `
                <div
                  class="empty-state"
                >
                  📖
                  <br /><br />
                  No chapters have been added yet.
                </div>
              `
              : `
                <div class="chapter-list">

                  ${chapters
                    .map(
                      chapter =>
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


function renderChapterCard(
  chapter,
  scores
) {
  const chapterScores =
    scores
      .filter(
        score =>
          String(
            score.chapter_id
          ) ===
          String(chapter.id)
      )
      .sort(
        (a, b) =>
          new Date(
            b.test_date
          ) -
          new Date(
            a.test_date
          )
      );


  const latest =
    chapterScores[0] ||
    null;


  const completed =
    chapterScores.length > 0;


  return `
    <div class="chapter-card">

      <div
        class="chapter-card-header"
      >

        <div>

          <div class="chapter-number">
            CHAPTER
            ${escapeHtml(
              chapter.chapter_number
            )}
          </div>

          <h3>
            ${escapeHtml(
              chapter.title
            )}
          </h3>

        </div>


        <span
          class="status-badge ${
            completed
              ? "completed"
              : ""
          }"
          style="
            ${
              completed
                ? ""
                : `
                  color: var(--text-muted);
                  background: rgba(168,183,199,0.08);
                `
            }
          "
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

              <div
                class="chapter-score-main"
              >

                <strong>
                  ${Number(
                    latest.score
                  ).toFixed(2)}%
                </strong>

                <span
                  class="grade-pill ${getGradeClass(
                    latest.score
                  )}"
                >
                  ${getLetterGrade(
                    latest.score
                  )}
                </span>

              </div>


              <div
                class="chapter-test-date"
              >
                Tested
                ${formatDate(
                  latest.test_date
                )}
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
            <div
              class="score-history"
            >

              <div
                class="score-history-title"
              >
                Score History
              </div>


              ${chapterScores
                .map(
                  score => `
                    <div
                      class="score-history-row"
                    >

                      <div
                        class="score-history-info"
                      >

                        <strong>
                          ${Number(
                            score.score
                          ).toFixed(2)}%
                        </strong>

                        <span
                          class="grade-pill ${getGradeClass(
                            score.score
                          )}"
                        >
                          ${getLetterGrade(
                            score.score
                          )}
                        </span>

                        <span>
                          ${formatDate(
                            score.test_date
                          )}
                        </span>

                      </div>


                      <div
                        class="score-history-actions"
                      >

                        <button
                          type="button"
                          class="small-button"
                          data-edit-score="${escapeHtml(
                            score.id
                          )}"
                        >
                          Edit
                        </button>


                        <button
                          type="button"
                          class="small-button danger-button"
                          data-delete-score="${escapeHtml(
                            score.id
                          )}"
                        >
                          Delete
                        </button>

                      </div>

                    </div>
                  `
                )
                .join("")}

            </div>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   TRACKER DATA
   ========================================================= */

async function loadTrackerClasses() {
  if (!state.user) {
    return;
  }

  const {
    data: enrollments,
    error
  } =
    await supabase
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
      "Unable to load enrollments:",
      error
    );

    state.tracker.classes = [];
    return;
  }


  const classIds = [
    ...new Set(
      (enrollments || [])
        .map(
          row =>
            row.class_id
        )
        .filter(Boolean)
    )
  ];


  if (!classIds.length) {
    state.tracker.classes = [];
    return;
  }


  const {
    data: classes,
    error: classError
  } =
    await supabase
      .from("classes")
      .select(
        "id, name, invite_code"
      )
      .in(
        "id",
        classIds
      )
      .order(
        "name"
      );


  if (classError) {
    console.error(
      "Unable to load classes:",
      classError
    );

    state.tracker.classes = [];
    return;
  }


  state.tracker.classes =
    classes || [];


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
  } =
    await supabase
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
      "Unable to load chapters:",
      error
    );

    state.tracker.chapters = [];
    return;
  }


  state.tracker.chapters =
    data || [];
}


async function loadTrackerScores() {
  if (!state.user) {
    return;
  }


  if (
    !state.tracker.selectedClassId
  ) {
    state.tracker.scores = [];
    return;
  }


  const {
    data,
    error
  } =
    await supabase
      .from("scores")
      .select("*")
      .eq(
        "user_id",
        state.user.id
      )
      .eq(
        "class_id",
        state.tracker.selectedClassId
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


  if (error) {
    console.error(
      "Unable to load scores:",
      error
    );

    state.tracker.scores = [];
    return;
  }


  state.tracker.scores =
    data || [];
}


async function loadChapterTracker() {
  state.tracker.loading = true;

  await loadTrackerClasses();

  await loadTrackerChapters();

  await loadTrackerScores();

  state.tracker.loading = false;

  renderApp();
}


/* =========================================================
   ADD / EDIT SCORE
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


  const