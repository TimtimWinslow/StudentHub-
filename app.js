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

let supabase = null;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {
  user: null,
  profile: null,
  currentPage: "home",

  classes: [],
  selectedClassId: null,

  academicSummary: null,
  latestScore: null,

  feedPosts: [],
  activeUsers: [],

  tracker: {
    classes: [],
    chapters: [],
    scores: [],
    selectedClassId: null,
    editingScoreId: null
  },

  initialized: false
};


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
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
      state.profile.username ||
      state.user?.email?.split("@")[0] ||
      "Student"
    );
  }

  return state.user?.email?.split("@")[0] || "Student";
}

function getInitials(name) {
  if (!name) return "?";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");
}


/* =========================================================
   VISIBLE BOOT ERROR
   ========================================================= */

function showBootError(title, message) {
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
    <div
      style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        box-sizing:border-box;
        background:#071a2b;
        color:#f5f9fc;
        font-family:Arial,sans-serif;
      "
    >
      <div
        style="
          width:100%;
          max-width:560px;
          background:#102b42;
          border:1px solid #1d4662;
          border-radius:14px;
          padding:28px;
          box-sizing:border-box;
          box-shadow:0 20px 50px rgba(0,0,0,.35);
        "
      >
        <div
          style="
            width:52px;
            height:52px;
            border-radius:14px;
            background:#00a6a6;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:25px;
            margin-bottom:18px;
          "
        >
          ⚠️
        </div>

        <h1
          style="
            margin:0 0 10px;
            font-size:25px;
          "
        >
          ${escapeHTML(title)}
        </h1>

        <p
          style="
            margin:0;
            color:#a8bdcc;
            line-height:1.6;
          "
        >
          ${escapeHTML(message)}
        </p>

        <button
          onclick="location.reload()"
          style="
            margin-top:20px;
            padding:12px 18px;
            border:0;
            border-radius:10px;
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


/* =========================================================
   SUPABASE INITIALIZATION
   ========================================================= */

function createSupabaseClient() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    throw new Error(
      "The Supabase library did not load. Please make sure the Supabase script is present in index.html."
    );
  }

  return window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}


/* =========================================================
   AUTH
   ========================================================= */

async function checkCurrentUser() {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("getUser error:", error);
    return null;
  }

  return data?.user || null;
}

async function handleLogin(email, password) {
  const message = $("#auth-message");

  if (message) {
    message.textContent = "Signing in...";
    message.className = "auth-message";
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("Login error:", error);

    if (message) {
      message.textContent = error.message;
      message.className = "auth-message error";
    }

    return;
  }

  state.user = data.user;

  await initializeAuthenticatedApp();
}

async function handleForgotPassword(email) {
  const message = $("#auth-message");

  if (!email) {
    if (message) {
      message.textContent = "Enter your email address first.";
      message.className = "auth-message error";
    }
    return;
  }

  if (message) {
    message.textContent = "Sending password reset email...";
    message.className = "auth-message";
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    console.error("Password reset error:", error);

    if (message) {
      message.textContent = error.message;
      message.className = "auth-message error";
    }

    return;
  }

  if (message) {
    message.textContent =
      "Password reset instructions have been sent to your email.";
    message.className = "auth-message success";
  }
}


/* =========================================================
   LOGIN PAGE
   ========================================================= */

