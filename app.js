/* =========================================================
   STUDENTHUB
   COMPLETE APPLICATION
   ========================================================= */

/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  "https://csmizeuuywlonuysktka.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";

let supabaseClient = null;

/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {
  user: null,
  profile: null,
  classes: [],
  currentPage: "home",
  academicSummary: null,
  scoreDetails: [],
  feedPosts: [],
  activeUsers: [],
  chapters: [],
  currentClassId: null,
  loading: false
};

/* =========================================================
   HELPERS
   ========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
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
  return (
    state.profile?.display_name ||
    state.profile?.full_name ||
    state.profile?.name ||
    state.user?.user_metadata?.full_name ||
    state.user?.user_metadata?.name ||
    state.user?.email?.split("@")[0] ||
    "Student"
  );
}

function getInitials(name) {
  if (!name) return "?";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getLetterClass(letter) {
  if (!letter) return "";

  const normalized = String(letter).toUpperCase();

  if (normalized === "A") return "grade-a";
  if (normalized === "B") return "grade-b";
  if (normalized === "C") return "grade-c";
  if (normalized === "D") return "grade-d";
  if (normalized === "F") return "grade-f";

  return "";
}

function calculateLetterGrade(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) return "—";
  if (numericScore >= 90) return "A";
  if (numericScore >= 80) return "B";
  if (numericScore >= 70) return "C";
  if (numericScore >= 60) return "D";

  return "F";
}

function calculateGPA(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) return 0;
  if (numericScore >= 90) return 4;
  if (numericScore >= 80) return 3;
  if (numericScore >= 70) return 2;
  if (numericScore >= 60) return 1;

  return 0;
}

function showLoading(message = "Loading StudentHub...") {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <div class="loading-title">StudentHub</div>
      <div class="loading-message">${escapeHtml(message)}</div>
    </div>
  `;
}

function showBootError(error) {
  const app = $("#app");

  if (!app) return;

  const message =
    error?.message ||
    String(error) ||
    "An unknown error occurred.";

  app.innerHTML = `
    <div class="boot-error">
      <div class="boot-error-card">
        <div class="boot-error-icon">⚠️</div>
        <h1>StudentHub couldn't load</h1>
        <p>${escapeHtml(message)}</p>
        <button class="primary-button" id="retry-app">
          Try Again
        </button>
      </div>
    </div>
  `;

  $("#retry-app")?.addEventListener("click", () => {
    window.location.reload();
  });
}

/* =========================================================
   SUPABASE INITIALIZATION
   ========================================================= */

function initializeSupabase() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    throw new Error(
      "Supabase did not load. Check that the Supabase CDN script is above app.js in index.html."
    );
  }

  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  return supabaseClient;
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function getCurrentUser() {
  if (!supabaseClient) return null;

  const {
    data,
    error
  } = await supabaseClient.auth.getUser();

  if (error) {
    console.error("Unable to get current user:", error);
    return null;
  }

  return data?.user || null;
}

async function signIn(email, password) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const {
    data,
    error
  } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
}

async function resetPassword(email) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const {
    error
  } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin
    }
  );

  if (error) {
    throw error;
  }
}

async function signOut() {
  if (!supabaseClient) return;

  const {
    error
  } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Sign out error:", error);
  }

  state.user = null;
  state.profile = null;
  state.classes = [];
  state.academicSummary = null;
  state.scoreDetails = [];
  state.feedPosts = [];
  state.activeUsers = [];
  state.chapters = [];
  state.currentPage = "home";

  renderLogin();
}

/* =========================================================
   LOGIN SCREEN
   ========================================================= */

function renderLogin() {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-mark">S</div>
          <div>
            <h1>StudentHub</h1>
            <p>Your CNA class. Your progress. Your community.</p>
          </div>
        </div>

        <div class="auth-heading">
          <h2>Welcome back</h2>
          <p>Sign in to continue to StudentHub.</p>
        </div>

        <form id="login-form">
          <label class="field-label" for="login-email">
            Email
          </label>

          <input
            id="login-email"
            class="text-input"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />

          <label class="field-label" for="login-password">
            Password
          </label>

          <input
            id="login-password"
            class="text-input"
            type="password"
            autocomplete="current-password"
            placeholder="Enter your password"
            required
          />

          <div id="login-error" class="form-error"></div>

          <button class="primary-button auth-submit" type="submit">
            Sign In
          </button>
        </form>

        <button
          class="text-button"
          id="forgot-password"
          type="button"
        >
          Forgot your password?
        </button>
      </div>
    </div>
  `;

  $("#login-form")?.addEventListener("submit", handleLogin);

  $("#forgot-password")?.addEventListener(
    "click",
    handleForgotPassword
  );
}

async function handleLogin(event) {
  event.preventDefault();

  const email = $("#login-email")?.value.trim();
  const password = $("#login-password")?.value || "";
  const errorElement = $("#login-error");
  const submitButton = document.querySelector(
    '#login-form button[type="submit"]'
  );

  if (errorElement) {
    errorElement.textContent = "";
  }

  if (!email || !password) {
    if (errorElement) {
      errorElement.textContent =
        "Please enter your email and password.";
    }

    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Signing In...";
  }

  try {
    await signIn(email, password);
  } catch (error) {
    console.error("Login error:", error);

    if (errorElement) {
      errorElement.textContent =
        error?.message ||
        "Unable to sign in. Please check your information.";
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Sign In";
    }
  }
}

async function handleForgotPassword() {
  const email = $("#login-email")?.value.trim();

  if (!email) {
    alert("Enter your email address first.");
    $("#login-email")?.focus();
    return;
  }

  try {
    await resetPassword(email);

    alert(
      "If that email is registered, a password reset link has been sent."
    );
  } catch (error) {
    console.error("Password reset error:", error);

    alert(
      error?.message ||
        "Unable to send the password reset email."
    );
  }
}

/* =========================================================
   PROFILE
   ========================================================= */

async function loadProfile() {
  if (!supabaseClient || !state.user) return null;

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile load error:", error);
    return null;
  }

  state.profile = data || null;

  return state.profile;
}

/* =========================================================
   CLASSES
   ========================================================= */

async function loadClasses() {
  if (!supabaseClient || !state.user) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("enrollments")
    .select(`
      id,
      student_id,
      class_id,
      role,
      enrolled_at,
      classes (
        id,
        name,
        invite_code,
        created_by,
        created_at
      )
    `)
    .eq("student_id", state.user.id);

  if (error) {
    console.error("Class load error:", error);
    state.classes = [];
    return [];
  }

  state.classes = (data || [])
    .map((item) => item.classes)
    .filter(Boolean);

  if (!state.currentClassId && state.classes.length) {
    state.currentClassId = state.classes[0].id;
  }

  return state.classes;
}

/* =========================================================
   ACADEMIC DATA
   ========================================================= */

async function loadAcademicSummary() {
  if (!supabaseClient || !state.user) return null;

  const {
    data,
    error
  } = await supabaseClient
    .from("student_academic_summary")
    .select("*")
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error("Academic summary error:", error);
    state.academicSummary = null;
    return null;
  }

  state.academicSummary = data || null;

  return state.academicSummary;
}

async function loadScoreDetails() {
  if (!supabaseClient || !state.user) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("student_score_details")
    .select("*")
    .eq("user_id", state.user.id)
    .order("test_date", {
      ascending: false
    });

  if (error) {
    console.error("Score details error:", error);
    state.scoreDetails = [];
    return [];
  }

  state.scoreDetails = data || [];

  return state.scoreDetails;
}

async function loadChapters() {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("chapters")
    .select("*")
    .order("chapter_number", {
      ascending: true
    });

  if (error) {
    console.error("Chapter load error:", error);
    state.chapters = [];
    return [];
  }

  state.chapters = data || [];

  return state.chapters;
}

/* =========================================================
   FEED
   ========================================================= */

async function loadFeed() {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("feed_posts")
    .select(`
      *,
      profiles (
        id,
        display_name,
        full_name,
        avatar_url
      )
    `)
    .order("pinned", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error("Feed load error:", error);
    state.feedPosts = [];
    return [];
  }

  state.feedPosts = data || [];

  return state.feedPosts;
}

/* =========================================================
   ACTIVE USERS / PRESENCE
   ========================================================= */

async function loadActiveUsers() {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("user_presence")
    .select(`
      user_id,
      status,
      last_seen_at,
      profiles (
        id,
        display_name,
        full_name,
        avatar_url
      )
    `)
    .order("status", {
      ascending: true
    })
    .order("last_seen_at", {
      ascending: false
    });

  if (error) {
    console.error("Presence load error:", error);
    state.activeUsers = [];
    return [];
  }

  state.activeUsers = data || [];

  return state.activeUsers;
}

async function updatePresence(status = "online") {
  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("user_presence")
    .upsert({
      user_id: state.user.id,
      status,
      last_seen_at: new Date().toISOString()
    });

  if (error) {
    console.error("Presence update error:", error);
  }
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark">S</div>

        <div class="brand-text">
          <strong>StudentHub</strong>
          <span>CNA Student Hub</span>
        </div>
      </div>

      <nav class="sidebar-nav">

        <button
          class="nav-item ${
            state.currentPage === "home" ? "active" : ""
          }"
          data-page="home"
        >
          <span class="nav-icon">🏠</span>
          <span>Home</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "calendar" ? "active" : ""
          }"
          data-page="calendar"
        >
          <span class="nav-icon">📅</span>
          <span>Calendar</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "care-team" ? "active" : ""
          }"
          data-page="care-team"
        >
          <span class="nav-icon">💬</span>
          <span>The Care Team</span>
        </button>

        <div class="nav-section-label">
          STUDY TOOLS
        </div>

        <button
          class="nav-item"
          data-page="flashcards"
        >
          <span class="nav-icon">🧠</span>
          <span>Flashcards</span>
        </button>

        <button
          class="nav-item"
          data-page="quiz-maker"
        >
          <span class="nav-icon">📝</span>
          <span>Quiz Maker</span>
        </button>

        <button
          class="nav-item"
          data-page="study-timer"
        >
          <span class="nav-icon">⏱️</span>
          <span>Study Timer</span>
        </button>

        <button
          class="nav-item"
          data-page="study-checklist"
        >
          <span class="nav-icon">✅</span>
          <span>Study Checklist</span>
        </button>

        <button
          class="nav-item"
          data-page="chapter-tracker"
        >
          <span class="nav-icon">📖</span>
          <span>Chapter Tracker</span>
        </button>

        <button
          class="nav-item ${
            state.currentPage === "progress" ? "active" : ""
          }"
          data-page="progress"
        >
          <span class="nav-icon">📈</span>
          <span>Progress</span>
        </button>

      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar">
            ${escapeHtml(getInitials(getDisplayName()))}
          </div>

          <div class="sidebar-user-info">
            <strong>${escapeHtml(getDisplayName())}</strong>
            <span>Student</span>
          </div>
        </div>
      </div>
    </aside>
  `;
}