function renderLogin() {
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-logo">
          <div class="brand-icon">SH</div>
          <div>
            <h1>StudentHub</h1>
            <p class="auth-subtitle">
              Your class. Your progress. Your community.
            </p>
          </div>
        </div>

        <form id="login-form" class="auth-form">

          <div class="form-group">
            <label for="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autocomplete="email"
              placeholder="Enter your email"
              required
            />
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
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

        <button
          id="forgot-password-button"
          class="text-button"
          type="button"
        >
          Forgot password?
        </button>

        <div id="auth-message" class="auth-message"></div>

      </div>
    </div>
  `;

  const form = $("#login-form");

  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const email = $("#login-email")?.value.trim();
      const password = $("#login-password")?.value;

      if (!email || !password) {
        const message = $("#auth-message");

        if (message) {
          message.textContent = "Please enter your email and password.";
          message.className = "auth-message error";
        }

        return;
      }

      await handleLogin(email, password);
    });
  }

  const forgotButton = $("#forgot-password-button");

  if (forgotButton) {
    forgotButton.addEventListener("click", async () => {
      const email = $("#login-email")?.value.trim();

      await handleForgotPassword(email);
    });
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

  if (error) {
    console.error("Profile load error:", error);
    return;
  }

  state.profile = data || {
    id: state.user.id,
    display_name: state.user.email?.split("@")[0] || "Student"
  };
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  return `
    <aside class="sidebar">

      <div class="sidebar-brand">
        <div class="brand-icon">SH</div>

        <div class="brand-text">
          <strong>StudentHub</strong>
          <span>Student Portal</span>
        </div>
      </div>

      <nav class="sidebar-nav">

        <button
          class="nav-item ${state.currentPage === "home" ? "active" : ""}"
          data-page="home"
        >
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        <button
          class="nav-item ${state.currentPage === "calendar" ? "active" : ""}"
          data-page="calendar"
        >
          <span class="nav-icon">📅</span>
          <span>Calendar</span>
        </button>

        <button
          class="nav-item ${state.currentPage === "care-team" ? "active" : ""}"
          data-page="care-team"
        >
          <span class="nav-icon">💬</span>
          <span>The Care Team</span>
        </button>

        <div class="nav-section">

          <button
            class="nav-item study-tools-toggle"
            type="button"
          >
            <span class="nav-icon">📚</span>
            <span>Study Tools</span>
            <span class="nav-chevron">▾</span>
          </button>

          <div class="study-tools-menu">

            <button
              class="nav-subitem"
              data-page="flashcards"
            >
              🧠 Flashcards
            </button>

            <button
              class="nav-subitem"
              data-page="quiz-maker"
            >
              📝 Quiz Maker
            </button>

            <button
              class="nav-subitem"
              data-page="study-timer"
            >
              ⏱️ Study Timer
            </button>

            <button
              class="nav-subitem"
              data-page="study-checklist"
            >
              ✅ Study Checklist
            </button>

            <button
              class="nav-subitem"
              data-page="chapter-tracker"
            >
              📖 Chapter Tracker
            </button>

          </div>
        </div>

        <button
          class="nav-item ${state.currentPage === "progress" ? "active" : ""}"
          data-page="progress"
        >
          <span class="nav-icon">📈</span>
          <span>Progress</span>
        </button>

      </nav>

    </aside>
  `;
}


/* =========================================================
   TOPBAR
   ========================================================= */

function renderTopbar() {
  const displayName = getDisplayName();

  return `
    <header class="topbar">

      <button
        class="mobile-menu-button"
        id="mobile-menu-button"
        type="button"
      >
        ☰
      </button>

      <div class="topbar-title">
        ${escapeHTML(
          state.currentPage === "home"
            ? "Home"
            : getPageTitle(state.currentPage)
        )}
      </div>

      <div class="topbar-actions">

        <button
          class="topbar-button"
          id="messages-button"
          type="button"
          title="Messages"
        >
          💬
        </button>

        <button
          class="topbar-button"
          id="notifications-button"
          type="button"
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

        <button
          class="topbar-button account-button"
          id="account-button"
          type="button"
          title="Account"
        >
          <span class="topbar-avatar">
            ${escapeHTML(getInitials(displayName))}
          </span>
        </button>

      </div>

      <div
        id="account-menu"
        class="account-menu"
        style="display:none;"
      >

        <div class="account-menu-header">
          <strong>${escapeHTML(displayName)}</strong>
          <span>${escapeHTML(state.user?.email || "")}</span>
        </div>

        <button data-account-action="profile">
          👤 My Profile
        </button>

        <button data-account-action="account-details">
          ⚙️ Account Details
        </button>

        <button data-account-action="security">
          🔐 Password & Security
        </button>

        <button data-account-action="privacy">
          🛡️ Privacy
        </button>

        <button data-account-action="appearance">
          🎨 Appearance
        </button>

        <button data-account-action="export">
          📦 Export My Data
        </button>

        <button
          data-account-action="signout"
          class="danger-button"
        >
          🚪 Sign Out
        </button>

      </div>

    </header>
  `;
}


/* =========================================================
   PAGE TITLES
   ========================================================= */

function getPageTitle(page) {
  const titles = {
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

  return titles[page] || "StudentHub";
}


/* =========================================================
   APP SHELL
   ========================================================= */

function renderAppShell() {
  const app = document.getElementById("app");

  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div class="main-area">

        ${renderTopbar()}

        <main
          id="page-content"
          class="page"
        >
          <div class="loading-state">
            Loading StudentHub...
          </div>
        </main>

      </div>

      <div
        id="mobile-overlay"
        class="mobile-overlay"
        style="display:none;"
      ></div>

    </div>
  `;

  attachNavigationListeners();
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function attachNavigationListeners() {
  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", async () => {
      const page = button.dataset.page;

      if (!page) return;

      state.currentPage = page;

      closeAccountMenu();
      closeMobileMenu();

      renderAppShell();

      await renderCurrentPage();
    });
  });

  const mobileMenuButton = $("#mobile-menu-button");

  if (mobileMenuButton) {
    mobileMenuButton.addEventListener("click", toggleMobileMenu);
  }

  const mobileOverlay = $("#mobile-overlay");

  if (mobileOverlay) {
    mobileOverlay.addEventListener("click", closeMobileMenu);
  }

  const accountButton = $("#account-button");

  if (accountButton) {
    accountButton.addEventListener("click", event => {
      event.stopPropagation();
      toggleAccountMenu();
    });
  }

  const messagesButton = $("#messages-button");

  if (messagesButton) {
    messagesButton.addEventListener("click", () => {
      state.currentPage = "care-team";
      renderAppShell();
      renderCurrentPage();
    });
  }

  const notificationsButton = $("#notifications-button");

  if (notificationsButton) {
    notificationsButton.addEventListener("click", () => {
      alert("Notifications are coming next.");
    });
  }

  document
    .querySelectorAll("[data-account-action]")
    .forEach(button => {
      button.addEventListener("click", () => {
        handleAccountAction(button.dataset.accountAction);
      });
    });

  const studyToolsToggle = document.querySelector(
    ".study-tools-toggle"
  );

  if (studyToolsToggle) {
    studyToolsToggle.addEventListener("click", () => {
      const menu = document.querySelector(".study-tools-menu");

      if (!menu) return;

      menu.classList.toggle("open");
    });
  }
}