/* =========================================================
   TOP BAR
   ========================================================= */

function renderTopbar() {
  return `
    <header class="topbar">

      <div class="topbar-left">
        <button
          class="mobile-menu-button"
          id="mobile-menu-button"
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
          class="topbar-icon-button"
          id="messages-button"
          title="Messages"
          aria-label="Messages"
        >
          💬
        </button>

        <button
          class="topbar-icon-button notification-button"
          id="notifications-button"
          title="Notifications"
          aria-label="Notifications"
        >
          🔔
          <span class="notification-badge" id="notification-badge">
            0
          </span>
        </button>

        <button
          class="account-button"
          id="account-button"
          aria-label="Account"
        >
          <span class="avatar small-avatar">
            ${escapeHtml(getInitials(getDisplayName()))}
          </span>
          <span class="account-name">
            ${escapeHtml(getDisplayName())}
          </span>
          <span class="account-chevron">⌄</span>
        </button>

      </div>

      <div
        class="account-menu"
        id="account-menu"
        hidden
      >
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
          🛡️ Privacy
        </button>

        <button data-account-action="appearance">
          🎨 Appearance / Theme
        </button>

        <button data-account-action="export">
          📦 Export My Data
        </button>

        <button data-account-action="notifications">
          🔔 Notification Settings
        </button>

        <button data-account-action="signout" class="danger-menu-item">
          🚪 Sign Out
        </button>
      </div>

      <div
        class="notification-panel"
        id="notification-panel"
        hidden
      >
        <div class="notification-panel-header">
          <strong>Notifications</strong>
          <button id="close-notifications">×</button>
        </div>

        <div class="notification-empty">
          <div>🔔</div>
          <p>No new notifications</p>
        </div>
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

/* =========================================================
   MAIN APP SHELL
   ========================================================= */

function renderAppShell() {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div class="mobile-overlay" id="mobile-overlay"></div>

      <div class="main-area">

        ${renderTopbar()}

        <main class="page-container" id="page-container">
          ${renderPageContent()}
        </main>

      </div>

    </div>
  `;

  attachShellEvents();
}

function attachShellEvents() {
  document
    .querySelectorAll("[data-page]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.page);
      });
    });

  $("#mobile-menu-button")?.addEventListener(
    "click",
    openMobileMenu
  );

  $("#mobile-overlay")?.addEventListener(
    "click",
    closeMobileMenu
  );

  $("#account-button")?.addEventListener(
    "click",
    toggleAccountMenu
  );

  $("#notifications-button")?.addEventListener(
    "click",
    toggleNotificationPanel
  );

  $("#close-notifications")?.addEventListener(
    "click",
    closeNotificationPanel
  );

  $("#messages-button")?.addEventListener(
    "click",
    () => navigate("care-team")
  );

  document
    .querySelectorAll("[data-account-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        handleAccountAction(
          button.dataset.accountAction
        );
      });
    });
}

function openMobileMenu() {
  $("#sidebar")?.classList.add("open");
  $("#mobile-overlay")?.classList.add("visible");
}

function closeMobileMenu() {
  $("#sidebar")?.classList.remove("open");
  $("#mobile-overlay")?.classList.remove("visible");
}

function toggleAccountMenu() {
  const menu = $("#account-menu");

  if (!menu) return;

  menu.hidden = !menu.hidden;

  closeNotificationPanel();
}

function toggleNotificationPanel() {
  const panel = $("#notification-panel");

  if (!panel) return;

  panel.hidden = !panel.hidden;

  const menu = $("#account-menu");

  if (menu) {
    menu.hidden = true;
  }
}

function closeNotificationPanel() {
  const panel = $("#notification-panel");

  if (panel) {
    panel.hidden = true;
  }
}

/* =========================================================
   ROUTER
   ========================================================= */

async function navigate(page) {
  state.currentPage = page;

  closeMobileMenu();

  renderAppShell();

  const container = $("#page-container");

  if (!container) return;

  container.innerHTML = renderPageContent();

  await hydratePage(page);
}

function renderPageContent() {
  switch (state.currentPage) {
    case "home":
      return renderHome();

    case "calendar":
      return renderPlaceholderPage(
        "📅",
        "Calendar",
        "Your class calendar, tests, important events, and personal events will appear here."
      );

    case "care-team":
      return renderPlaceholderPage(
        "💬",
        "The Care Team",
        "Class messaging, pinned messages, reactions, online status, and direct messages are coming together here."
      );

    case "flashcards":
      return renderPlaceholderPage(
        "🧠",
        "Flashcards",
        "Create study decks and review difficult cards."
      );

    case "quiz-maker":
      return renderPlaceholderPage(
        "📝",
        "Quiz Maker",
        "Build practice quizzes and track your attempts."
      );

    case "study-timer":
      return renderPlaceholderPage(
        "⏱️",
        "Study Timer",
        "Use focused study sessions and track your study time."
      );

    case "study-checklist":
      return renderPlaceholderPage(
        "✅",
        "Study Checklist",
        "Keep track of the study tasks you need to complete."
      );

    case "chapter-tracker":
      return renderChapterTracker();

    case "progress":
      return renderProgress();

    case "account":
      return renderAccount();

    default:
      return renderHome();
  }
}

async function hydratePage(page) {
  if (page === "home") {
    await hydrateHome();
  }

  if (page === "chapter-tracker") {
    await hydrateChapterTracker();
  }

  if (page === "progress") {
    await hydrateProgress();
  }
}

/* =========================================================
   HOME
   ========================================================= */

function renderHome() {
  return `
    <section class="page">

      <div class="page-header home-header">
        <div>
          <p class="eyebrow">
            STUDENTHUB
          </p>

          <h1>
            ${escapeHtml(getGreeting())},
            ${escapeHtml(getDisplayName())} 👋
          </h1>

          <p>
            Your class. Your progress. Your community.
          </p>
        </div>
      </div>

      <div class="home-grid">

        <section class="panel status-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">📊</span>
              <h2>Status Report</h2>
            </div>
          </div>

          <div id="status-report-content">
            ${renderAcademicStatus()}
          </div>
        </section>

        <section class="panel feed-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">📰</span>
              <h2>Main Feed</h2>
            </div>

            <button
              class="small-button"
              id="create-post-button"
            >
              + Post
            </button>
          </div>

          <div id="feed-content">
            ${renderFeed()}
          </div>
        </section>

        <section class="panel active-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">🟢</span>
              <h2>Who's Active</h2>
            </div>
          </div>

          <div id="active-users-content">
            ${renderActiveUsers()}
          </div>
        </section>

      </div>

    </section>
  `;
}

async function hydrateHome() {
  await Promise.all([
    loadAcademicSummary(),
    loadScoreDetails(),
    loadFeed(),
    loadActiveUsers()
  ]);

  const status = $("#status-report-content");
  const feed = $("#feed-content");
  const active = $("#active-users-content");

  if (status) {
    status.innerHTML = renderAcademicStatus();
  }

  if (feed) {
    feed.innerHTML = renderFeed();
  }

  if (active) {
    active.innerHTML = renderActiveUsers();
  }

  $("#create-post-button")?.addEventListener(
    "click",
    openCreatePostDialog
  );

  attachFeedEvents();
}