function toggleAccountMenu() {
  const menu = $("#account-menu");

  if (!menu) return;

  menu.style.display =
    menu.style.display === "none" ? "block" : "none";
}

function closeAccountMenu() {
  const menu = $("#account-menu");

  if (menu) {
    menu.style.display = "none";
  }
}

function toggleMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = $("#mobile-overlay");

  if (!sidebar || !overlay) return;

  sidebar.classList.toggle("open");

  overlay.style.display =
    overlay.style.display === "none" ? "block" : "none";
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = $("#mobile-overlay");

  if (sidebar) {
    sidebar.classList.remove("open");
  }

  if (overlay) {
    overlay.style.display = "none";
  }
}


/* =========================================================
   CURRENT PAGE
   ========================================================= */

async function renderCurrentPage() {
  const content = $("#page-content");

  if (!content) return;

  try {
    switch (state.currentPage) {
      case "home":
        await renderHomePage();
        break;

      case "calendar":
        renderPlaceholderPage(
          "Calendar",
          "Your class calendar and important dates will appear here."
        );
        break;

      case "care-team":
        renderPlaceholderPage(
          "The Care Team",
          "Class messaging and community features will appear here."
        );
        break;

      case "flashcards":
        renderPlaceholderPage(
          "Flashcards",
          "Create and study flashcard decks here."
        );
        break;

      case "quiz-maker":
        renderPlaceholderPage(
          "Quiz Maker",
          "Create practice quizzes and test yourself here."
        );
        break;

      case "study-timer":
        renderPlaceholderPage(
          "Study Timer",
          "Track focused study sessions here."
        );
        break;

      case "study-checklist":
        renderPlaceholderPage(
          "Study Checklist",
          "Keep track of your study tasks here."
        );
        break;

      case "chapter-tracker":
        await loadChapterTracker();
        break;

      case "progress":
        await renderProgressPage();
        break;

      case "account":
        renderAccountPage();
        break;

      default:
        await renderHomePage();
        break;
    }
  } catch (error) {
    console.error("Page rendering error:", error);

    content.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <h2>Something went wrong</h2>
          <p>
            StudentHub could not load this page.
          </p>
          <button
            class="primary-button"
            onclick="location.reload()"
          >
            Reload
          </button>
        </div>
      </div>
    `;
  }
}


/* =========================================================
   HOME PAGE
   ========================================================= */

async function renderHomePage() {
  const content = $("#page-content");

  if (!content) return;

  content.innerHTML = `
    <section class="welcome-section">
      <div>
        <p class="eyebrow">StudentHub</p>

        <h1>
          ${escapeHTML(getGreeting())},
          ${escapeHTML(getDisplayName())} 👋
        </h1>

        <p>
          Your class. Your progress. Your community.
        </p>
      </div>
    </section>

    <section class="home-grid">

      <div class="panel status-panel">
        <div class="panel-header">
          <h2>📊 Status Report</h2>
        </div>

        <div
          id="status-report"
          class="panel-body"
        >
          <div class="loading-state">
            Loading academic information...
          </div>
        </div>
      </div>

      <div class="panel feed-panel">

        <div class="panel-header">
          <h2>📰 Main Feed</h2>
        </div>

        <div class="panel-body">

          <form id="create-post-form">
            <textarea
              id="post-content"
              placeholder="Share something with the class..."
              rows="3"
            ></textarea>

            <div class="form-actions">
              <button
                type="submit"
                class="primary-button"
              >
                Create Post
              </button>
            </div>
          </form>

          <div
            id="feed-list"
            style="margin-top:20px;"
          >
            <div class="loading-state">
              Loading feed...
            </div>
          </div>

        </div>
      </div>

      <div class="panel active-panel">

        <div class="panel-header">
          <h2>🟢 Who's Active</h2>
        </div>

        <div
          id="active-users"
          class="panel-body"
        >
          <div class="loading-state">
            Loading active students...
          </div>
        </div>

      </div>

    </section>
  `;

  attachHomeListeners();

  await Promise.allSettled([
    renderStatusReport(),
    loadFeed(),
    loadActiveUsers(),
    updatePresence()
  ]);
}


/* =========================================================
   HOME LISTENERS
   ========================================================= */

function attachHomeListeners() {
  const form = $("#create-post-form");

  if (form) {
    form.addEventListener("submit", handleCreatePost);
  }
}


/* =========================================================
   STATUS REPORT
   ========================================================= */

async function renderStatusReport() {
  const container = $("#status-report");

  if (!container) return;

  const summary = await loadAcademicSummary();
  const latest = await loadLatestScore();

  if (!summary) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No academic data yet.</strong>
        <p>
          Once you enter scores in Chapter Tracker,
          your academic snapshot will appear here.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="stats-grid">

      <div class="stat-card">
        <span>Overall Average</span>
        <strong>
          ${summary.overall_average != null
            ? Number(summary.overall_average).toFixed(2) + "%"
            : "—"}
        </strong>
      </div>

      <div class="stat-card">
        <span>GPA</span>
        <strong>
          ${summary.gpa != null
            ? Number(summary.gpa).toFixed(2)
            : "—"}
        </strong>
      </div>

      <div class="stat-card">
        <span>Letter Grade</span>
        <strong>
          ${escapeHTML(summary.overall_letter_grade || "—")}
        </strong>
      </div>

      <div class="stat-card">
        <span>Tests Completed</span>
        <strong>
          ${summary.total_tests ?? 0}
        </strong>
      </div>

      <div class="stat-card">
        <span>Score Consistency</span>
        <strong>
          ${summary.score_consistency != null
            ? Number(summary.score_consistency).toFixed(2)
            : "—"}
        </strong>
      </div>

      <div class="stat-card">
        <span>Latest Score</span>
        <strong>
          ${latest?.score != null
            ? Number(latest.score).toFixed(0) + "%"
            : "—"}
        </strong>
      </div>

    </div>
  `;
}


/* =========================================================
   ACADEMIC SUMMARY
   ========================================================= */

async function loadAcademicSummary() {
  if (!state.user) return null;

  try {
    const { data, error } = await supabase
      .from("student_academic_summary")
      .select("*")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (error) {
      console.error("Academic summary error:", error);
      return null;
    }

    state.academicSummary = data;

    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function loadLatestScore() {
  if (!state.user) return null;

  try {
    const { data, error } = await supabase
      .from("student_score_details")
      .select("*")
      .eq("user_id", state.user.id)
      .order("test_date", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Latest score error:", error);
      return null;
    }

    state.latestScore = data;

    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}


/* =========================================================
   MAIN FEED
   ========================================================= */

async function loadFeed() {
  const container = $("#feed-list");

  if (!container || !state.user) return;

  try {
    const { data, error } = await supabase
      .from("feed_posts")
      .select(`
        *,
        profiles:user_id (
          id,
          display_name,
          full_name,
          avatar_url
        )
      `)
      .order("created_at", {
        ascending: false
      })
      .limit(25);

    if (error) {
      console.error("Feed error:", error);

      container.innerHTML = `
        <div class="empty-state">
          Feed could not be loaded.
        </div>
      `;

      return;
    }

    state.feedPosts = data || [];

    if (!state.feedPosts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>No posts yet.</strong>
          <p>Be the first person to post something.</p>
        </div>
      `;

      return;
    }

    container.innerHTML = state.feedPosts
      .map(renderFeedPost)
      .join("");

    attachFeedListeners();

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        Feed could not be loaded.
      </div>
    `;
  }
}

function renderFeedPost(post) {
  const profile = post.profiles || {};

  const name =
    profile.display_name ||
    profile.full_name ||
    "Student";

  const avatar = profile.avatar_url
    ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
    : `<span>${escapeHTML(getInitials(name))}</span>`;

  return `
    <article
      class="feed-post"
      data-post-id="${escapeHTML(post.id)}"
    >

      <div class="feed-post-header">

        <div class="feed-avatar">
          ${avatar}
        </div>

        <div class="feed-author">
          <strong>${escapeHTML(name)}</strong>

          <small>
            ${escapeHTML(formatDateTime(post.created_at))}
          </small>
        </div>

        ${
          post.user_id === state.user?.id
            ? `
              <button
                class="icon-button delete-post-button"
                data-post-id="${escapeHTML(post.id)}"
                title="Delete post"
              >
                🗑️
              </button>
            `
            : ""
        }

      </div>

      <div class="feed-post-content">
        ${escapeHTML(post.content)}
      </div>

      <div class="feed-post-actions">

        <button
          class="reaction-button"
          data-post-id="${escapeHTML(post.id)}"
          data-reaction="❤️"
        >
          ❤️
        </button>

        <button
          class="reaction-button"
          data-post-id="${escapeHTML(post.id)}"
          data-reaction="👍"
        >
          👍
        </button>

        <button
          class="reaction-button"
          data-post-id="${escapeHTML(post.id)}"
          data-reaction="😂"
        >
          😂
        </button>

      </div>

    </article>
  `;
}

function attachFeedListeners() {
  document
    .querySelectorAll(".reaction-button")
    .forEach(button => {
      button.addEventListener("click", async () => {
        await handleFeedReaction(
          button.dataset.postId,
          button.dataset.reaction
        );
      });
    });

  document
    .querySelectorAll(".delete-post-button")
    .forEach(button => {
      button.addEventListener("click", async () => {
        await handleDeletePost(button.dataset.postId);
      });
    });
}

async function handleCreatePost(event) {
  event.preventDefault();

  const input = $("#post-content");

  if (!input || !state.user) return;

  const content = input.value.trim();

  if (!content) return;

  const button = event.submitter;

  if (button) {
    button.disabled = true;
  }

  const { error } = await supabase
    .from("feed_posts")
    .insert({
      user_id: state.user.id,
      content
    });

  if (error) {
    console.error("Create post error:", error);
    alert(error.message);

    if (button) {
      button.disabled = false;
    }

    return;
  }

  input.value = "";

  await loadFeed();

  if (button) {
    button.disabled = false;
  }
}

async function handleFeedReaction(postId, reaction) {
  if (!state.user) return;

  const { error } = await supabase
    .from("feed_reactions")
    .upsert(
      {
        post_id: postId,
        user_id: state.user.id,
        reaction
      },
      {
        onConflict: "post_id,user_id,reaction"
      }
    );

  if (error) {
    console.error("Reaction error:", error);
  }
}

async function handleDeletePost(postId) {
  if (!state.user) return;

  const confirmed = confirm(
    "Delete this post?"
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("feed_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Delete post error:", error);
    alert(error.message);
    return;
  }

  await loadFeed();
}


/* =========================================================
   ACTIVE USERS
   ========================================================= */

async function loadActiveUsers() {
  const container = $("#active-users");

  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("user_presence")
      .select(`
        user_id,
        status,
        last_seen_at,
        profiles:user_id (
          display_name,
          full_name,
          avatar_url
        )
      `)
      .order("last_seen_at", {
        ascending: false
      })
      .limit(20);

    if (error) {
      console.error("Presence load error:", error);

      container.innerHTML = `
        <div class="empty-state">
          Active status is unavailable right now.
        </div>
      `;

      return;
    }

    state.activeUsers = data || [];

    if (!state.activeUsers.length) {
      container.innerHTML = `
        <div class="empty-state">
          No active students to show.
        </div>
      `;

      return;
    }

    container.innerHTML = state.activeUsers
      .map(user => {
        const profile = user.profiles || {};

        const name =
          profile.display_name ||
          profile.full_name ||
          "Student";

        return `
          <div class="active-user">

            <div class="active-avatar">
              ${
                profile.avatar_url
                  ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
                  : escapeHTML(getInitials(name))
              }

              <span
                class="presence-dot ${escapeHTML(user.status || "offline")}"
              ></span>
            </div>

            <div class="active-user-info">
              <strong>${escapeHTML(name)}</strong>
              <span>${escapeHTML(user.status || "offline")}</span>
            </div>

          </div>
        `;
      })
      .join("");

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        Active status is unavailable.
      </div>
    `;
  }
}

async function updatePresence() {
  if (!state.user || !supabase) return;

  try {
    await supabase
      .from("user_presence")
      .upsert({
        user_id: state.user.id,
        status: "online",
        last_seen_at: new Date().toISOString()
      });
  } catch (error) {
    console.error("Presence update error:", error);
  }
}


/* =========================================================
   CHAPTER TRACKER
   ========================================================= */

async function loadChapterTracker() {
  const content = $("#page-content");

  if (!content || !state.user) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Study Tools</p>
        <h1>Chapter Tracker</h1>
        <p>
          Enter and manage your test scores.
        </p>
      </div>
    </div>

    <div id="chapter-tracker-content">
      <div class="loading-state">
        Loading Chapter Tracker...
      </div>
    </div>
  `;

  await Promise.all([
    loadTrackerClasses(),
    loadTrackerChapters(),
    loadTrackerScores()
  ]);

  renderChapterTracker();
}

async function loadTrackerClasses() {
  if (!state.user) return;

  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error("Tracker classes error:", error);
    state.tracker.classes = [];
    return;
  }

  state.tracker.classes = data || [];

  if (!state.tracker.selectedClassId && state.tracker.classes.length) {
    state.tracker.selectedClassId =
      state.tracker.classes[0].id;
  }
}

async function loadTrackerChapters() {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .order("chapter_number", {
      ascending: true
    });

  if (error) {
    console.error("Tracker chapters error:", error);
    state.tracker.chapters = [];
    return;
  }

  state.tracker.chapters = data || [];
}

async function loadTrackerScores() {
  if (!state.user) return;

  let query = supabase
    .from("scores")
    .select(`
      *,
      chapters (
        chapter_number,
        title
      ),
      classes (
        name
      )
    `)
    .eq("user_id", state.user.id)
    .order("test_date", {
      ascending: false
    });

  if (state.tracker.selectedClassId) {
    query = query.eq(
      "class_id",
      state.tracker.selectedClassId
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Tracker scores error:", error);
    state.tracker.scores = [];
    return;
  }

  state.tracker.scores = data || [];
}

function renderChapterTracker() {
  const container = $("#chapter-tracker-content");

  if (!container) return;

  const classes = state.tracker.classes;
  const chapters = state.tracker.chapters;
  const scores = state.tracker.scores;

  container.innerHTML = `
    <div class="panel">

      <div class="panel-header">
        <h2>Enter Test Score</h2>
      </div>

      <div class="panel-body">

        ${
          classes.length
            ? `
              <form id="score-form">

                <div class="form-row">

                  <div class="form-group">
                    <label for="score-class">
                      Class
                    </label>

                    <select id="score-class">
                      ${classes
                        .map(
                          classroom => `
                            <option
                              value="${escapeHTML(classroom.id)}"
                              ${
                                classroom.id ===
                                state.tracker.selectedClassId
                                  ? "selected"
                                  : ""
                              }
                            >
                              ${escapeHTML(classroom.name)}
                            </option>
                          `
                        )
                        .join("")}
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="score-chapter">
                      Chapter
                    </label>

                    <select
                      id="score-chapter"
                      required
                    >
                      <option value="">
                        Select chapter
                      </option>

                      ${chapters
                        .map(
                          chapter => `
                            <option
                              value="${escapeHTML(chapter.id)}"
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

                </div>

                <div class="form-row">

                  <div class="form-group">
                    <label for="score-value">
                      Score
                    </label>

                    <input
                      id="score-value"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Example: 94"
                      required
                    />
                  </div>

                  <div class="form-group">
                    <label for="score-date">
                      Test Date
                    </label>

                    <input
                      id="score-date"
                      type="date"
                      value="${new Date()
                        .toISOString()
                        .slice(0, 10)}"
                      required
                    />
                  </div>

                </div>

                <button
                  type="submit"
                  class="primary-button"
                >
                  Save Score
                </button>

              </form>
            `
            : `
              <div class="empty-state">
                No classes are available yet.
              </div>
            `
        }

      </div>
    </div>

    <div class="panel" style="margin-top:20px;">

      <div class="panel-header">
        <h2>Your Scores</h2>
      </div>

      <div class="panel-body">

        ${
          scores.length
            ? `
              <div class="score-list">
                ${renderChapterScoreList(scores)}
              </div>
            `
            : `
              <div class="empty-state">
                <strong>No scores recorded yet.</strong>
                <p>
                  Enter your first test score above.
                </p>
              </div>
            `
        }

      </div>

    </div>
  `;

  const form = $("#score-form");

  if (form) {
    form.addEventListener("submit", handleScoreSubmit);
  }

  const classSelect = $("#score-class");

  if (classSelect) {
    classSelect.addEventListener("change", async event => {
      state.tracker.selectedClassId =
        event.target.value || null;

      await loadTrackerScores();
      renderChapterTracker();
    });
  }

  document
    .querySelectorAll("[data-edit-score]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        await handleEditScore(button.dataset.editScore);
      });
    });

  document
    .querySelectorAll("[data-delete-score]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        await handleDeleteScore(button.dataset.deleteScore);
      });
    });
}

function renderChapterScoreList(scores) {
  return scores
    .map(score => {
      const chapter = score.chapters || {};

      return `
        <div class="score-row">

          <div>
            <strong>
              Chapter
              ${escapeHTML(
                chapter.chapter_number ?? "?"
              )}
            </strong>

            <span>
              ${escapeHTML(
                chapter.title || "Chapter"
              )}
            </span>
          </div>

          <div class="score-value">
            ${Number(score.score).toFixed(0)}%
          </div>

          <div class="score-date">
            ${escapeHTML(formatDate(score.test_date))}
          </div>

          <div class="score-actions">

            <button
              type="button"
              class="icon-button"
              data-edit-score="${escapeHTML(score.id)}"
            >
              ✏️
            </button>

            <button
              type="button"
              class="icon-button"
              data-delete-score="${escapeHTML(score.id)}"
            >
              🗑️
            </button>

          </div>

        </div>
      `;
    })
    .join("");
}

async function handleScoreSubmit(event) {
  event.preventDefault();

  if (!state.user) return;

  const classId =
    $("#score-class")?.value ||
    state.tracker.selectedClassId;

  const chapterId =
    $("#score-chapter")?.value;

  const scoreValue =
    $("#score-value")?.value;

  const testDate =
    $("#score-date")?.value;

  if (
    !classId ||
    !chapterId ||
    !scoreValue ||
    !testDate
  ) {
    alert("Please complete all score fields.");
    return;
  }

  const numericScore = Number(scoreValue);

  if (
    Number.isNaN(numericScore) ||
    numericScore < 0 ||
    numericScore > 100
  ) {
    alert("Score must be between 0 and 100.");
    return;
  }

  const { error } = await supabase
    .from("scores")
    .insert({
      user_id: state.user.id,
      class_id: classId,
      chapter_id: Number(chapterId),
      score: numericScore,
      test_date: testDate
    });

  if (error) {
    console.error("Score insert error:", error);
    alert(error.message);
    return;
  }

  alert("Score saved!");

  state.tracker.selectedClassId = classId;

  await loadTrackerScores();
  renderChapterTracker();
}

async function handleEditScore(scoreId) {
  const score = state.tracker.scores.find(
    item => item.id === scoreId
  );

  if (!score) return;

  const newScore = prompt(
    "Enter the new score:",
    score.score
  );

  if (newScore === null) return;

  const numericScore = Number(newScore);

  if (
    Number.isNaN(numericScore) ||
    numericScore < 0 ||
    numericScore > 100
  ) {
    alert("Score must be between 0 and 100.");
    return;
  }

  const { error } = await supabase
    .from("scores")
    .update({
      score: numericScore,
      updated_at: new Date().toISOString()
    })
    .eq("id", scoreId)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Score update error:", error);
    alert(error.message);
    return;
  }

  await loadTrackerScores();
  renderChapterTracker();
}

async function handleDeleteScore(scoreId) {
  const confirmed = confirm(
    "Delete this score?"
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("scores")
    .delete()
    .eq("id", scoreId)
    .eq("user_id", state.user.id);

  if (error) {
    console.error("Score delete error:", error);
    alert(error.message);
    return;
  }

  await loadTrackerScores();
  renderChapterTracker();
}


/* =========================================================
   PROGRESS PAGE
   ========================================================= */

async function renderProgressPage() {
  const content = $("#page-content");

  if (!content) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Academic Overview</p>
        <h1>Progress</h1>
        <p>
          Your academic performance at a glance.
        </p>
      </div>
    </div>

    <div id="progress-content">
      <div class="loading-state">
        Loading progress...
      </div>
    </div>
  `;

  const summary = await loadAcademicSummary();

  const progressContent = $("#progress-content");

  if (!progressContent) return;

  if (!summary) {
    progressContent.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <div class="empty-state">
            No academic data available yet.
          </div>
        </div>
      </div>
    `;

    return;
  }

  progressContent.innerHTML = `
    <div class="home-grid">

      <div class="panel">

        <div class="panel-header">
          <h2>Academic Summary</h2>
        </div>

        <div class="panel-body">

          <div class="stats-grid">

            <div class="stat-card">
              <span>Average</span>
              <strong>
                ${summary.overall_average != null
                  ? Number(summary.overall_average).toFixed(2) + "%"
                  : "—"}
              </strong>
            </div>

            <div class="stat-card">
              <span>GPA</span>
              <strong>
                ${summary.gpa != null
                  ? Number(summary.gpa).toFixed(2)
                  : "—"}
              </strong>
            </div>

            <div class="stat-card">
              <span>Letter Grade</span>
              <strong>
                ${escapeHTML(
                  summary.overall_letter_grade || "—"
                )}
              </strong>
            </div>

            <div class="stat-card">
              <span>Tests</span>
              <strong>
                ${summary.total_tests ?? 0}
              </strong>
            </div>

            <div class="stat-card">
              <span>Lowest</span>
              <strong>
                ${summary.lowest_score != null
                  ? Number(summary.lowest_score).toFixed(0) + "%"
                  : "—"}
              </strong>
            </div>

            <div class="stat-card">
              <span>Highest</span>
              <strong>
                ${summary.highest_score != null
                  ? Number(summary.highest_score).toFixed(0) + "%"
                  : "—"}
              </strong>
            </div>

            <div class="stat-card">
              <span>Score Consistency</span>
              <strong>
                ${summary.score_consistency != null
                  ? Number(summary.score_consistency).toFixed(2)
                  : "—"}
              </strong>
            </div>

          </div>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   ACCOUNT PAGE
   ========================================================= */

function renderAccountPage() {
  const content = $("#page-content");

  if (!content) return;

  const displayName = getDisplayName();

  content.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">Account</p>
        <h1>Account</h1>
        <p>
          Manage your StudentHub account.
        </p>
      </div>
    </div>

    <div class="panel">

      <div class="panel-header">
        <h2>Profile</h2>
      </div>

      <div class="panel-body">

        <div class="profile-summary">

          <div class="profile-avatar">
            ${escapeHTML(getInitials(displayName))}
          </div>

          <div>
            <h3>
              ${escapeHTML(displayName)}
            </h3>

            <p>
              ${escapeHTML(state.user?.email || "")}
            </p>
          </div>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   PLACEHOLDER PAGES
   ========================================================= */

function renderPlaceholderPage(title, description) {
  const content = $("#page-content");

  if (!content) return;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <p class="eyebrow">StudentHub</p>
        <h1>${escapeHTML(title)}</h1>
        <p>${escapeHTML(description)}</p>
      </div>
    </div>

    <div class="panel">

      <div class="panel-body">

        <div class="empty-state">

          <div
            style="
              font-size:42px;
              margin-bottom:12px;
            "
          >
            🚧
          </div>

          <strong>
            This feature is being built.
          </strong>

          <p>
            The StudentHub foundation is ready.
          </p>

        </div>

      </div>

    </div>
  `;
}


/* =========================================================
   ACCOUNT ACTIONS
   ========================================================= */

async function handleAccountAction(action) {
  closeAccountMenu();

  switch (action) {
    case "profile":
      state.currentPage = "account";
      renderAppShell();
      renderAccountPage();
      break;

    case "account-details":
      alert("Account Details will be available soon.");
      break;

    case "security":
      alert("Password & Security will be available soon.");
      break;

    case "privacy":
      alert("Privacy settings will be available soon.");
      break;

    case "appearance":
      alert("Appearance settings will be available soon.");
      break;

    case "export":
      await requestDataExport();
      break;

    case "signout":
      await handleSignOut();
      break;

    default:
      break;
  }
}

async function requestDataExport() {
  if (!state.user) return;

  const { error } = await supabase
    .from("data_export_requests")
    .insert({
      user_id: state.user.id
    });

  if (error) {
    console.error("Data export error:", error);
    alert(error.message);
    return;
  }

  alert(
    "Your data export request has been recorded."
  );
}

async function handleSignOut() {
  if (!supabase) return;

  await supabase.auth.signOut();

  state.user = null;
  state.profile = null;
  state.currentPage = "home";

  renderLogin();
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthListener() {
  if (!supabase) return;

  supabase.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "Supabase auth event:",
        event
      );

      if (session?.user) {
        state.user = session.user;

        if (!state.initialized) {
          await initializeAuthenticatedApp();
        }
      } else {
        state.user = null;
        state.profile = null;
        state.initialized = false;

        renderLogin();
      }
    }
  );
}


/* =========================================================
   AUTHENTICATED APP
   ========================================================= */

async function initializeAuthenticatedApp() {
  if (!state.user) {
    renderLogin();
    return;
  }

  try {
    await loadProfile();
  } catch (error) {
    console.error(
      "Profile initialization failed:",
      error
    );
  }

  state.initialized = true;
  state.currentPage = "home";

  renderAppShell();

  await renderCurrentPage();
}


/* =========================================================
   STARTUP
   ========================================================= */

async function initializeApp() {
  const app = document.getElementById("app");

  if (!app) {
    throw new Error(
      "StudentHub could not find the #app element."
    );
  }

  /*
    Show something immediately.
    This proves app.js itself is executing.
  */

  app.innerHTML = `
    <div
      style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#071a2b;
        color:#f5f9fc;
        font-family:Arial,sans-serif;
      "
    >
      <div style="text-align:center;">
        <div
          style="
            width:52px;
            height:52px;
            margin:0 auto 16px;
            border:4px solid #1d4662;
            border-top-color:#00a6a6;
            border-radius:50%;
            animation:studentHubSpin 1s linear infinite;
          "
        ></div>

        <h2 style="margin:0 0 8px;">
          Starting StudentHub...
        </h2>

        <p style="margin:0;color:#a8bdcc;">
          Connecting securely.
        </p>
      </div>
    </div>

    <style>
      @keyframes studentHubSpin {
        to {
          transform:rotate(360deg);
        }
      }
    </style>
  `;

  /*
    Initialize Supabase only after the DOM exists.
  */

  try {
    supabase = createSupabaseClient();
  } catch (error) {
    console.error(
      "Supabase initialization failed:",
      error
    );

    showBootError(
      "StudentHub could not connect",
      error.message ||
        "The Supabase library could not be initialized."
    );

    return;
  }

  /*
    Register authentication listener.
  */

  setupAuthListener();

  /*
    Check whether a user is already signed in.
  */

  try {
    const user = await checkCurrentUser();

    if (user) {
      state.user = user;

      await initializeAuthenticatedApp();
    } else {
      renderLogin();
    }

  } catch (error) {
    console.error(
      "StudentHub startup error:",
      error
    );

    showBootError(
      "StudentHub could not start",
      error.message ||
        "An unexpected startup error occurred."
    );
  }
}


/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "error",
  event => {
    console.error(
      "Global JavaScript error:",
      event.error || event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "Unhandled promise rejection:",
      event.reason
    );
  }
);


/* =========================================================
   DOM READY
   ========================================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeApp
  );
} else {
  initializeApp();
}