function renderAcademicStatus() {
  const summary = state.academicSummary;

  if (!summary) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>No academic data yet</h3>
        <p>
          Add your first score in Chapter Tracker.
        </p>
      </div>
    `;
  }

  const average =
    summary.overall_average !== null &&
    summary.overall_average !== undefined
      ? `${Number(summary.overall_average).toFixed(2)}%`
      : "—";

  const gpa =
    summary.GPA !== undefined &&
    summary.GPA !== null
      ? Number(summary.GPA).toFixed(2)
      : summary.gpa !== undefined &&
        summary.gpa !== null
      ? Number(summary.gpa).toFixed(2)
      : "—";

  const letter =
    summary.overall_letter_grade ||
    summary.letter_grade ||
    "—";

  const consistency =
    summary.score_consistency !== null &&
    summary.score_consistency !== undefined
      ? Number(summary.score_consistency).toFixed(2)
      : "—";

  return `
    <div class="status-main">
      <div class="status-average">
        <span>Overall Average</span>
        <strong>${average}</strong>
        <small class="${getLetterClass(letter)}">
          ${escapeHtml(letter)}
        </small>
      </div>

      <div class="status-stats">

        <div class="status-stat">
          <span>GPA</span>
          <strong>${gpa}</strong>
        </div>

        <div class="status-stat">
          <span>Tests</span>
          <strong>
            ${summary.total_tests ?? 0}
          </strong>
        </div>

        <div class="status-stat">
          <span>Consistency</span>
          <strong>${consistency}</strong>
        </div>

        <div class="status-stat">
          <span>Classes</span>
          <strong>
            ${summary.total_classes ?? 0}
          </strong>
        </div>

      </div>
    </div>
  `;
}

/* =========================================================
   FEED
   ========================================================= */

function renderFeed() {
  if (!state.feedPosts.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <h3>No posts yet</h3>
        <p>
          Be the first person to post something.
        </p>
      </div>
    `;
  }

  return `
    <div class="feed-list">
      ${state.feedPosts
        .map((post) => {
          const profile = post.profiles || {};
          const name =
            profile.display_name ||
            profile.full_name ||
            "Student";

          return `
            <article
              class="feed-post"
              data-post-id="${escapeHtml(post.id)}"
            >

              <div class="feed-post-header">

                <div class="avatar">
                  ${
                    profile.avatar_url
                      ? `<img src="${escapeHtml(
                          profile.avatar_url
                        )}" alt="" />`
                      : escapeHtml(getInitials(name))
                  }
                </div>

                <div class="feed-post-meta">
                  <strong>${escapeHtml(name)}</strong>

                  <span>
                    ${formatDateTime(post.created_at)}
                  </span>
                </div>

                ${
                  post.pinned
                    ? `<span class="pinned-label">📌 Pinned</span>`
                    : ""
                }

              </div>

              <div class="feed-post-content">
                ${escapeHtml(post.content)}
              </div>

              <div class="feed-post-actions">

                <button
                  class="feed-action"
                  data-reaction="like"
                  data-post-id="${escapeHtml(post.id)}"
                >
                  👍 Like
                </button>

                <button
                  class="feed-action"
                  data-comment-post="${escapeHtml(post.id)}"
                >
                  💬 Comment
                </button>

                ${
                  state.user?.id === post.user_id
                    ? `
                      <button
                        class="feed-action"
                        data-edit-post="${escapeHtml(post.id)}"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        class="feed-action danger-action"
                        data-delete-post="${escapeHtml(post.id)}"
                      >
                        🗑️ Delete
                      </button>
                    `
                    : ""
                }

              </div>

            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function attachFeedEvents() {
  document
    .querySelectorAll("[data-reaction]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await reactToPost(
          button.dataset.postId,
          button.dataset.reaction
        );
      });
    });

  document
    .querySelectorAll("[data-comment-post]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openCommentDialog(button.dataset.commentPost);
      });
    });

  document
    .querySelectorAll("[data-edit-post]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        editPost(button.dataset.editPost);
      });
    });

  document
    .querySelectorAll("[data-delete-post]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deletePost(button.dataset.deletePost);
      });
    });
}

async function reactToPost(postId, reaction) {
  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
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
    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }
}

async function openCreatePostDialog() {
  const content = prompt(
    "What would you like to post?"
  );

  if (!content || !content.trim()) return;

  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .insert({
      user_id: state.user.id,
      content: content.trim()
    });

  if (error) {
    alert(
      error.message ||
        "Unable to create your post."
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }
}

async function editPost(postId) {
  const post = state.feedPosts.find(
    (item) => item.id === postId
  );

  if (!post) return;

  const updatedContent = prompt(
    "Edit your post:",
    post.content
  );

  if (
    updatedContent === null ||
    !updatedContent.trim()
  ) {
    return;
  }

  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .update({
      content: updatedContent.trim(),
      updated_at: new Date().toISOString()
    })
    .eq("id", postId)
    .eq("user_id", state.user.id);

  if (error) {
    alert(
      error.message ||
        "Unable to edit the post."
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }
}

async function deletePost(postId) {
  if (
    !confirm(
      "Are you sure you want to delete this post?"
    )
  ) {
    return;
  }

  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", state.user.id);

  if (error) {
    alert(
      error.message ||
        "Unable to delete the post."
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }
}

function openCommentDialog(postId) {
  const content = prompt(
    "Write a comment:"
  );

  if (!content || !content.trim()) return;

  createComment(postId, content.trim());
}

async function createComment(postId, content) {
  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("feed_comments")
    .insert({
      post_id: postId,
      user_id: state.user.id,
      content
    });

  if (error) {
    alert(
      error.message ||
        "Unable to create the comment."
    );
  }
}

/* =========================================================
   ACTIVE USERS
   ========================================================= */

function renderActiveUsers() {
  if (!state.activeUsers.length) {
    return `
      <div class="empty-state compact">
        <div class="empty-icon">👥</div>
        <p>No active users yet.</p>
      </div>
    `;
  }

  return `
    <div class="active-user-list">

      ${state.activeUsers
        .slice(0, 8)
        .map((item) => {
          const profile = item.profiles || {};

          const name =
            profile.display_name ||
            profile.full_name ||
            "Student";

          const status =
            item.status || "offline";

          return `
            <div class="active-user">

              <div class="presence-avatar-wrapper">

                <div class="avatar">
                  ${
                    profile.avatar_url
                      ? `<img src="${escapeHtml(
                          profile.avatar_url
                        )}" alt="" />`
                      : escapeHtml(getInitials(name))
                  }
                </div>

                <span
                  class="presence-dot ${escapeHtml(
                    status
                  )}"
                ></span>

              </div>

              <div class="active-user-info">
                <strong>${escapeHtml(name)}</strong>
                <span>
                  ${escapeHtml(status)}
                </span>
              </div>

            </div>
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================================
   CHAPTER TRACKER
   ========================================================= */

function renderChapterTracker() {
  return `
    <section class="page">

      <div class="page-header">
        <div>
          <p class="eyebrow">
            STUDY TOOLS
          </p>

          <h1>Chapter Tracker</h1>

          <p>
            Enter and manage your chapter test scores.
          </p>
        </div>
      </div>

      <div class="tracker-layout">

        <section class="panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">➕</span>
              <h2>Add Score</h2>
            </div>
          </div>

          <form id="score-form" class="score-form">

            <label class="field-label">
              Class
            </label>

            <select
              id="score-class"
              class="text-input"
              required
            >
              <option value="">
                Select a class
              </option>

              ${state.classes
                .map(
                  (classItem) => `
                    <option
                      value="${escapeHtml(
                        classItem.id
                      )}"
                    >
                      ${escapeHtml(
                        classItem.name
                      )}
                    </option>
                  `
                )
                .join("")}
            </select>

            <label class="field-label">
              Chapter
            </label>

            <select
              id="score-chapter"
              class="text-input"
              required
            >
              <option value="">
                Select a chapter
              </option>

              ${state.chapters
                .map(
                  (chapter) => `
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

            <label class="field-label">
              Score
            </label>

            <input
              id="score-value"
              class="text-input"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Example: 94"
              required
            />

            <label class="field-label">
              Test Date
            </label>

            <input
              id="score-date"
              class="text-input"
              type="date"
              required
            />

            <div id="score-form-message"></div>

            <button
              class="primary-button"
              type="submit"
            >
              Save Score
            </button>

          </form>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">📚</span>
              <h2>Your Scores</h2>
            </div>
          </div>

          <div id="score-list">
            ${renderScoreList()}
          </div>
        </section>

      </div>

    </section>
  `;
}

async function hydrateChapterTracker() {
  await Promise.all([
    loadClasses(),
    loadChapters(),
    loadScoreDetails()
  ]);

  const container = $("#page-container");

  if (container) {
    container.innerHTML =
      renderChapterTracker();

    attachChapterTrackerEvents();
  }
}

function renderScoreList() {
  if (!state.scoreDetails.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>No scores yet</h3>
        <p>
          Add your first chapter test score.
        </p>
      </div>
    `;
  }

  return `
    <div class="score-list">

      ${state.scoreDetails
        .map((score) => {
          const letter =
            score.letter_grade ||
            calculateLetterGrade(score.score);

          return `
            <div class="score-row">

              <div class="score-row-main">
                <strong>
                  Chapter
                  ${escapeHtml(
                    score.chapter_number ??
                      "—"
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    score.chapter_title ||
                      "Chapter"
                  )}
                </span>
              </div>

              <div class="score-row-score">
                <strong>
                  ${Number(score.score).toFixed(2)}%
                </strong>

                <span
                  class="${getLetterClass(
                    letter
                  )}"
                >
                  ${escapeHtml(letter)}
                </span>
              </div>

              <div class="score-row-date">
                ${formatDate(score.test_date)}
              </div>

            </div>
          `;
        })
        .join("")}

    </div>
  `;
}

function attachChapterTrackerEvents() {
  const form = $("#score-form");

  if (!form) return;

  const dateInput = $("#score-date");

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date()
      .toISOString()
      .split("T")[0];
  }

  form.addEventListener(
    "submit",
    handleScoreSubmit
  );
}

async function handleScoreSubmit(event) {
  event.preventDefault();

  if (!supabaseClient || !state.user) return;

  const classId = $("#score-class")?.value;
  const chapterId = $("#score-chapter")?.value;
  const scoreValue = $("#score-value")?.value;
  const testDate = $("#score-date")?.value;
  const message = $("#score-form-message");

  if (
    !classId ||
    !chapterId ||
    !scoreValue ||
    !testDate
  ) {
    if (message) {
      message.innerHTML = `
        <div class="form-error">
          Please complete every field.
        </div>
      `;
    }

    return;
  }

  const numericScore = Number(scoreValue);

  if (
    Number.isNaN(numericScore) ||
    numericScore < 0 ||
    numericScore > 100
  ) {
    if (message) {
      message.innerHTML = `
        <div class="form-error">
          Score must be between 0 and 100.
        </div>
      `;
    }

    return;
  }

  const {
    error
  } = await supabaseClient
    .from("scores")
    .insert({
      user_id: state.user.id,
      class_id: classId,
      chapter_id: Number(chapterId),
      score: numericScore,
      test_date: testDate
    });

  if (error) {
    console.error("Score save error:", error);

    if (message) {
      message.innerHTML = `
        <div class="form-error">
          ${escapeHtml(
            error.message ||
              "Unable to save score."
          )}
        </div>
      `;
    }

    return;
  }

  if (message) {
    message.innerHTML = `
      <div class="form-success">
        Score saved successfully.
      </div>
    `;
  }

  $("#score-value").value = "";

  await Promise.all([
    loadAcademicSummary(),
    loadScoreDetails()
  ]);

  const scoreList = $("#score-list");

  if (scoreList) {
    scoreList.innerHTML =
      renderScoreList();
  }
}

/* =========================================================
   PROGRESS
   ========================================================= */

function renderProgress() {
  return `
    <section class="page">

      <div class="page-header">
        <div>
          <p class="eyebrow">
            ACADEMIC PERFORMANCE
          </p>

          <h1>Progress</h1>

          <p>
            Your scores, averages, GPA, consistency,
            and chapter progress.
          </p>
        </div>
      </div>

      <div id="progress-content">
        ${renderProgressContent()}
      </div>

    </section>
  `;
}

function renderProgressContent() {
  const summary = state.academicSummary;

  if (!summary) {
    return `
      <div class="panel">
        <div class="empty-state">
          <div class="empty-icon">📈</div>
          <h2>No progress data yet</h2>
          <p>
            Add scores in Chapter Tracker to start
            building your academic progress.
          </p>
        </div>
      </div>
    `;
  }

  const average =
    summary.overall_average !== null &&
    summary.overall_average !== undefined
      ? Number(
          summary.overall_average
        ).toFixed(2)
      : "—";

  const gpa =
    summary.GPA !== undefined &&
    summary.GPA !== null
      ? Number(summary.GPA).toFixed(2)
      : summary.gpa !== undefined &&
        summary.gpa !== null
      ? Number(summary.gpa).toFixed(2)
      : "—";

  const letter =
    summary.overall_letter_grade ||
    "—";

  const consistency =
    summary.score_consistency !== null &&
    summary.score_consistency !== undefined
      ? Number(
          summary.score_consistency
        ).toFixed(2)
      : "—";

  const lowest =
    summary.lowest_score !== null &&
    summary.lowest_score !== undefined
      ? `${Number(
          summary.lowest_score
        ).toFixed(2)}%`
      : "—";

  const highest =
    summary.highest_score !== null &&
    summary.highest_score !== undefined
      ? `${Number(
          summary.highest_score
        ).toFixed(2)}%`
      : "—";

  return `
    <div class="progress-grid">

      <div class="panel progress-main-card">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📊</span>
            <h2>Personal Progress Snapshot</h2>
          </div>
        </div>

        <div class="progress-big-number">
          ${average}%
        </div>

        <div
          class="progress-letter ${getLetterClass(
            letter
          )}"
        >
          ${escapeHtml(letter)}
        </div>

        <p>
          Overall academic average
        </p>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">🎓</span>
            <h2>Academic Stats</h2>
          </div>
        </div>

        <div class="stats-grid">

          <div class="stat-card">
            <span>GPA</span>
            <strong>${gpa}</strong>
          </div>

          <div class="stat-card">
            <span>Tests</span>
            <strong>
              ${summary.total_tests ?? 0}
            </strong>
          </div>

          <div class="stat-card">
            <span>Lowest</span>
            <strong>${lowest}</strong>
          </div>

          <div class="stat-card">
            <span>Highest</span>
            <strong>${highest}</strong>
          </div>

          <div class="stat-card">
            <span>Score Consistency</span>
            <strong>
              ${consistency}
            </strong>
          </div>

          <div class="stat-card">
            <span>Classes</span>
            <strong>
              ${summary.total_classes ?? 0}
            </strong>
          </div>

        </div>
      </div>

      <div class="panel progress-history-panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📚</span>
            <h2>Score History</h2>
          </div>
        </div>

        ${
          state.scoreDetails.length
            ? `
              <div class="score-list">
                ${state.scoreDetails
                  .map((score) => {
                    const letter =
                      score.letter_grade ||
                      calculateLetterGrade(
                        score.score
                      );

                    return `
                      <div class="score-row">

                        <div class="score-row-main">
                          <strong>
                            Chapter
                            ${escapeHtml(
                              score.chapter_number ??
                                "—"
                            )}
                          </strong>

                          <span>
                            ${escapeHtml(
                              score.chapter_title ||
                                "Chapter"
                            )}
                          </span>
                        </div>

                        <div class="score-row-score">
                          <strong>
                            ${Number(
                              score.score
                            ).toFixed(2)}%
                          </strong>

                          <span
                            class="${getLetterClass(
                              letter
                            )}"
                          >
                            ${escapeHtml(
                              letter
                            )}
                          </span>
                        </div>

                        <div class="score-row-date">
                          ${formatDate(
                            score.test_date
                          )}
                        </div>

                      </div>
                    `;
                  })
                  .join("")}
              </div>
            `
            : `
              <div class="empty-state">
                <p>No score history yet.</p>
              </div>
            `
        }
      </div>

    </div>
  `;
}

async function hydrateProgress() {
  await Promise.all([
    loadAcademicSummary(),
    loadScoreDetails()
  ]);

  const container =
    $("#progress-content");

  if (container) {
    container.innerHTML =
      renderProgressContent();
  }
}

/* =========================================================
   ACCOUNT
   ========================================================= */

function renderAccount() {
  return `
    <section class="page">

      <div class="page-header">
        <div>
          <p class="eyebrow">
            ACCOUNT
          </p>

          <h1>Account</h1>

          <p>
            Manage your StudentHub account.
          </p>
        </div>
      </div>

      <div class="account-grid">

        <section class="panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">👤</span>
              <h2>My Profile</h2>
            </div>
          </div>

          <div class="profile-card">

            <div class="large-avatar">
              ${escapeHtml(
                getInitials(
                  getDisplayName()
                )
              )}
            </div>

            <div>
              <h3>
                ${escapeHtml(
                  getDisplayName()
                )}
              </h3>

              <p>
                ${escapeHtml(
                  state.user?.email ||
                    ""
                )}
              </p>
            </div>

          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">⚙️</span>
              <h2>Account Controls</h2>
            </div>
          </div>

          <div class="account-actions">

            <button
              class="secondary-button"
              data-account-page-action="security"
            >
              🔐 Password & Security
            </button>

            <button
              class="secondary-button"
              data-account-page-action="privacy"
            >
              🛡️ Privacy
            </button>

            <button
              class="secondary-button"
              data-account-page-action="notifications"
            >
              🔔 Notification Settings
            </button>

            <button
              class="secondary-button"
              data-account-page-action="export"
            >
              📦 Export My Data
            </button>

            <button
              class="danger-button"
              data-account-page-action="signout"
            >
              🚪 Sign Out
            </button>

          </div>
        </section>

      </div>

    </section>
  `;
}

async function handleAccountAction(action) {
  const menu = $("#account-menu");

  if (menu) {
    menu.hidden = true;
  }

  switch (action) {
    case "profile":
    case "details":
      navigate("account");
      break;

    case "security":
      alert(
        "Password and security controls will be added here."
      );
      break;

    case "privacy":
      alert(
        "Privacy controls will be added here."
      );
      break;

    case "appearance":
      alert(
        "Appearance and theme controls will be added here."
      );
      break;

    case "export":
      await requestDataExport();
      break;

    case "notifications":
      alert(
        "Notification settings will be added here."
      );
      break;

    case "signout":
      await signOut();
      break;

    default:
      break;
  }
}

async function requestDataExport() {
  if (!supabaseClient || !state.user) return;

  const {
    error
  } = await supabaseClient
    .from("data_export_requests")
    .insert({
      user_id: state.user.id,
      status: "requested"
    });

  if (error) {
    alert(
      error.message ||
        "Unable to request your data export."
    );

    return;
  }

  alert(
    "Your data export request has been submitted."
  );
}

/* =========================================================
   PLACEHOLDER PAGES
   ========================================================= */

function renderPlaceholderPage(
  icon,
  title,
  description
) {
  return `
    <section class="page">

      <div class="page-header">
        <div>
          <p class="eyebrow">
            STUDENTHUB
          </p>

          <h1>
            ${escapeHtml(title)}
          </h1>

          <p>
            ${escapeHtml(description)}
          </p>
        </div>
      </div>

      <div class="panel feature-placeholder">

        <div class="feature-placeholder-icon">
          ${icon}
        </div>

        <h2>
          ${escapeHtml(title)}
        </h2>

        <p>
          This area is ready for the next
          StudentHub feature.
        </p>

      </div>

    </section>
  `;
}

/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthListener() {
  if (!supabaseClient) return;

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        state.user = session.user;

        if (event === "SIGNED_IN") {
          await startAuthenticatedApp();
        }

        return;
      }

      if (event === "SIGNED_OUT") {
        state.user = null;
        state.profile = null;
        state.classes = [];
        state.academicSummary = null;
        state.scoreDetails = [];
        state.feedPosts = [];
        state.activeUsers = [];
        state.chapters = [];

        renderLogin();
      }
    }
  );
}

/* =========================================================
   AUTHENTICATED START
   ========================================================= */

async function startAuthenticatedApp() {
  showLoading("Loading your StudentHub...");

  state.user = await getCurrentUser();

  if (!state.user) {
    renderLogin();
    return;
  }

  await Promise.all([
    loadProfile(),
    loadClasses(),
    loadChapters()
  ]);

  await updatePresence("online");

  state.currentPage = "home";

  renderAppShell();

  await hydrateHome();
}

/* =========================================================
   APPLICATION STARTUP
   ========================================================= */

async function startApp() {
  try {
    showLoading();

    initializeSupabase();

    setupAuthListener();

    const user = await getCurrentUser();

    if (!user) {
      renderLogin();
      return;
    }

    state.user = user;

    await startAuthenticatedApp();
  } catch (error) {
    console.error(
      "StudentHub startup error:",
      error
    );

    showBootError(error);
  }
}

/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "StudentHub runtime error:",
      event.error || event.message
    );
  }
);

window.addEventListener(
  "unhandledrejection",
  (event) => {
    console.error(
      "StudentHub unhandled promise rejection:",
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
    startApp
  );
} else {
  startApp();
}