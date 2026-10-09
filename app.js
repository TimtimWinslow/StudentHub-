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

let presenceHeartbeat = null;
let activeUsersRefreshTimer = null;
let careRealtimeChannel = null;
let careRealtimeRefreshTimer = null;
let presenceIdleTimer = null;
let lastPresenceActivity = Date.now();

const PRESENCE_IDLE_MS = 5 * 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 60 * 1000;

/* =========================================================
   GLOBAL STATE
   ========================================================= */

const state = {
  user: null,
  profile: null,
  classes: [],
  currentPage: "home",
  isAdmin: false,
  accountSuspended: false,
  adminStudents: [],
  adminClasses: [],
  adminChapters: [],
  adminAuditLog: [],
  adminEnrollments: [],
  adminReports: [],
  adminSection: "dashboard",

  academicSummary: null,
  scoreDetails: [],
  chapters: [],

  feedPosts: [],
  feedComments: [],
  feedReactions: [],

  activeUsers: [],

  calendarEvents: [],
  notifications: [],

  careMessages: [],
  pinnedMessages: [],
  messageReactions: [],
  conversations: [],
  classmates: [],
  currentConversationId: null,
  currentConversationType: null,
  showNewMessage: false,
  searchQuery: "",
  searchResults: [],
  replyToMessage: null,
  careSearchQuery: "",
  careUnreadCount: 0,
  careReadAt: null,

  flashcardDecks: [],
  currentDeck: null,
  flashcards: [],

  quizSets: [],
  currentQuiz: null,
  quizQuestions: [],

  studyChecklist: [],
  assignments: [],
  notes: [],
  studySessions: [],

  notificationPreferences: null,
  privacySettings: null,

  currentClassId: null,
  calendarDate: new Date(),

  timer: {
    interval: null,
    seconds: 25 * 60,
    remaining: 25 * 60,
    running: false,
    mode: "focus"
  },

  loading: false,
  initialized: false,
  authStarting: false
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

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString(undefined, {
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

function getUserRole() {
  return state.isAdmin ? "Administrator" : "Student";
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

function showMessage(message, type = "success") {
  const existing = document.querySelector(".studenthub-toast");

  if (existing) existing.remove();

  const toast = document.createElement("div");

  toast.className = `studenthub-toast ${type}`;

  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("visible");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("visible");

    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 3000);
}

function getCurrentClass() {
  if (!state.classes.length) return null;

  return (
    state.classes.find(
      (item) => item.id === state.currentClassId
    ) || state.classes[0]
  );
}

/* =========================================================
   SUPABASE INITIALIZATION
   ========================================================= */

async function setupCareRealtime() {
  if (!supabaseClient || !state.user) return;

  if (careRealtimeChannel) {
    await supabaseClient.removeChannel(careRealtimeChannel);
    careRealtimeChannel = null;
  }

  careRealtimeChannel = supabaseClient
    .channel("studenthub-care-team-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
      const conversationId = payload.new?.conversation_id || payload.old?.conversation_id;
      if (conversationId && conversationId !== state.currentConversationId) return;
      scheduleCareRealtimeRefresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
      const messageId = payload.new?.message_id || payload.old?.message_id;
      if (messageId && !state.careMessages.some((message) => message.id === messageId)) return;
      scheduleCareRealtimeRefresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "pinned_messages" }, () => {
      scheduleCareRealtimeRefresh();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, (payload) => {
      const userId = payload.new?.user_id || payload.old?.user_id;
      if (
        userId &&
        userId !== state.user?.id &&
        !state.classmates.some((classmate) => classmate.id === userId)
      ) return;
      scheduleCareRealtimeRefresh(true);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("Care Team realtime channel error.");
      }
    });
}

function scheduleCareRealtimeRefresh(presenceOnly = false) {
  if (!supabaseClient || !state.user) return;
  if (careRealtimeRefreshTimer) clearTimeout(careRealtimeRefreshTimer);

  careRealtimeRefreshTimer = setTimeout(async () => {
    careRealtimeRefreshTimer = null;

    if (state.currentPage !== "care-team" && state.currentPage !== "messages") return;

    try {
      const conversation = state.conversations.find(
        (item) => item.id === state.currentConversationId
      );

      if (
        state.currentPage === "messages" &&
        state.currentConversationId &&
        (
          state.currentConversationType === "direct" ||
          conversation?.type === "direct"
        )
      ) {
        state.currentConversationType = "direct";
        await hydrateDirectMessage();
      } else if (state.currentPage === "care-team") {
        await hydrateCareTeam();
      } else if (state.currentPage === "messages") {
        await hydrateMessages();
      }
    } catch (error) {
      console.warn("Care Team realtime refresh failed:", error);
    }
  }, presenceOnly ? 500 : 250);
}

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

  if (error) throw error;

  return data;
}

async function resendConfirmationEmail(email) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const cleanEmail = String(email || "").trim();

  if (!cleanEmail) {
    throw new Error("Enter your email address first.");
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email: cleanEmail,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) throw error;
}

async function handleResendConfirmation() {
  const email = $("#login-email")?.value.trim();
  const button = $("#resend-confirmation");
  const message = $("#login-error");

  if (!email) {
    if (message) {
      message.className = "form-error";
      message.textContent = "Enter your email address first.";
    }
    $("#login-email")?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }

  try {
    await resendConfirmationEmail(email);

    if (message) {
      message.className = "form-success";
      message.textContent = "Confirmation email sent. Check your inbox and spam folder.";
    }
  } catch (error) {
    console.error("Resend confirmation error:", error);

    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to resend confirmation email.";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Resend Confirmation Email";
    }
  }
}

async function signUp(fullName, email, password) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const {
    data,
    error
  } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        display_name: fullName
      },
      emailRedirectTo: window.location.origin
    }
  });

  if (error) throw error;

  return data;
}

async function updatePassword(password) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const {
    data,
    error
  } = await supabaseClient.auth.updateUser({
    password
  });

  if (error) throw error;

  return data;
}

async function resetPassword(email) {
  if (!supabaseClient) {
    throw new Error("Supabase is not initialized.");
  }

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: window.location.origin
      }
    );

  if (error) throw error;
}

async function signOut() {
  if (!supabaseClient) return;

  await supabaseClient.auth.signOut();

  resetState();

  renderLogin();
}

function resetState() {
  state.user = null;
  state.profile = null;
  state.classes = [];
  state.currentPage = "home";

  state.academicSummary = null;
  state.scoreDetails = [];
  state.chapters = [];

  state.feedPosts = [];
  state.feedComments = [];
  state.feedReactions = [];

  state.activeUsers = [];

  state.calendarEvents = [];
  state.notifications = [];

  state.careMessages = [];
  state.pinnedMessages = [];
  state.messageReactions = [];
  state.conversations = [];
  state.classmates = [];
  state.currentConversationId = null;
  state.currentConversationType = null;
  state.showNewMessage = false;
  state.replyToMessage = null;
  state.careSearchQuery = "";
  state.careUnreadCount = 0;
  state.careReadAt = null;

  state.flashcardDecks = [];
  state.currentDeck = null;
  state.flashcards = [];

  state.quizSets = [];
  state.currentQuiz = null;
  state.quizQuestions = [];

  state.studyChecklist = [];
  state.notes = [];
  state.studySessions = [];

  state.notificationPreferences = null;
  state.privacySettings = null;

  state.currentClassId = null;
}

/* =========================================================
   LOGIN
   ========================================================= */

function renderLogin() {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-logo">
          <div class="auth-logo-mark"><img src="assets/studenthub-mark.svg" alt="StudentHub logo" /></div>

          <div>
            <h1>StudentHub</h1>
            <p>
              Your CNA class. Your progress. Your community.
            </p>
          </div>
        </div>

        <div class="auth-heading">
          <h2>Welcome back</h2>
          <p>Sign in to continue to StudentHub.</p>
        </div>

        <form id="login-form">

          <label class="field-label">
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

          <label class="field-label">
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

          <button
            class="primary-button auth-submit"
            type="submit"
          >
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

        <button
          class="text-button"
          id="resend-confirmation"
          type="button"
        >
          Resend Confirmation Email
        </button>

        <button
          class="text-button"
          id="create-account"
          type="button"
        >
          Create an account
        </button>

      </div>
    </div>
  `;

  $("#login-form")?.addEventListener(
    "submit",
    handleLogin
  );

  $("#forgot-password")?.addEventListener(
    "click",
    handleForgotPassword
  );

  $("#create-account")?.addEventListener(
    "click",
    renderSignUp
  );

  $("#resend-confirmation")?.addEventListener(
    "click",
    handleResendConfirmation
  );
}

function renderSignUp() {
  const app = $("#app");
  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-mark"><img src="assets/studenthub-mark.svg" alt="StudentHub logo" /></div>
          <div>
            <h1>StudentHub</h1>
            <p>Your CNA class. Your progress. Your community.</p>
          </div>
        </div>

        <div class="auth-heading">
          <h2>Create your account</h2>
          <p>Join your CNA class on StudentHub.</p>
        </div>

        <form id="signup-form">
          <label class="field-label">Full name</label>
          <input id="signup-name" class="text-input" type="text" autocomplete="name" placeholder="Your full name" required />

          <label class="field-label">Email</label>
          <input id="signup-email" class="text-input" type="email" autocomplete="email" placeholder="you@example.com" required />

          <label class="field-label">Password</label>
          <input id="signup-password" class="text-input" type="password" autocomplete="new-password" placeholder="At least 6 characters" required />

          <label class="field-label">Confirm password</label>
          <input id="signup-confirm" class="text-input" type="password" autocomplete="new-password" placeholder="Re-enter your password" required />

          <div id="signup-message" class="form-error"></div>

          <button class="primary-button auth-submit" type="submit">
            Create Account
          </button>
        </form>

        <button class="text-button" id="back-to-login" type="button">
          Back to Sign In
        </button>
      </div>
    </div>
  `;

  $("#signup-form")?.addEventListener("submit", handleSignUp);
  $("#back-to-login")?.addEventListener("click", renderLogin);
}

async function handleSignUp(event) {
  event.preventDefault();

  const fullName = $("#signup-name")?.value.trim();
  const email = $("#signup-email")?.value.trim();
  const password = $("#signup-password")?.value || "";
  const confirm = $("#signup-confirm")?.value || "";
  const message = $("#signup-message");
  const button = document.querySelector('#signup-form button[type="submit"]');

  if (message) message.textContent = "";

  if (!fullName || !email || !password || !confirm) {
    if (message) message.textContent = "Please complete every field.";
    return;
  }

  if (password.length < 6) {
    if (message) message.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirm) {
    if (message) message.textContent = "Passwords do not match.";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Creating Account...";
  }

  try {
    const data = await signUp(fullName, email, password);

    if (data?.session?.user) {
      state.user = data.session.user;
      await startAuthenticatedApp();
      return;
    }

    renderSignupConfirmation(email);

  } catch (error) {
    console.error(error);

    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to create your account.";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Create Account";
    }
  }
}

function renderSignupConfirmation(email = "") {
  const app = $("#app");
  if (!app) return;

  const safeEmail = escapeHtml(email || "your email address");

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card auth-confirmation-card">
        <div class="auth-logo">
          <div class="auth-logo-mark"><img src="assets/studenthub-mark.svg" alt="StudentHub logo" /></div>
          <div>
            <h1>StudentHub</h1>
            <p>Your CNA class. Your progress. Your community.</p>
          </div>
        </div>

        <div class="auth-confirmation-icon" aria-hidden="true">✉️</div>

        <div class="auth-heading">
          <h2>Check your email</h2>
          <p>We've sent a confirmation email to <strong>${safeEmail}</strong>.</p>
        </div>

        <div class="auth-confirmation-copy">
          <p>Open the email and tap the confirmation link to activate your StudentHub account.</p>
          <p>Don't see it? Check your spam or junk folder.</p>
        </div>

        <button
          class="primary-button auth-submit"
          id="confirmation-resend"
          type="button"
        >
          Resend Confirmation Email
        </button>

        <button
          class="text-button"
          id="confirmation-back-login"
          type="button"
        >
          Back to Sign In
        </button>

        <div id="confirmation-message" class="form-error"></div>
      </div>
    </div>
  `;

  $("#confirmation-resend")?.addEventListener("click", async () => {
    const button = $("#confirmation-resend");
    const message = $("#confirmation-message");

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      await resendConfirmationEmail(email);

      if (message) {
        message.className = "form-success";
        message.textContent = "A new confirmation email has been sent.";
      }
    } catch (error) {
      if (message) {
        message.className = "form-error";
        message.textContent = error?.message || "Unable to resend confirmation email.";
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Resend Confirmation Email";
      }
    }
  });

  $("#confirmation-back-login")?.addEventListener("click", renderLogin);
}

function renderResetPassword() {
  const app = $("#app");
  if (!app) return;

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-mark"><img src="assets/studenthub-mark.svg" alt="StudentHub logo" /></div>
          <div>
            <h1>StudentHub</h1>
            <p>Your CNA class. Your progress. Your community.</p>
          </div>
        </div>

        <div class="auth-heading">
          <h2>Set a new password</h2>
          <p>Choose a new password for your StudentHub account.</p>
        </div>

        <form id="reset-password-form">
          <label class="field-label">New password</label>
          <input id="reset-password" class="text-input" type="password" autocomplete="new-password" placeholder="At least 6 characters" required />

          <label class="field-label">Confirm new password</label>
          <input id="reset-confirm" class="text-input" type="password" autocomplete="new-password" placeholder="Re-enter your password" required />

          <div id="reset-message" class="form-error"></div>

          <button class="primary-button auth-submit" type="submit">
            Update Password
          </button>
        </form>
      </div>
    </div>
  `;

  $("#reset-password-form")?.addEventListener("submit", handleResetPassword);
}

async function handleResetPassword(event) {
  event.preventDefault();

  const password = $("#reset-password")?.value || "";
  const confirm = $("#reset-confirm")?.value || "";
  const message = $("#reset-message");
  const button = document.querySelector('#reset-password-form button[type="submit"]');

  if (message) message.textContent = "";

  if (password.length < 6) {
    if (message) message.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirm) {
    if (message) message.textContent = "Passwords do not match.";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Updating...";
  }

  try {
    await updatePassword(password);

    if (message) {
      message.className = "form-success";
      message.textContent = "Password updated successfully. Returning to sign in...";
    }

    setTimeout(() => {
      resetState();
      renderLogin();
    }, 1200);
  } catch (error) {
    console.error(error);

    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to update your password.";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Update Password";
    }
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const email = $("#login-email")?.value.trim();
  const password = $("#login-password")?.value || "";
  const errorElement = $("#login-error");
  const button = document.querySelector(
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

  if (button) {
    button.disabled = true;
    button.textContent = "Signing In...";
  }

  try {
    await signIn(email, password);
  } catch (error) {
    console.error(error);

    if (errorElement) {
      errorElement.textContent =
        error?.message ||
        "Unable to sign in.";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Sign In";
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
  state.accountSuspended = state.profile?.account_status === "suspended";

  return state.profile;
}

/* =========================================================
   CLASSES
   ========================================================= */

function isCnaProgram(value) {
  return /\bcna\b/i.test(String(value || ""));
}

function getClassProgram(classItem) {
  if (!classItem) return "";
  return (
    classItem.program ||
    classItem.program_name ||
    classItem.course ||
    classItem.course_name ||
    classItem.name ||
    ""
  );
}

function getClassLabel(classItem) {
  const program = getClassProgram(classItem);

  // The current StudentHub class is the CNA program.
  // Keep the visible class selector as "CNA" even if the
  // existing Supabase class name is something like "Fall 2026".
  if (isCnaProgram(program)) return "CNA";

  if (state.classes.length === 1 && classItem?.id === state.classes[0]?.id) {
    return "CNA";
  }

  return classItem?.name || "Class";
}

function getStoredClassId() {
  try {
    return localStorage.getItem("studenthub-current-class-id");
  } catch {
    return null;
  }
}

function storeCurrentClassId(classId) {
  try {
    if (classId) localStorage.setItem("studenthub-current-class-id", String(classId));
  } catch {}
}

function getCurrentClass() {
  if (!state.classes.length) return null;
  return state.classes.find((item) => String(item.id) === String(state.currentClassId)) || state.classes[0];
}

function getChaptersForClass(classItem = getCurrentClass()) {
  if (!classItem) return [];

  const program = getClassProgram(classItem);
  const classId = String(classItem.id || "");
  const isCurrentCnaClass =
    isCnaProgram(program) ||
    (state.classes.length === 1 &&
      String(state.classes[0]?.id || "") === classId);

  return state.chapters.filter((chapter) => {
    const chapterClassId = chapter.class_id ?? chapter.classId ?? null;
    const chapterProgram =
      chapter.program ||
      chapter.program_name ||
      chapter.course ||
      chapter.course_name ||
      null;

    // Existing chapters are the CNA curriculum.
    if (isCurrentCnaClass) {
      if (chapterClassId && String(chapterClassId) === classId) return true;
      if (chapterProgram) return isCnaProgram(chapterProgram);
      return true;
    }

    // Future programs can use class/program metadata when present.
    if (chapterClassId) return String(chapterClassId) === classId;
    if (chapterProgram) {
      return String(chapterProgram).toLowerCase() === String(program).toLowerCase();
    }

    return false;
  });
}

async function loadClasses() {
  if (!supabaseClient || !state.user) return [];

  const { data, error } = await supabaseClient
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
    state.currentClassId = null;
    return [];
  }

  state.classes = (data || []).map((item) => item.classes).filter(Boolean);

  const storedClassId = getStoredClassId();

  if (storedClassId && state.classes.some((item) => String(item.id) === String(storedClassId))) {
    state.currentClassId = storedClassId;
  } else if (
    !state.currentClassId ||
    !state.classes.some((item) => String(item.id) === String(state.currentClassId))
  ) {
    state.currentClassId = state.classes[0]?.id || null;
  }

  storeCurrentClassId(state.currentClassId);
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

async function loadFeedComments(postId) {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("feed_comments")
    .select(`
      *,
      profiles (
        id,
        display_name,
        full_name,
        avatar_url
      )
    `)
    .eq("post_id", postId)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error("Comment load error:", error);
    return [];
  }

  return data || [];
}

async function loadPostReactionCounts(postId) {
  if (!supabaseClient) return {};

  const {
    data,
    error
  } = await supabaseClient
    .from("feed_reactions")
    .select("reaction,user_id")
    .eq("post_id", postId);

  if (error) return {};

  const counts = {};

  (data || []).forEach((item) => {
    counts[item.reaction] =
      (counts[item.reaction] || 0) + 1;
  });

  return counts;
}

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
                      ? `<img
                          src="${escapeHtml(
                            profile.avatar_url
                          )}"
                          alt=""
                        />`
                      : escapeHtml(
                          getInitials(name)
                        )
                  }
                </div>

                <div class="feed-post-meta">
                  <strong>
                    ${escapeHtml(name)}
                  </strong>

                  <span>
                    ${formatDateTime(
                      post.created_at
                    )}
                  </span>
                </div>

                ${
                  post.pinned
                    ? `
                      <span class="pinned-label">
                        📌 Pinned
                      </span>
                    `
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
                  data-post-id="${escapeHtml(
                    post.id
                  )}"
                >
                  👍 Like
                </button>

                <button
                  class="feed-action"
                  data-comment-post="${escapeHtml(
                    post.id
                  )}"
                >
                  💬 Comment
                </button>

                ${
                  state.user?.id === post.user_id
                    ? `
                      <button
                        class="feed-action"
                        data-edit-post="${escapeHtml(
                          post.id
                        )}"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        class="feed-action danger-action"
                        data-delete-post="${escapeHtml(
                          post.id
                        )}"
                      >
                        🗑️ Delete
                      </button>
                    `
                    : ""
                }

              </div>

              <div
                class="feed-comments"
                id="comments-${escapeHtml(
                  post.id
                )}"
              ></div>

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
        openCommentDialog(
          button.dataset.commentPost
        );
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
        onConflict:
          "post_id,user_id,reaction"
      }
    );

  if (error) {
    showMessage(
      error.message ||
      "Unable to add reaction.",
      "error"
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
    showMessage(
      error.message ||
      "Unable to create your post.",
      "error"
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }

  showMessage("Post created.");
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
    showMessage(
      error.message ||
      "Unable to edit the post.",
      "error"
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }

  showMessage("Post updated.");
}

async function deletePost(postId) {
  if (
    !confirm(
      "Are you sure you want to delete this post?"
    )
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", state.user.id);

  if (error) {
    showMessage(
      error.message ||
      "Unable to delete the post.",
      "error"
    );

    return;
  }

  await loadFeed();

  const feed = $("#feed-content");

  if (feed) {
    feed.innerHTML = renderFeed();
    attachFeedEvents();
  }

  showMessage("Post deleted.");
}

async function openCommentDialog(postId) {
  const content = prompt(
    "Write a comment:"
  );

  if (!content || !content.trim()) return;

  await createComment(
    postId,
    content.trim()
  );
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
    showMessage(
      error.message ||
      "Unable to create the comment.",
      "error"
    );

    return;
  }

  showMessage("Comment added.");
}

/* =========================================================
   PRESENCE
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
    .order("last_seen_at", {
      ascending: false
    });

  if (error) {
    console.error(
      "Presence load error:",
      error
    );

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
          const profile =
            item.profiles || {};

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
                      ? `<img
                          src="${escapeHtml(
                            profile.avatar_url
                          )}"
                          alt=""
                        />`
                      : escapeHtml(
                          getInitials(name)
                        )
                  }
                </div>

                <span
                  class="presence-dot ${escapeHtml(
                    status
                  )}"
                ></span>

              </div>

              <div class="active-user-info">
                <strong>
                  ${escapeHtml(name)}
                </strong>

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
   SIDEBAR
   ========================================================= */

function renderSidebar() {
  return `
    <aside class="sidebar" id="sidebar">

      <div class="sidebar-brand">
        <div class="brand-mark"><img src="assets/studenthub-mark.svg" alt="StudentHub logo" /></div>

        <div class="brand-text">
          <strong>StudentHub</strong>
          <span>CNA Student Hub</span>
        </div>
      </div>

      <nav class="sidebar-nav">

        ${navButton(
          "home",
          "🏠",
          "Home"
        )}

        ${navButton(
          "calendar",
          "📅",
          "Calendar"
        )}

        ${navButton(
          "assignments",
          "📝",
          "Assignments"
        )}

        ${navButton(
          "notifications",
          "🔔",
          "Notifications"
        )}

        ${navButton(
          "search",
          "🔎",
          "Search"
        )}

        ${navButton(
          "care-team",
          "💬",
          "The Care Team"
        )}

        <div class="nav-section-label">
          STUDY TOOLS
        </div>

        ${navButton(
          "flashcards",
          "🧠",
          "Flashcards"
        )}

        ${navButton(
          "quiz-maker",
          "📝",
          "Quiz Maker"
        )}

        ${navButton(
          "study-timer",
          "⏱️",
          "Study Timer"
        )}

        ${navButton(
          "study-checklist",
          "✅",
          "Study Checklist"
        )}

        ${navButton(
          "chapter-tracker",
          "📖",
          "Chapter Tracker"
        )}

        ${navButton(
          "progress",
          "📈",
          "Progress"
        )}

        ${navButton(
          "install",
          "📱",
          "Student Hub App"
        )}

        ${
          state.isAdmin
            ? `
              <div class="nav-section-label">
                ADMIN
              </div>
              ${navButton("admin", "🛡️", "Admin")}
            `
            : ""
        }

      </nav>

      <div class="sidebar-footer">

        <div class="sidebar-user">

          <div class="avatar">
            ${escapeHtml(
              getInitials(
                getDisplayName()
              )
            )}
          </div>

          <div class="sidebar-user-info">
            <strong>
              ${escapeHtml(
                getDisplayName()
              )}
            </strong>

            <span class="role-badge ${state.isAdmin ? "admin" : "student"}">${state.isAdmin ? "🛡️ Administrator" : "🎓 Student"}</span>
          </div>

        </div>

      </div>

    </aside>
  `;
}

function navButton(page, icon, label) {
  return `
    <button
      class="nav-item ${
        state.currentPage === page
          ? "active"
          : ""
      }"
      data-page="${escapeHtml(page)}"
    >
      <span class="nav-icon">
        ${icon}
      </span>

      <span>
        ${escapeHtml(label)}
      </span>
    </button>
  `;
}

/* =========================================================
   TOPBAR
   ========================================================= */

/* =========================================================
   INSTALL STUDENTHUB
   ========================================================= */

function renderInstallStudentHub() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  return `
    <section class="page install-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">STUDENTHUB APP</p>
          <h1>Student Hub App 📱</h1>
          <p>Add the Student Hub App to your Home Screen and use it like a real app.</p>
        </div>
      </div>
      <section class="panel install-panel">
        <div class="install-hero">
          <div class="install-logo"><img src="assets/studenthub-mark.svg" alt="StudentHub logo"></div>
          <div>
            <h2>${standalone ? "Student Hub App is already installed" : "Take Student Hub App with you"}</h2>
            <p>${standalone ? "You're currently using the installed Student Hub App." : "Student Hub App for quick access from your Home Screen."}</p>
          </div>
        </div>
        <div class="install-actions">
          <button type="button" class="primary-button install-page-button" id="install-page-button" ${standalone ? "disabled" : ""}>
            ${standalone ? "✓ Already Installed" : "📱 Student Hub App"}
          </button>
        </div>
        <div class="install-instructions-grid">
          <article class="install-instruction-card">
            <div class="install-instruction-icon">🍎</div>
            <h3>iPhone / iPad</h3>
            <ol><li>Open StudentHub in Safari.</li><li>Tap <strong>Share</strong>.</li><li>Tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>
          </article>
          <article class="install-instruction-card">
            <div class="install-instruction-icon">🤖</div>
            <h3>Android</h3>
            <ol><li>Open StudentHub in your browser.</li><li>Open the browser menu.</li><li>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Confirm.</li></ol>
          </article>
        </div>
        <div class="install-instructions-grid install-desktop-grid">
          <article class="install-instruction-card">
            <div class="install-instruction-icon">💻</div>
            <h3>Windows / Mac / Chromebook</h3>
            <ol><li>Open StudentHub in Chrome or Edge.</li><li>Look for the install icon in the address bar, or open the browser menu.</li><li>Choose <strong>Install StudentHub</strong> or <strong>Install page as app</strong>.</li><li>Confirm the install prompt.</li></ol>
          </article>
          <article class="install-instruction-card">
            <div class="install-instruction-icon">🔄</div>
            <h3>Keep StudentHub Updated</h3>
            <p>StudentHub checks for updated app files through your browser. After an update, reload the app to use the newest version.</p>
            <div class="install-update-actions">
              <button type="button" class="secondary-button" id="check-app-updates">Check for Updates</button>
              <span id="app-update-status" class="install-update-status" role="status" aria-live="polite">Version v1.0.0</span>
            </div>
          </article>
        </div>
        <div class="install-note">
          <strong>What you get</strong>
          <span>Quick Home Screen access in an app-style window, using your existing StudentHub account and class data.</span>
        </div>
        <section class="install-whats-new">
          <div>
            <p class="eyebrow">CURRENT RELEASE</p>
            <h3>What’s New · v1.0.0</h3>
          </div>
          <ul>
            <li>StudentHub home and student tools in one place.</li>
            <li>Account sign-in and password reset flows.</li>
            <li>Care Team messaging and notifications.</li>
            <li>Installable app experience on supported devices.</li>
          </ul>
          <details class="install-help">
            <summary>Need help installing?</summary>
            <p><strong>On iPhone or iPad:</strong> use Safari, tap Share, choose Add to Home Screen, then tap Add. If you don’t see the option, scroll through the Share menu.</p>
            <p><strong>On Android:</strong> open StudentHub in Chrome, tap the three-dot menu, then choose Install app or Add to Home Screen.</p>
            <p><strong>On a computer:</strong> use Chrome or Edge and look for the install icon near the address bar or the Install option in the browser menu.</p>
            <p>If installation is unavailable, you can still use StudentHub in your browser.</p>
          </details>
        </section>
      </section>
    </section>
  `;
}

function attachInstallPageEvents() {
  const button = $("#install-page-button");
  if (button) {
    const refresh = () => {
      const installed = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
      button.disabled = installed;
      button.textContent = installed ? "✓ Already Installed" : "📱 Student Hub App";
    };
    if (!button.disabled) {
      button.addEventListener("click", () => {
        if (typeof window.studentHubInstall === "function") window.studentHubInstall();
      });
    }
    window.addEventListener("studenthub-install-available", refresh);
    window.addEventListener("studenthub-app-installed", refresh);
  }

  const updateButton = $("#check-app-updates");
  const updateStatus = $("#app-update-status");
  if (updateButton && updateStatus) {
    updateButton.addEventListener("click", async () => {
      if (updateButton.dataset.reload === "true") {
        window.location.reload();
        return;
      }
      updateButton.disabled = true;
      updateStatus.textContent = "Checking for updates…";
      try {
        if (!("serviceWorker" in navigator)) {
          updateStatus.textContent = "Your browser updates StudentHub when you reopen it.";
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration("./");
        if (!registration) {
          await navigator.serviceWorker.register("./sw.js");
          updateStatus.textContent = "Update support is now enabled. Reload StudentHub and check again.";
          return;
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              updateStatus.textContent = "A new version is ready. Reload to finish updating.";
              updateButton.textContent = "Reload StudentHub";
              updateButton.dataset.reload = "true";
            }
          });
        });
        await registration.update();
        if (registration.waiting) {
          updateStatus.textContent = "A new version is ready. Reload to finish updating.";
          updateButton.textContent = "Reload StudentHub";
          updateButton.dataset.reload = "true";
        } else if (updateButton.dataset.reload !== "true") {
          updateStatus.textContent = "Check complete. If app files changed, your browser will refresh them; reopen StudentHub if needed.";
        }
      } catch (error) {
        console.error("StudentHub update check failed:", error);
        updateStatus.textContent = "Couldn’t check right now. Check your connection and try again.";
      } finally {
        updateButton.disabled = false;
      }
    });
  }
}

function renderTopbar() {
  const unread =
    state.notifications.filter(
      (item) => !item.read
    ).length;

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
          ${escapeHtml(
            getPageTitle()
          )}
        </div>

      </div>

      <div class="topbar-actions">

        <button class="topbar-search-button" id="topbar-search-button" title="Search StudentHub" aria-label="Search StudentHub" type="button">🔎 <span>Search</span></button>

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

          <span
            class="notification-badge ${
              unread ? "has-unread" : ""
            }"
            id="notification-badge"
          >
            ${unread}
          </span>

        </button>

        <button
          class="account-button"
          id="account-button"
          aria-label="Account"
        >

          <span class="avatar small-avatar">
            ${state.profile?.avatar_url
              ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="" />'
              : escapeHtml(getInitials(getDisplayName()))}
          </span>

          <span class="account-name">
            ${escapeHtml(
              getDisplayName()
            )}
          </span>

          <span class="account-role-badge role-badge ${state.isAdmin ? "admin" : "student"}">${state.isAdmin ? "🛡️ Admin" : "🎓 Student"}</span>

          <span class="account-chevron">
            ⌄
          </span>

        </button>

      </div>

      <div
        class="account-menu"
        id="account-menu"
        hidden
      >

        <div class="account-menu-role">
          <span class="account-menu-role-label">Signed in as</span>
          <span class="role-badge ${state.isAdmin ? "admin" : "student"}">${state.isAdmin ? "🛡️ Administrator" : "🎓 Student"}</span>
        </div>

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

        <button
          data-account-action="signout"
          class="danger-menu-item"
        >
          🚪 Sign Out
        </button>

      </div>

      <div
        class="notification-panel"
        id="notification-panel"
        hidden
      >

        <div class="notification-panel-header">

          <strong>
            Notifications
          </strong>

          <button
            id="close-notifications"
          >
            ×
          </button>

        </div>

        <div
          id="notification-list"
          class="notification-list"
        >
          ${renderNotifications()}
        </div>

      </div>

    </header>
  `;
}

function getPageTitle() {
  const titles = {
    home: "Home",
    calendar: "Calendar",
    assignments: "Assignments",
    notifications: "Notifications",
    messages: "Messages",
    "care-team": "The Care Team",
    flashcards: "Flashcards",
    "quiz-maker": "Quiz Maker",
    "study-timer": "Study Timer",
    "study-checklist":
      "Study Checklist",
    "chapter-tracker":
      "Chapter Tracker",
    progress: "Progress",
    install: "Student Hub App",
    profile: "My Profile",
    account: "Account",
    search: "Search"
  };

  return (
    titles[state.currentPage] ||
    "StudentHub"
  );
}

/* =========================================================
   APP SHELL
   ========================================================= */

function renderAppShell() {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="app-shell">

      ${renderSidebar()}

      <div
        class="mobile-overlay"
        id="mobile-overlay"
      ></div>

      <div class="main-area">

        ${renderTopbar()}

        <main
          class="page-container"
          id="page-container"
        >
          ${renderPageContent()}
        </main>

      </div>

    </div>
  `;

  attachShellEvents();

  window.dispatchEvent(new Event("studenthub-shell-ready"));
}

function attachShellEvents() {
  document
    .querySelectorAll("[data-page]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          navigate(
            button.dataset.page
          );
        }
      );
    });

  $("#mobile-menu-button")
    ?.addEventListener(
      "click",
      openMobileMenu
    );

  $("#mobile-overlay")
    ?.addEventListener(
      "click",
      closeMobileMenu
    );

  $("#account-button")
    ?.addEventListener(
      "click",
      toggleAccountMenu
    );

  $("#notifications-button")
    ?.addEventListener(
      "click",
      () => navigate("notifications")
    );

  $("#close-notifications")
    ?.addEventListener(
      "click",
      closeNotificationPanel
    );

  $("#messages-button")
    ?.addEventListener(
      "click",
      () => navigate("messages")
    );

  $("#topbar-search-button")?.addEventListener("click", () => navigate("search"));

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
}

function openMobileMenu() {
  $("#sidebar")
    ?.classList.add("open");

  $("#mobile-overlay")
    ?.classList.add("visible");
}

function closeMobileMenu() {
  $("#sidebar")
    ?.classList.remove("open");

  $("#mobile-overlay")
    ?.classList.remove("visible");
}

function toggleAccountMenu() {
  const menu = $("#account-menu");

  if (!menu) return;

  menu.hidden = !menu.hidden;

  closeNotificationPanel();
}

function toggleNotificationPanel() {
  const panel =
    $("#notification-panel");

  if (!panel) return;

  panel.hidden = !panel.hidden;

  const menu =
    $("#account-menu");

  if (menu) {
    menu.hidden = true;
  }
}

function closeNotificationPanel() {
  const panel =
    $("#notification-panel");

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

  await hydratePage(page);
}

function renderPageContent() {
  switch (state.currentPage) {
    case "home":
      return renderHome();

    case "calendar":
      return renderCalendar();

    case "assignments":
      return renderAssignments();

    case "notifications":
      return renderNotificationPage();

    case "messages":
      return renderMessagesPage();

    case "care-team":
      return renderCareTeam();

    case "flashcards":
      return renderFlashcards();

    case "quiz-maker":
      return renderQuizMaker();

    case "study-timer":
      return renderStudyTimer();

    case "study-checklist":
      return renderStudyChecklist();

    case "chapter-tracker":
      return renderChapterTracker();

    case "progress":
      return renderProgress();

    case "install":
      return renderInstallStudentHub();

    case "profile":
      return renderProfile();

    case "account":
      return renderAccount();

    case "admin":
      return renderAdmin();
    case "search":
      return renderSearch();

    default:
      return renderHome();
  }
}

async function hydratePage(page) {
  if (page === "home") {
    await hydrateHome();
  }

  if (page === "calendar") {
    await hydrateCalendar();
  }

  if (page === "assignments") {
    await hydrateAssignments();
  }

  if (page === "notifications") {
    await hydrateNotificationsPage();
  }

  if (page === "messages") {
    await hydrateMessages();
  }

  if (page === "care-team") {
    await hydrateCareTeam();
  }

  if (page === "flashcards") {
    await hydrateFlashcards();
  }

  if (page === "quiz-maker") {
    await hydrateQuizMaker();
  }

  if (page === "study-timer") {
    await hydrateStudyTimer();
  }

  if (page === "study-checklist") {
    await hydrateStudyChecklist();
  }

  if (page === "chapter-tracker") {
    await hydrateChapterTracker();
  }

  if (page === "progress") {
    await hydrateProgress();
  }

  if (page === "install") {
    attachInstallPageEvents();
  }

  if (page === "profile") {
    await hydrateProfile();
  }

  if (page === "account") {
    await hydrateAccount();
  }
  if (page === "admin") {
    await hydrateAdmin();
  }

  if (page === "search") {
    await hydrateSearch();
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
            ${escapeHtml(
              getGreeting()
            )},
            ${escapeHtml(
              getDisplayName()
            )} 👋
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
              <span class="panel-icon">
                📊
              </span>

              <h2>
                Status Report
              </h2>
            </div>

          </div>

          <div id="status-report-content">
            ${renderAcademicStatus()}
          </div>

        </section>

        <section class="panel feed-panel">

          <div class="panel-header">

            <div>
              <span class="panel-icon">
                📰
              </span>

              <h2>
                Main Feed
              </h2>
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
              <span class="panel-icon">
                🟢
              </span>

              <h2>
                Who's Active
              </h2>

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
    loadActiveUsers(),
    loadNotifications()
  ]);

  const status =
    $("#status-report-content");

  const feed =
    $("#feed-content");

  const active =
    $("#active-users-content");

  if (status) {
    status.innerHTML =
      renderAcademicStatus();
  }

  if (feed) {
    feed.innerHTML =
      renderFeed();

    attachFeedEvents();
  }

  if (active) {
    active.innerHTML =
      renderActiveUsers();
  }

  $("#create-post-button")
    ?.addEventListener(
      "click",
      openCreatePostDialog
    );
}

function renderAcademicStatus() {
  const summary =
    state.academicSummary;

  const tests =
    Number(
      summary?.total_tests || 0
    );

  const chaptersCompleted =
    new Set(
      state.scoreDetails
        .map(
          (item) =>
            item.chapter_id
        )
        .filter(Boolean)
    ).size;

  const latest =
    state.scoreDetails[0];

  if (!summary && !tests) {
    return `
      <div class="empty-state">

        <div class="empty-icon">
          📊
        </div>

        <h3>
          No academic data yet
        </h3>

        <p>
          Add your first score in Chapter Tracker.
        </p>

      </div>
    `;
  }

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
    summary?.GPA !== undefined &&
    summary?.GPA !== null
      ? Number(
          summary.GPA
        ).toFixed(2)
      : summary?.gpa !== undefined &&
        summary?.gpa !== null
      ? Number(
          summary.gpa
        ).toFixed(2)
      : "—";

  const letter =
    summary?.overall_letter_grade ||
    calculateLetterGrade(
      summary?.overall_average
    );

  const consistency =
    summary?.score_consistency !==
      null &&
    summary?.score_consistency !==
      undefined
      ? Number(
          summary.score_consistency
        ).toFixed(2)
      : "—";

  return `
    <div class="status-main">

      <div class="status-average">

        <span>
          Overall Average
        </span>

        <strong>
          ${average}
        </strong>

        <small
          class="${getLetterClass(
            letter
          )}"
        >
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
          <strong>${tests}</strong>
        </div>

        <div class="status-stat">
          <span>Consistency</span>
          <strong>
            ${consistency}
          </strong>
        </div>

        <div class="status-stat">
          <span>Chapters</span>
          <strong>
            ${chaptersCompleted}
          </strong>
        </div>

        <div class="status-stat">
          <span>Latest Score</span>
          <strong>
            ${
              latest?.score !==
              undefined
                ? `${Number(
                    latest.score
                  ).toFixed(2)}%`
                : "—"
            }
          </strong>
        </div>

        <div class="status-stat">
          <span>Classes</span>
          <strong>
            ${summary?.total_classes ?? 0}
          </strong>
        </div>

      </div>

    </div>
  `;
}

/* =========================================================
   CALENDAR
   ========================================================= */

async function loadCalendarEvents() {
  if (!supabaseClient || !state.user) return [];

  const { data, error } = await supabaseClient
    .from("calendar_events")
    .select("*")
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Calendar load error:", error);
    state.calendarEvents = [];
    return [];
  }

  state.calendarEvents = data || [];
  return state.calendarEvents;
}

function getCalendarMonthDays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < startDay; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function renderCalendar() {
  const date = state.calendarDate;

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">STUDENTHUB</p>
          <h1>Calendar</h1>
          <p>Keep track of tests, class events, assignments, and important dates.</p>
        </div>
        <button class="primary-button" id="add-calendar-event">+ Add Event</button>
      </div>

      <div class="panel calendar-panel">
        <div class="calendar-toolbar">
          <button class="secondary-button" id="calendar-prev">←</button>
          <h2>${date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <button class="secondary-button" id="calendar-next">→</button>
        </div>

        <div class="calendar-weekdays">
          ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => `<span>${day}</span>`).join("")}
        </div>

        <div class="calendar-grid">
          ${renderCalendarDays()}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div><span class="panel-icon">📅</span><h2>This Month</h2></div>
        </div>
        <div id="calendar-events">
          ${renderCalendarEvents()}
        </div>
      </div>
    </section>
  `;
}

function renderCalendarDays() {
  const today = new Date();
  const month = state.calendarDate.getMonth();
  const year = state.calendarDate.getFullYear();
  const days = getCalendarMonthDays(state.calendarDate);

  return days.map(day => {
    if (!day) return '<div class="calendar-day calendar-day-empty"></div>';

    const dayEvents = state.calendarEvents.filter(event => {
      const value = new Date(event.start_time || event.event_date || event.created_at);
      return value.getFullYear() === year &&
        value.getMonth() === month &&
        value.getDate() === day.getDate();
    });

    const isToday =
      day.getFullYear() === today.getFullYear() &&
      day.getMonth() === today.getMonth() &&
      day.getDate() === today.getDate();

    return `
      <div class="calendar-day ${isToday ? "calendar-day-today" : ""}">
        <div class="calendar-day-number">${day.getDate()}</div>
        <div class="calendar-day-events">
          ${dayEvents.slice(0, 3).map(event => `
            <div class="calendar-day-event" title="${escapeHtml(event.title || "Event")}">
              ${escapeHtml(event.title || "Event")}
            </div>
          `).join("")}
          ${dayEvents.length > 3 ? `<div class="calendar-more">+${dayEvents.length - 3} more</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderCalendarEvents() {
  const month = state.calendarDate.getMonth();
  const year = state.calendarDate.getFullYear();

  const events = state.calendarEvents.filter(event => {
    const value = new Date(event.start_time || event.event_date || event.created_at);
    return value.getMonth() === month && value.getFullYear() === year;
  });

  if (!events.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No events this month</h3>
        <p>Add an event to get started.</p>
      </div>
    `;
  }

  return `
    <div class="calendar-event-list">
      ${events.map(event => `
        <article class="calendar-event-card">
          <div class="calendar-event-date">
            ${formatDate(event.start_time || event.event_date)}
          </div>
          <div class="calendar-event-content">
            <strong>${escapeHtml(event.title || event.name || "Calendar Event")}</strong>
            <p>${escapeHtml(event.description || "")}</p>
            ${event.start_time ? `<small>🕐 ${formatTime(event.start_time)}</small>` : ""}
            ${event.location ? `<small>📍 ${escapeHtml(event.location)}</small>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

async function hydrateCalendar() {
  await loadCalendarEvents();

  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderCalendar();

  $("#calendar-prev")?.addEventListener("click", async () => {
    state.calendarDate = new Date(
      state.calendarDate.getFullYear(),
      state.calendarDate.getMonth() - 1,
      1
    );
    await navigate("calendar");
  });

  $("#calendar-next")?.addEventListener("click", async () => {
    state.calendarDate = new Date(
      state.calendarDate.getFullYear(),
      state.calendarDate.getMonth() + 1,
      1
    );
    await navigate("calendar");
  });

  $("#add-calendar-event")?.addEventListener("click", addCalendarEvent);
}

async function addCalendarEvent() {
  if (!supabaseClient || !state.user) return;

  const title = prompt("Event title:");
  if (!title?.trim()) return;

  const date = prompt(
    "Event date (YYYY-MM-DD):",
    new Date().toISOString().split("T")[0]
  );
  if (!date) return;

  const description = prompt("Description (optional):");
  const location = prompt("Location (optional):");

  const payload = {
    user_id: state.user.id,
    title: title.trim(),
    description: description?.trim() || null,
    start_time: `${date}T12:00:00`,
    location: location?.trim() || null,
    created_by: state.user.id
  };

  let result = await supabaseClient.from("calendar_events").insert(payload);

  if (result.error) {
    const fallback = { ...payload };
    delete fallback.user_id;
    delete fallback.location;
    result = await supabaseClient.from("calendar_events").insert(fallback);
  }

  if (result.error) {
    showMessage(result.error.message || "Unable to create event.", "error");
    return;
  }

  showMessage("Calendar event added.");
  await navigate("calendar");
}

/* =========================================================
   ASSIGNMENTS
   ========================================================= */

async function loadAssignments() {
  if (!supabaseClient || !state.user) return [];
  const { data, error } = await supabaseClient
    .from("assignments")
    .select("*")
    .eq("user_id", state.user.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("Assignments load error:", error);
    state.assignments = [];
    return [];
  }

  state.assignments = data || [];
  return state.assignments;
}

function assignmentStatusLabel(status) {
  return ({
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed"
  })[status] || "Not Started";
}

function assignmentStatusIcon(status) {
  return ({
    not_started: "○",
    in_progress: "◐",
    completed: "✓"
  })[status] || "○";
}

function assignmentPriorityLabel(priority) {
  return ({
    low: "Low",
    normal: "Normal",
    high: "High"
  })[priority] || "Normal";
}

function assignmentIsOverdue(item) {
  if (!item?.due_date || item.status === "completed") return false;
  const due = new Date(`${item.due_date}T23:59:59`);
  return due.getTime() < Date.now();
}

function renderAssignments() {
  const active = state.assignments.filter(a => a.status !== "completed");
  const completed = state.assignments.filter(a => a.status === "completed");
  const overdue = active.filter(assignmentIsOverdue);

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">STUDENTHUB</p>
          <h1>Assignments</h1>
          <p>Keep track of classwork, due dates, and what still needs to be finished.</p>
        </div>
        <button class="primary-button" id="add-assignment-button" type="button">+ Add Assignment</button>
      </div>

      <div class="assignment-summary-grid">
        <div class="panel assignment-stat">
          <strong>${active.length}</strong>
          <span>Active</span>
        </div>
        <div class="panel assignment-stat">
          <strong>${completed.length}</strong>
          <span>Completed</span>
        </div>
        <div class="panel assignment-stat">
          <strong>${overdue.length}</strong>
          <span>Overdue</span>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📝</span>
            <h2>My Assignments</h2>
          </div>
          <span class="assignment-count">${state.assignments.length} total</span>
        </div>
        ${renderAssignmentList()}
      </div>

      <div class="assignment-modal-backdrop" id="assignment-modal" hidden>
        <div class="assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title">
          <div class="assignment-modal-header">
            <div>
              <p class="eyebrow" id="assignment-modal-eyebrow">NEW ASSIGNMENT</p>
              <h2 id="assignment-modal-title">Add Assignment</h2>
            </div>
            <button class="icon-button" id="close-assignment-modal" type="button" aria-label="Close">×</button>
          </div>

          <form id="assignment-form" class="assignment-form">
            <input id="assignment-edit-id" type="hidden" />

            <label class="field-label" for="assignment-title">Assignment name</label>
            <input id="assignment-title" class="text-input" type="text" maxlength="200" placeholder="e.g. Chapter 6 worksheet" required />

            <label class="field-label" for="assignment-description">Description</label>
            <textarea id="assignment-description" class="text-input" rows="3" maxlength="2000" placeholder="Optional details"></textarea>

            <div class="assignment-form-grid">
              <div>
                <label class="field-label" for="assignment-due-date">Due date</label>
                <input id="assignment-due-date" class="text-input" type="date" />
              </div>
              <div>
                <label class="field-label" for="assignment-priority">Priority</label>
                <select id="assignment-priority" class="text-input">
                  <option value="low">Low</option>
                  <option value="normal" selected>Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div id="assignment-status-field" hidden>
              <label class="field-label" for="assignment-status">Status</label>
              <select id="assignment-status" class="text-input">
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div id="assignment-form-message" class="form-error"></div>

            <div class="assignment-modal-actions">
              <button class="secondary-button" id="cancel-assignment-modal" type="button">Cancel</button>
              <button class="primary-button" id="save-assignment-button" type="submit">Save Assignment</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

function renderAssignmentList() {
  if (!state.assignments.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>No assignments yet</h3>
        <p>Add your first class assignment to start tracking your work.</p>
        <button class="secondary-button" type="button" id="empty-add-assignment">+ Add Assignment</button>
      </div>
    `;
  }

  return `
    <div class="assignment-list">
      ${state.assignments.map(item => {
        const overdue = assignmentIsOverdue(item);
        const status = item.status || "not_started";

        return `
          <article class="assignment-item ${overdue ? "assignment-overdue" : ""} ${status === "completed" ? "assignment-completed" : ""}">
            <div class="assignment-main">
              <div class="assignment-title-row">
                <h3>${escapeHtml(item.title || "Assignment")}</h3>
                <span class="assignment-status status-${escapeHtml(status)}">
                  ${assignmentStatusIcon(status)} ${escapeHtml(assignmentStatusLabel(status))}
                </span>
              </div>

              <p>${escapeHtml(item.description || "No description")}</p>

              <div class="assignment-meta">
                <span class="${overdue ? "assignment-meta-overdue" : ""}">
                  📅 ${item.due_date ? escapeHtml(formatDate(item.due_date)) : "No due date"}
                  ${overdue ? " • Overdue" : ""}
                </span>
                <span>⚑ ${escapeHtml(assignmentPriorityLabel(item.priority))}</span>
              </div>
            </div>

            <div class="assignment-actions">
              <button class="secondary-button" data-assignment-status="${escapeHtml(item.id)}" type="button">Change Status</button>
              <button class="secondary-button" data-assignment-edit="${escapeHtml(item.id)}" type="button">Edit</button>
              <button class="danger-action" data-assignment-delete="${escapeHtml(item.id)}" type="button">Delete</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function openAssignmentModal(id = null) {
  const modal = $("#assignment-modal");
  if (!modal) return;

  const item = id
    ? state.assignments.find(a => String(a.id) === String(id))
    : null;

  $("#assignment-edit-id").value = item?.id || "";
  $("#assignment-title").value = item?.title || "";
  $("#assignment-description").value = item?.description || "";
  $("#assignment-due-date").value = item?.due_date || "";
  $("#assignment-priority").value = item?.priority || "normal";
  $("#assignment-status").value = item?.status || "not_started";

  const editing = Boolean(item);
  $("#assignment-modal-eyebrow").textContent = editing ? "EDIT ASSIGNMENT" : "NEW ASSIGNMENT";
  $("#assignment-modal-title").textContent = editing ? "Edit Assignment" : "Add Assignment";
  $("#save-assignment-button").textContent = editing ? "Save Changes" : "Save Assignment";
  $("#assignment-status-field").hidden = !editing;

  const message = $("#assignment-form-message");
  if (message) {
    message.className = "form-error";
    message.textContent = "";
  }

  modal.hidden = false;
  document.body.classList.add("modal-open");
  setTimeout(() => $("#assignment-title")?.focus(), 0);
}

function closeAssignmentModal() {
  const modal = $("#assignment-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

async function saveAssignment(event) {
  event.preventDefault();
  if (!supabaseClient || !state.user) return;

  const id = $("#assignment-edit-id")?.value || null;
  const title = $("#assignment-title")?.value.trim();
  const description = $("#assignment-description")?.value.trim() || null;
  const dueDate = $("#assignment-due-date")?.value || null;
  const priority = $("#assignment-priority")?.value || "normal";
  const status = $("#assignment-status")?.value || "not_started";
  const message = $("#assignment-form-message");
  const button = $("#save-assignment-button");

  if (message) {
    message.className = "form-error";
    message.textContent = "";
  }

  if (!title) {
    if (message) message.textContent = "Enter an assignment name.";
    return;
  }

  if (!["low", "normal", "high"].includes(priority)) {
    if (message) message.textContent = "Choose a valid priority.";
    return;
  }

  if (!["not_started", "in_progress", "completed"].includes(status)) {
    if (message) message.textContent = "Choose a valid status.";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = id ? "Saving..." : "Adding...";
  }

  try {
    const currentClass = getCurrentClass();

    if (!currentClass?.id) {
      throw new Error("No class is selected for this assignment. Open Class and select your class, then try again.");
    }

    const values = {
      class_id: currentClass.id,
      title,
      description,
      due_date: dueDate,
      priority,
      status
    };

    let data;

    if (id) {
      const result = await supabaseClient
        .from("assignments")
        .update(values)
        .eq("id", id)
        .eq("user_id", state.user.id)
        .select("*")
        .single();

      if (result.error) throw result.error;
      data = result.data;
    } else {
      const result = await supabaseClient
        .from("assignments")
        .insert({
          user_id: state.user.id,
          ...values
        })
        .select("*")
        .single();

      if (result.error) throw result.error;
      data = result.data;
    }

    if (!data?.id) {
      throw new Error("Assignment was not returned after saving.");
    }

    const existingIndex = state.assignments.findIndex(
      item => String(item.id) === String(data.id)
    );

    if (existingIndex >= 0) {
      state.assignments = state.assignments.map(item =>
        String(item.id) === String(data.id) ? data : item
      );
    } else {
      state.assignments = [...state.assignments, data];
    }

    closeAssignmentModal();
    showMessage(id ? "Assignment updated." : "Assignment saved.");
    await navigate("assignments");
  } catch (error) {
    console.error("Assignment save error:", error);
    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to save assignment. Check Supabase permissions.";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = id ? "Save Changes" : "Save Assignment";
    }
  }
}

async function changeAssignmentStatus(id) {
  const item = state.assignments.find(a => String(a.id) === String(id));
  if (!item) return;

  openAssignmentModal(id);
}

async function deleteAssignment(id) {
  const item = state.assignments.find(a => String(a.id) === String(id));
  if (!item) return;

  if (!confirm(`Delete "${item.title || "this assignment"}"? This cannot be undone.`)) {
    return;
  }

  const { error } = await supabaseClient
    .from("assignments")
    .delete()
    .eq("id", id)
    .eq("user_id", state.user.id);

  if (error) {
    showMessage(error.message || "Unable to delete assignment.", "error");
    return;
  }

  state.assignments = state.assignments.filter(
    assignment => String(assignment.id) !== String(id)
  );

  showMessage("Assignment deleted.");
  await navigate("assignments");
}

async function hydrateAssignments() {
  await loadAssignments();

  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderAssignments();

  $("#add-assignment-button")?.addEventListener("click", () => openAssignmentModal());
  $("#empty-add-assignment")?.addEventListener("click", () => openAssignmentModal());
  $("#close-assignment-modal")?.addEventListener("click", closeAssignmentModal);
  $("#cancel-assignment-modal")?.addEventListener("click", closeAssignmentModal);
  $("#assignment-form")?.addEventListener("submit", saveAssignment);

  $("#assignment-modal")?.addEventListener("click", event => {
    if (event.target.id === "assignment-modal") {
      closeAssignmentModal();
    }
  });

  document.querySelectorAll("[data-assignment-status]").forEach(button => {
    button.addEventListener("click", () => changeAssignmentStatus(button.dataset.assignmentStatus));
  });

  document.querySelectorAll("[data-assignment-edit]").forEach(button => {
    button.addEventListener("click", () => openAssignmentModal(button.dataset.assignmentEdit));
  });

  document.querySelectorAll("[data-assignment-delete]").forEach(button => {
    button.addEventListener("click", () => deleteAssignment(button.dataset.assignmentDelete));
  });
}

/* =========================================================
   CARE TEAM
   ========================================================= */

async function loadCareConversations() {
  if (!supabaseClient || !state.user) return [];

  await loadActiveUsers();

  // Load the conversations the signed-in user is actually a member of.
  // This makes private conversations persist in the Messages list even
  // when conversation-level RLS or ordering changes.
  const { data: myMemberships, error: membershipError } = await supabaseClient
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", state.user.id);

  if (membershipError) {
    console.error("Conversation membership load error:", membershipError);
    state.conversations = [];
    return [];
  }

  const myConversationIds = [
    ...new Set((myMemberships || []).map((row) => row.conversation_id).filter(Boolean))
  ];

  let conversations = [];

  if (myConversationIds.length) {
    const { data, error } = await supabaseClient
      .from("conversations")
      .select("*")
      .in("id", myConversationIds)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Conversation load error:", error);
      state.conversations = [];
      return [];
    }

    conversations = data || [];
  }

  // Direct conversations are also loaded by creator. This is an important
  // fallback for the sender: the creator is always allowed to see the
  // conversation even if membership visibility has not refreshed yet.
  const { data: createdDirects, error: createdDirectError } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("type", "direct")
    .eq("created_by", state.user.id)
    .order("updated_at", { ascending: false });

  if (!createdDirectError && createdDirects?.length) {
    const existingIds = new Set(conversations.map((conversation) => conversation.id));
    for (const conversation of createdDirects) {
      if (!existingIds.has(conversation.id)) {
        conversations.push(conversation);
      }
    }
  }

  // Last-resort persistence fallback: if a private message was sent,
  // the message row itself gives us the conversation ID. This makes the
  // Messages list resilient even if membership rows are temporarily omitted
  // from a query or cached auth/RLS state.
  const { data: sentMessages, error: sentMessagesError } = await supabaseClient
    .from("messages")
    .select("conversation_id, created_at")
    .eq("sender_id", state.user.id)
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!sentMessagesError && sentMessages?.length) {
    const sentDirectIds = [
      ...new Set(sentMessages.map((row) => row.conversation_id).filter(Boolean))
    ];

    const missingIds = sentDirectIds.filter(
      (id) =>
        !conversations.some(
          (conversation) => conversation.id === id
        )
    );

    if (missingIds.length) {
      const { data: sentDirectConversations, error: sentDirectError } =
        await supabaseClient
          .from("conversations")
          .select("*")
          .eq("type", "direct")
          .in("id", missingIds);

      if (!sentDirectError && sentDirectConversations?.length) {
        conversations.push(...sentDirectConversations);
      }
    }
  }

  // The Care Team is always discoverable, even before a newly registered
  // student has opened it for the first time.
  const { data: groupConversation, error: groupError } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("type", "group")
    .eq("name", "The Care Team")
    .maybeSingle();

  if (!groupError && groupConversation && !conversations.some((item) => item.id === groupConversation.id)) {
    conversations.push(groupConversation);
  }

  let members = [];

  if (conversations.length) {
    const conversationIds = conversations.map((conversation) => conversation.id);

    const { data, error: memberError } = await supabaseClient
      .from("conversation_members")
      .select(`
        conversation_id,
        user_id,
        profiles (
          id,
          display_name,
          full_name,
          avatar_url
        )
      `)
      .in("conversation_id", conversationIds);

    if (memberError) {
      console.error("Conversation member load error:", memberError);
      state.conversations = [];
      return [];
    }

    members = data || [];
  }

  state.conversations = conversations.map((conversation) => {
    const conversationMembers = members.filter(
      (member) => member.conversation_id === conversation.id
    );

    const otherMember = conversationMembers.find(
      (member) => member.user_id !== state.user?.id
    );

    return {
      ...conversation,
      members: conversationMembers,
      otherMember: otherMember?.profiles || null
    };
  });

  const group = state.conversations.find(
    (conversation) =>
      conversation.type === "group" &&
      conversation.name === "The Care Team"
  );

  if (group) {
    const isMember = group.members.some(
      (member) => member.user_id === state.user?.id
    );

    if (!isMember) {
      const { error: joinError } = await supabaseClient
        .from("conversation_members")
        .insert({
          conversation_id: group.id,
          user_id: state.user.id
        });

      if (!joinError) {
        group.members.push({
          user_id: state.user.id,
          profiles: state.profile
        });
      }
    }

    if (!state.currentConversationId && state.currentConversationType !== "direct") {
      state.currentConversationId = group.id;
    }
  }

  return state.conversations;
}
async function loadClassmates() {
  if (!supabaseClient || !state.user) return [];

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, full_name, avatar_url")
    .neq("id", state.user.id)
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Classmate load error:", error);
    state.classmates = [];
    return [];
  }

  state.classmates = data || [];
  return state.classmates;
}

async function markConversationRead() {
  if (!supabaseClient || !state.user || !state.currentConversationId) return;
  const now = new Date().toISOString();
  state.careReadAt = now;
  state.careUnreadCount = 0;
  await supabaseClient.from("message_reads").upsert({
    conversation_id: state.currentConversationId,
    user_id: state.user.id,
    last_read_at: now
  }, { onConflict: "conversation_id,user_id" });
}

function calculateCareUnread() {
  const readAt = state.careReadAt ? new Date(state.careReadAt).getTime() : 0;
  state.careUnreadCount = state.careMessages.filter((message) => {
    const sender = message.sender_id || message.user_id;
    return sender !== state.user?.id && new Date(message.created_at).getTime() > readAt;
  }).length;
  return state.careUnreadCount;
}

async function loadCareReadState() {
  if (!supabaseClient || !state.user || !state.currentConversationId) return null;
  const { data } = await supabaseClient.from("message_reads").select("last_read_at")
    .eq("conversation_id", state.currentConversationId).eq("user_id", state.user.id).maybeSingle();
  state.careReadAt = data?.last_read_at || null;
  return state.careReadAt;
}

async function loadCareMessages() {
  if (!supabaseClient || !state.currentConversationId) {
    state.careMessages = [];
    return [];
  }

  // Load messages without relying on a specific foreign-key relationship
  // between messages and profiles. The current messages table uses
  // sender_id as its required sender field.
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", state.currentConversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Care Team message load error:", error);
    state.careMessages = [];
    return [];
  }

  const messages = data || [];
  const senderIds = [
    ...new Set(
      messages
        .map((message) => message.sender_id || message.user_id)
        .filter(Boolean)
    )
  ];

  let profilesById = {};

  if (senderIds.length) {
    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, display_name, full_name, avatar_url")
      .in("id", senderIds);

    if (profileError) {
      console.warn("Care Team profile load warning:", profileError);
    } else {
      profilesById = Object.fromEntries(
        (profiles || []).map((profile) => [profile.id, profile])
      );
    }
  }

  state.careMessages = messages.map((message) => {
    const senderId = message.sender_id || message.user_id;

    return {
      ...message,
      profiles: profilesById[senderId] || null
    };
  });

  return state.careMessages;
}

async function loadPinnedMessages() {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("pinned_messages")
    .select("*");

  if (error) {
    state.pinnedMessages = [];
    return [];
  }

  state.pinnedMessages =
    data || [];

  return state.pinnedMessages;
}

async function loadMessageReactions() {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("message_reactions")
    .select("*");

  if (error) {
    state.messageReactions = [];
    return [];
  }

  state.messageReactions = data || [];
  return state.messageReactions;
}

const CARE_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "👏"];

function getMessageReactionCount(messageId, reaction = "❤️") {
  return state.messageReactions.filter(item => item.message_id === messageId && item.reaction === reaction).length;
}

function hasMyMessageReaction(messageId, reaction = "❤️") {
  return state.messageReactions.some(item => item.message_id === messageId && item.user_id === state.user?.id && item.reaction === reaction);
}

function renderMessageReactions(messageId) {
  return CARE_REACTIONS.map((reaction) => {
    const count = getMessageReactionCount(messageId, reaction);
    const active = hasMyMessageReaction(messageId, reaction);
    return "<button type=\"button\" data-react-message=\"" + escapeHtml(messageId) + "\" data-reaction=\"" + reaction + "\" class=\"" + (active ? "active" : "") + "\">" + reaction + (count ? " <span>" + count + "</span>" : "") + "</button>";
  }).join("");
}

function getPresenceStatus(userId) {
  const active = (state.activeUsers || []).find(item => String(item.id || item.user_id) === String(userId));
  if (!active?.last_seen_at) return "Offline";
  const age = Date.now() - new Date(active.last_seen_at).getTime();
  if (!Number.isFinite(age) || age > 2 * 60 * 1000) return "Offline";
  if (String(active.status || "").toLowerCase() === "idle") return "Idle";
  return "Online";
}

function renderPresenceBadge(userId) {
  const status = getPresenceStatus(userId);
  return `<span class="presence-badge ${status.toLowerCase()}"><span class="presence-dot ${status.toLowerCase()}"></span>${status}</span>`;
}

function isMessagePinned(messageId) {
  return state.pinnedMessages.some(
    item => item.message_id === messageId
  );
}

function renderCareTeam() {
  const group = state.conversations.find(
    (conversation) =>
      conversation.type === "group" &&
      conversation.name === "The Care Team"
  );

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">GROUP CHAT</p>
          <h1>The Care Team</h1>
          <p>Your CNA class group chat.</p>
        </div>
      </div>

      <div class="panel care-team-panel">
        <div class="conversation-header">
          <div class="conversation-header-avatar">💬</div>
          <div>
            <strong>The Care Team</strong>
            <span>${group ? "Class group chat" : "Group chat"}</span>
          </div>
        </div>

        <div class="care-team-toolbar care-team-toolbar-expanded">
          <div>
            <strong>Class Chat</strong>
            <span>React, reply, pin, edit, and message your classmates.</span>
          </div>
          <div class="care-team-toolbar-actions">
            <button type="button" class="secondary-button small-button" id="care-members-button">👥 Members</button>
            <button type="button" class="secondary-button small-button" id="new-message-button">+ New Message</button>
          </div>
        </div>
        <div class="care-team-tools">
          <div class="care-search-box">
            <span>🔎</span>
            <input id="care-message-search" class="text-input" type="search" value="${escapeHtml(state.careSearchQuery)}" placeholder="Search messages..." autocomplete="off" />
            ${state.careSearchQuery ? '<button type="button" id="care-search-clear" class="secondary-button small-button">Clear</button>' : ""}
          </div>
          <span class="care-message-count">${state.careMessages.length} message${state.careMessages.length === 1 ? "" : "s"}${state.careUnreadCount ? " · " + state.careUnreadCount + " unread" : ""}</span>
        </div>
        ${state.showNewMessage ? renderNewMessageList() : ""}
        ${renderPinnedMessageStrip()}
        <div class="care-team-messages" id="care-team-messages">
          ${renderCareMessages()}
        </div>

        <form id="care-message-form" class="care-message-form">
          <input
            id="care-message-input"
            class="text-input"
            type="text"
            maxlength="2000"
            placeholder="Message The Care Team..."
            autocomplete="off"
            required
          />
          <button class="primary-button" type="submit">Send</button>
        </form>
      </div>
    </section>
  `;
}

function renderMessagesPage() {
  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">MESSAGES</p>
          <h1>Messages</h1>
          <p>Message your CNA classmates one-on-one.</p>
        </div>
      </div>

      <div class="panel messages-page-panel">
        <div class="messages-page-header">
          <div>
            <strong>Your conversations</strong>
            <span>Private messages with classmates</span>
          </div>
          <button class="secondary-button small-button" id="messages-new-button" type="button">
            + New Message
          </button>
        </div>

        <div id="messages-conversation-list">
          ${renderDirectConversationList()}
        </div>

        ${state.showNewMessage ? renderNewMessageList() : ""}
      </div>
    </section>
  `;
}

function renderDirectConversationList() {
  const direct = state.conversations
    .filter((conversation) => conversation.type === "direct")
    .sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });

  if (!direct.length) {
    return `
      <div class="conversation-empty">
        <div class="empty-icon">💬</div>
        <h3>No direct messages yet</h3>
        <p>Start a private conversation with a classmate.</p>
      </div>
    `;
  }

  return `
    <div class="conversation-list messages-page-list">
      ${direct.map((conversation) => {
        const name =
          conversation.otherMember?.display_name ||
          conversation.otherMember?.full_name ||
          "Classmate";

        return `
          <button
            class="conversation-item"
            data-conversation-id="${escapeHtml(conversation.id)}"
            type="button"
          >
            <span class="conversation-avatar">
              ${conversation.otherMember?.avatar_url
                ? `<img src="${escapeHtml(conversation.otherMember.avatar_url)}" alt="" />`
                : escapeHtml(getInitials(name))}
            </span>
            <span class="conversation-item-text">
              <strong>${escapeHtml(name)}</strong>
              <small>${renderPresenceBadge(conversation.otherMember?.id)}</small>
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

async function hydrateMessages() {
  state.currentConversationType = null;
  state.currentConversationId = null;

  await loadCareConversations();
  await loadClassmates();

  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderMessagesPage();

  $("#messages-new-button")?.addEventListener("click", async () => {
    state.showNewMessage = true;
    await hydrateMessages();
  });

  $("#close-new-message")?.addEventListener("click", async () => {
    state.showNewMessage = false;
    await hydrateMessages();
  });

  document.querySelectorAll("[data-start-dm]").forEach((button) => {
    button.addEventListener("click", () =>
      startDirectMessage(button.dataset.startDm)
    );
  });

  document.querySelectorAll("[data-conversation-id]").forEach((button) => {
    button.addEventListener("click", () =>
      openConversation(button.dataset.conversationId)
    );
  });

  $("#classmate-search")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const list = $("#classmate-list");
    const filtered = state.classmates.filter((classmate) => {
      const name =
        classmate.display_name ||
        classmate.full_name ||
        "";
      return name.toLowerCase().includes(query);
    });
    if (list) list.innerHTML = renderClassmateList(filtered);
    document.querySelectorAll("[data-start-dm]").forEach((button) => {
      button.addEventListener("click", () =>
        startDirectMessage(button.dataset.startDm)
      );
    });
  });
}

function renderConversationList() {
  const group = state.conversations.find(
    (conversation) =>
      conversation.type === "group" &&
      conversation.name === "The Care Team"
  );

  const direct = state.conversations
    .filter((conversation) => conversation.type === "direct")
    .sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });

  return `
    ${group ? `
      <button
        class="conversation-item pinned-conversation ${group.id === state.currentConversationId ? "active" : ""}"
        data-conversation-id="${escapeHtml(group.id)}"
        type="button"
      >
        <span class="conversation-avatar">💬</span>
        <span class="conversation-item-text">
          <strong>The Care Team</strong>
          <small>📌 Pinned group chat · ${group.members?.length || 0} members</small>
        </span>
      </button>
    ` : ""}

    ${direct.map((conversation) => {
      const name =
        conversation.otherMember?.display_name ||
        conversation.otherMember?.full_name ||
        "Classmate";

      return `
        <button
          class="conversation-item ${conversation.id === state.currentConversationId ? "active" : ""}"
          data-conversation-id="${escapeHtml(conversation.id)}"
          type="button"
        >
          <span class="conversation-avatar">
            ${conversation.otherMember?.avatar_url
              ? `<img src="${escapeHtml(conversation.otherMember.avatar_url)}" alt="" />`
              : escapeHtml(getInitials(name))}
          </span>
          <span class="conversation-item-text">
            <strong>${escapeHtml(name)}</strong>
            <small>${renderPresenceBadge(conversation.otherMember?.id)}</small>
          </span>
        </button>
      `;
    }).join("")}

    ${!group && !direct.length ? `
      <div class="conversation-empty">No conversations yet.</div>
    ` : ""}
  `;
}

function renderNewMessageList() {
  return `
    <div class="new-message-panel">
      <div class="new-message-header">
        <strong>Start a message</strong>
        <button id="close-new-message" type="button">×</button>
      </div>
      <input
        id="classmate-search"
        class="text-input"
        type="search"
        placeholder="Search classmates..."
      />
      <div id="classmate-list">
        ${renderClassmateList(state.classmates)}
      </div>
    </div>
  `;
}

function renderCareMembers() {
  const members = state.classmates.slice();
  const me = state.profile || { id: state.user?.id, display_name: getDisplayName(), full_name: getDisplayName() };
  if (state.user && !members.some((m) => m.id === state.user.id)) members.unshift(me);
  return members.map((member) => {
    const name = member.display_name || member.full_name || "Student";
    return `
      <div class="care-member-row">
        <div class="avatar small">${member.avatar_url ? `<img src="${escapeHtml(member.avatar_url)}" alt="" />` : escapeHtml(getInitials(name))}</div>
        <div class="care-member-info"><strong>${escapeHtml(name)}${member.id === state.user?.id ? " (You)" : ""}</strong><span>${member.id === state.user?.id ? "You" : renderPresenceBadge(member.id)}</span></div>
      </div>
    `;
  }).join("");
}

function renderClassmateList(classmates) {
  if (!classmates.length) {
    return '<div class="conversation-empty">No classmates found.</div>';
  }

  return classmates.map((classmate) => {
    const name =
      classmate.display_name ||
      classmate.full_name ||
      "Classmate";

    return `
      <button
        class="classmate-item"
        data-start-dm="${escapeHtml(classmate.id)}"
        type="button"
      >
        <span class="conversation-avatar">
          ${classmate.avatar_url
            ? `<img src="${escapeHtml(classmate.avatar_url)}" alt="" />`
            : escapeHtml(getInitials(name))}
        </span>
        <span>
          <strong>${escapeHtml(name)}</strong>
          <small>${renderPresenceBadge(classmate.id)} · Send a private message</small>
        </span>
      </button>
    `;
  }).join("");
}

function getFilteredCareMessages() {
  const query = String(state.careSearchQuery || "").trim().toLowerCase();
  if (!query) return state.careMessages;
  return state.careMessages.filter((message) => {
    const profile = message.profiles || {};
    const name = profile.display_name || profile.full_name || "";
    return [message.content, message.message, name].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

function renderPinnedMessageStrip() {
  const pinned = state.pinnedMessages.filter((item) => state.careMessages.some((message) => message.id === item.message_id)).slice(0, 5);
  if (!pinned.length) return "";
  return `
    <div class="care-pinned-strip">
      <div class="care-pinned-heading">📌 <strong>Pinned</strong></div>
      <div class="care-pinned-items">
        ${pinned.map((item) => {
          const message = state.careMessages.find((m) => m.id === item.message_id);
          const value = message?.content || message?.message || "Pinned message";
          return `<button type="button" class="care-pinned-item" data-jump-message="${escapeHtml(item.message_id)}">${escapeHtml(value.slice(0, 100))}${value.length > 100 ? "…" : ""}</button>`;
        }).join("")}
      </div>
    </div>
  `;
}

function renderCareMessages() {
  const filteredMessages = getFilteredCareMessages();

  if (!state.careMessages.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>No messages yet</h3>
        <p>Start the conversation.</p>
      </div>
    `;
  }

  if (!filteredMessages.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔎</div>
        <h3>No matching messages</h3>
        <p>Try another search.</p>
      </div>
    `;
  }

  return `
    <div class="care-message-list">
      ${filteredMessages.map((message) => renderCareMessage(message)).join("")}
    </div>
  `;
}
function renderCareMessage(message) {
  const profile =
    message.profiles || {};

  const name =
    profile.display_name ||
    profile.full_name ||
    "Student";

  const mine =
    (message.sender_id || message.user_id) ===
    state.user?.id;

  const created =
    new Date(
      message.created_at
    );

  const editable =
    mine &&
    !Number.isNaN(
      created.getTime()
    ) &&
    Date.now() -
      created.getTime() <=
      5 * 60 * 1000;

  return `
    <div
      class="care-message ${
        mine ? "mine" : ""
      }"
      data-message-id="${escapeHtml(message.id)}"
    >

      <div class="avatar">
        ${
          profile.avatar_url
            ? `<img
                src="${escapeHtml(
                  profile.avatar_url
                )}"
                alt=""
              />`
            : escapeHtml(
                getInitials(name)
              )
        }
      </div>

      <div class="care-message-body">

        <div class="care-message-meta">

          <strong>
            ${escapeHtml(name)}
          </strong>

          <span>
            ${formatDateTime(
              message.created_at
            )}
          </span>

        </div>

        ${message.reply_to_message_id ? (() => {
          const original = state.careMessages.find(item => item.id === message.reply_to_message_id);
          if (!original) return "";
          const originalProfile = original.profiles || {};
          const originalName = originalProfile.display_name || originalProfile.full_name || "Student";
          const originalText = original.content || original.message || "";
          return `
            <button type="button" class="message-reply-preview" data-jump-message="${escapeHtml(original.id)}">
              <strong>↩ Replying to ${escapeHtml(originalName)}</strong>
              <span>${escapeHtml(originalText.slice(0, 140))}${originalText.length > 140 ? "…" : ""}</span>
            </button>
          `;
        })() : ""}

        <div class="care-message-content">
          ${escapeHtml(
            message.content ||
            message.message ||
            ""
          )}
          ${message.edited_at ? '<span class="message-edited">(edited)</span>' : ""}
        </div>

        <div class="care-message-actions">
          <div class="reaction-picker">${renderMessageReactions(message.id)}</div>
          <button type="button" data-reply-message="${escapeHtml(message.id)}">↩ Reply</button>
          <button type="button" data-report-message="${escapeHtml(message.id)}">⚑ Report</button>

          <button
            data-pin-message="${escapeHtml(message.id)}"
            class="${isMessagePinned(message.id) ? "active" : ""}"
          >
            ${isMessagePinned(message.id) ? "📌 Pinned" : "📌 Pin"}
          </button>

          ${
            mine
              ? `
                ${
                  editable
                    ? `
                      <button data-edit-message="${escapeHtml(message.id)}">Edit</button>
                    `
                    : ""
                }
                <button data-delete-message="${escapeHtml(message.id)}">Delete</button>
              `
              : ""
          }
        </div>

      </div>

    </div>
  `;
}

async function refreshCurrentConversation() {
  const conversation = state.conversations.find(
    (item) => item.id === state.currentConversationId
  );

  if (
    state.currentConversationType === "direct" ||
    conversation?.type === "direct"
  ) {
    state.currentConversationType = "direct";
    await hydrateDirectMessage();
  } else {
    state.currentConversationType = "group";
    await hydrateCareTeam();
  }
}

async function openConversation(conversationId) {
  const conversation = state.conversations.find(
    (item) => String(item.id) === String(conversationId)
  );

  if (!conversation) {
    console.warn("Conversation could not be opened:", conversationId);
    showMessage("That conversation could not be found. Refresh Messages and try again.", "error");
    return;
  }

  state.currentConversationId = conversation.id;
  state.currentConversationType = conversation.type === "direct" ? "direct" : "group";
  state.showNewMessage = false;

  if (state.currentConversationType === "direct") {
    // A direct conversation must live on the Messages page. If it was
    // opened from the Care Team sidebar, update the page state as well so
    // realtime refreshes do not mistake the private thread for group chat.
    const pageChanged = state.currentPage !== "messages";
    state.currentPage = "messages";
    if (pageChanged) renderAppShell();
    await hydrateDirectMessage();
  } else {
    state.currentPage = "care-team";
    await hydrateCareTeam();
  }
}

function renderDirectMessageConversation() {
  const conversation = state.conversations.find(
    (item) => item.id === state.currentConversationId
  );

  const name =
    conversation?.otherMember?.display_name ||
    conversation?.otherMember?.full_name ||
    "Classmate";

  return `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow">MESSAGES</p>
          <h1>${escapeHtml(name)}</h1>
          <p>Private conversation.</p>
        </div>
        <button class="secondary-button small-button" id="back-to-messages" type="button">← Messages</button>
      </div>

      <div class="panel care-team-panel">
        <div class="conversation-header">
          <div class="conversation-header-avatar">
            ${conversation?.otherMember?.avatar_url
              ? `<img src="${escapeHtml(conversation.otherMember.avatar_url)}" alt="" />`
              : escapeHtml(getInitials(name))}
          </div>
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>Private message</span>
          </div>
        </div>

        <div class="care-team-messages" id="care-team-messages">
          ${renderCareMessages()}
        </div>

        <form id="care-message-form" class="care-message-form">
          <input
            id="care-message-input"
            class="text-input"
            type="text"
            maxlength="2000"
            placeholder="Write a private message..."
            autocomplete="off"
            required
          />
          <button class="primary-button" type="submit">Send</button>
        </form>
      </div>
    </section>
  `;
}

async function hydrateDirectMessage() {
  await loadCareMessages();
  await loadPinnedMessages();
  await loadMessageReactions();

  const container = $("#page-container");
  if (!container) return;

  state.careSearchQuery = "";
  container.innerHTML = renderDirectMessageConversation();

  $("#back-to-messages")?.addEventListener("click", () => navigate("messages"));
  $("#care-message-form")?.addEventListener("submit", handleCareMessageSubmit);
  renderReplyComposer();

  document.querySelectorAll("[data-edit-message]").forEach((button) => {
    button.addEventListener("click", () => editCareMessage(button.dataset.editMessage));
  });
  document.querySelectorAll("[data-delete-message]").forEach((button) => {
    button.addEventListener("click", () => deleteCareMessage(button.dataset.deleteMessage));
  });
  document.querySelectorAll("[data-react-message]").forEach((button) => {
    button.addEventListener("click", () => toggleMessageReaction(button.dataset.reactMessage, button.dataset.reaction || "❤️"));
  });
  document.querySelectorAll("[data-pin-message]").forEach((button) => {
    button.addEventListener("click", () => togglePinnedMessage(button.dataset.pinMessage));
  });
  document.querySelectorAll("[data-reply-message]").forEach((button) => {
    button.addEventListener("click", () => startReply(button.dataset.replyMessage));
  });
  document.querySelectorAll("[data-jump-message]").forEach((button) => {
    button.addEventListener("click", () => jumpToMessage(button.dataset.jumpMessage));
  });
}

async function startDirectMessage(targetUserId) {
  if (!supabaseClient || !state.user || !targetUserId) return;

  state.currentConversationType = "direct";

  const existing = state.conversations.find((conversation) =>
    conversation.type === "direct" &&
    conversation.members?.some((member) => member.user_id === state.user.id) &&
    conversation.members?.some((member) => member.user_id === targetUserId)
  );

  if (existing) {
    state.currentConversationId = existing.id;
    state.currentConversationType = "direct";
    state.showNewMessage = false;
    state.currentPage = "messages";
    renderAppShell();
    await hydrateDirectMessage();
    return;
  }

  const { data: conversation, error } = await supabaseClient
    .from("conversations")
    .insert({
      type: "direct",
      created_by: state.user.id
    })
    .select("*")
    .single();

  if (error) {
    showMessage(error.message || "Unable to start a conversation.", "error");
    return;
  }

  const { error: memberError } = await supabaseClient
    .from("conversation_members")
    .insert([
      { conversation_id: conversation.id, user_id: state.user.id },
      { conversation_id: conversation.id, user_id: targetUserId }
    ]);

  if (memberError) {
    await supabaseClient
      .from("conversations")
      .delete()
      .eq("id", conversation.id);

    showMessage(memberError.message || "Unable to add the classmate.", "error");
    return;
  }

  state.currentConversationId = conversation.id;
  state.currentConversationType = "direct";
  state.showNewMessage = false;
  state.currentPage = "messages";

  renderAppShell();
  await loadCareConversations();
  await hydrateDirectMessage();
}

async function hydrateCareTeam() {
  state.currentConversationType = "group";
  await loadCareConversations();
  await loadClassmates();

  // The Care Team page must always point at the class-wide group,
  // even if the user was previously inside a one-on-one conversation.
  const group = state.conversations.find(
    (conversation) =>
      conversation.type === "group" &&
      conversation.name === "The Care Team"
  );

  state.currentConversationId = group?.id || null;

  await Promise.all([
    loadCareMessages(),
    loadPinnedMessages(),
    loadMessageReactions(),
    loadCareReadState()
  ]);
  calculateCareUnread();
  await markConversationRead();

  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderCareTeam();

  $("#care-message-form")?.addEventListener(
    "submit",
    handleCareMessageSubmit
  );
  renderReplyComposer();

  $("#new-message-button")?.addEventListener("click", async () => {
    state.showNewMessage = true;
    const current = state.conversations.find(
      (conversation) => conversation.id === state.currentConversationId
    );
    await hydrateCareTeam();
    if (current) state.currentConversationId = current.id;
  });

  $("#close-new-message")?.addEventListener("click", async () => {
    state.showNewMessage = false;
    await hydrateCareTeam();
  });

  document.querySelectorAll("[data-conversation-id]").forEach((button) => {
    button.addEventListener("click", () =>
      openConversation(button.dataset.conversationId)
    );
  });

  document.querySelectorAll("[data-start-dm]").forEach((button) => {
    button.addEventListener("click", () =>
      startDirectMessage(button.dataset.startDm)
    );
  });

  $("#classmate-search")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    const filtered = state.classmates.filter((classmate) => {
      const name =
        classmate.display_name ||
        classmate.full_name ||
        "";
      return name.toLowerCase().includes(query);
    });
    const list = $("#classmate-list");
    if (list) list.innerHTML = renderClassmateList(filtered);
    document.querySelectorAll("[data-start-dm]").forEach((button) => {
      button.addEventListener("click", () =>
        startDirectMessage(button.dataset.startDm)
      );
    });
  });

  document.querySelectorAll("[data-edit-message]").forEach((button) => {
    button.addEventListener("click", () =>
      editCareMessage(button.dataset.editMessage)
    );
  });

  document.querySelectorAll("[data-delete-message]").forEach((button) => {
    button.addEventListener("click", () =>
      deleteCareMessage(button.dataset.deleteMessage)
    );
  });

  document.querySelectorAll("[data-react-message]").forEach((button) => {
    button.addEventListener("click", () =>
      toggleMessageReaction(button.dataset.reactMessage, button.dataset.reaction || "❤️")
    );
  });

  document.querySelectorAll("[data-pin-message]").forEach((button) => {
    button.addEventListener("click", () =>
      togglePinnedMessage(button.dataset.pinMessage)
    );
  });

  document.querySelectorAll("[data-report-message]").forEach((button) => {
    button.addEventListener("click", () => reportCareMessage(button.dataset.reportMessage));
  });

  document.querySelectorAll("[data-reply-message]").forEach((button) => {
    button.addEventListener("click", () => startReply(button.dataset.replyMessage));
  });

  document.querySelectorAll("[data-jump-message]").forEach((button) => {
    button.addEventListener("click", () => jumpToMessage(button.dataset.jumpMessage));
  });

  $("#care-message-search")?.addEventListener("input", (event) => {
    state.careSearchQuery = event.target.value;
    const list = $("#care-team-messages");
    if (list) list.innerHTML = renderCareMessages();
    document.querySelectorAll("[data-jump-message]").forEach((button) => {
      button.addEventListener("click", () => jumpToMessage(button.dataset.jumpMessage));
    });
  });

  $("#care-search-clear")?.addEventListener("click", () => {
    state.careSearchQuery = "";
    hydrateCareTeam();
  });

  $("#care-members-button")?.addEventListener("click", () => {
    const drawer = document.createElement("div");
    drawer.className = "care-members-drawer";
    drawer.innerHTML = `
      <div class="care-members-card">
        <div class="care-members-header"><strong>Care Team Members</strong><button type="button" id="close-care-members">×</button></div>
        <div class="care-members-list">${renderCareMembers()}</div>
      </div>`;
    document.body.appendChild(drawer);
    $("#close-care-members")?.addEventListener("click", () => drawer.remove());
  });
}

async function handleCareMessageSubmit(
  event
) {
  event.preventDefault();

  const input =
    $("#care-message-input");

  const content =
    input?.value.trim();

  if (!content) return;

  const sent = await sendCareMessage(content);

  if (sent && input) {
    input.value = "";
  }
}

async function sendCareMessage(content) {
  if (!supabaseClient || !state.user || !state.currentConversationId)
    return false;

  const conversation = state.conversations.find(
    (item) => item.id === state.currentConversationId
  );
  const isDirect =
    state.currentConversationType === "direct" ||
    conversation?.type === "direct";

  const payload = {
    user_id: state.user.id,
    sender_id: state.user.id,
    conversation_id: state.currentConversationId,
    content,
    reply_to_message_id: state.replyToMessage?.id || null
  };

  let result = await supabaseClient
    .from("messages")
    .insert(payload);

  if (
    result.error &&
    result.error.message
      ?.toLowerCase()
      .includes("content")
  ) {
    result = await supabaseClient
      .from("messages")
      .insert({
        user_id: state.user.id,
        conversation_id: state.currentConversationId,
        message: content,
        sender_id: state.user.id,
        reply_to_message_id: state.replyToMessage?.id || null
      });
  }

  if (result.error) {
    console.error("Message send error:", result.error);
    showMessage(
      result.error.message || "Unable to send message.",
      "error"
    );
    return false;
  }

  state.replyToMessage = null;

  // Keep group chat and one-on-one messages in their own conversation.
  if (isDirect) {
    await hydrateDirectMessage();
  } else {
    await hydrateCareTeam();
  }

  requestAnimationFrame(() => {
    const chat = $("#care-team-messages");
    if (chat) {
      chat.scrollTop = chat.scrollHeight;
    }
  });

  return true;
}

async function editCareMessage(
  messageId
) {
  const message =
    state.careMessages.find(
      (item) =>
        item.id === messageId
    );

  if (!message) return;

  const created =
    new Date(
      message.created_at
    );

  if (
    Date.now() -
      created.getTime() >
    5 * 60 * 1000
  ) {
    showMessage(
      "Messages can only be edited within 5 minutes.",
      "error"
    );

    return;
  }

  const current =
    message.content ||
    message.message ||
    "";

  const updated =
    prompt(
      "Edit your message:",
      current
    );

  if (
    updated === null ||
    !updated.trim()
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("messages")
    .update({
      content: updated.trim(),
      edited_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    showMessage(
      error.message ||
      "Unable to edit message.",
      "error"
    );

    return;
  }

  await refreshCurrentConversation();
}

async function toggleMessageReaction(messageId, reaction = "❤️") {
  if (!supabaseClient || !state.user) return;

  const existing = state.messageReactions.find(
    item =>
      item.message_id === messageId &&
      item.user_id === state.user.id &&
      item.reaction === reaction
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("message_reactions")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", state.user.id);

    if (error) {
      showMessage(error.message || "Unable to remove reaction.", "error");
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from("message_reactions")
      .insert({
        message_id: messageId,
        user_id: state.user.id,
        reaction
      });

    if (error) {
      showMessage(error.message || "Unable to add reaction.", "error");
      return;
    }
  }

  await refreshCurrentConversation();
}

async function togglePinnedMessage(messageId) {
  if (!supabaseClient || !state.user) return;

  const existing = state.pinnedMessages.find(
    item => item.message_id === messageId
  );

  if (existing) {
    const { error } = await supabaseClient
      .from("pinned_messages")
      .delete()
      .eq("id", existing.id);

    if (error) {
      showMessage(error.message || "Unable to unpin message.", "error");
      return;
    }

    showMessage("Message unpinned.");
  } else {
    const { error } = await supabaseClient
      .from("pinned_messages")
      .insert({
        message_id: messageId,
        pinned_by: state.user.id
      });

    if (error) {
      showMessage(error.message || "Unable to pin message.", "error");
      return;
    }

    showMessage("Message pinned.");
  }

  await refreshCurrentConversation();
}

function startReply(messageId) {
  const message = state.careMessages.find(item => item.id === messageId);
  if (!message) return;
  state.replyToMessage = message;
  renderReplyComposer();
  const input = $("#care-message-input");
  if (input) input.focus();
}

function cancelReply() {
  state.replyToMessage = null;
  renderReplyComposer();
}

function renderReplyComposer() {
  document.querySelector(".care-reply-composer")?.remove();
  if (!state.replyToMessage) return;
  const message = state.replyToMessage;
  const profile = message.profiles || {};
  const name = profile.display_name || profile.full_name || "Student";
  const textValue = message.content || message.message || "";
  const form = $("#care-message-form");
  if (!form) return;
  const banner = document.createElement("div");
  banner.className = "care-reply-composer";
  banner.innerHTML = `<div><strong>↩ Replying to ${escapeHtml(name)}</strong><span>${escapeHtml(textValue.slice(0, 160))}${textValue.length > 160 ? "…" : ""}</span></div><button type="button" id="cancel-care-reply">×</button>`;
  form.prepend(banner);
  $("#cancel-care-reply")?.addEventListener("click", cancelReply);
}

function jumpToMessage(messageId) {
  const target = document.querySelector(`[data-message-id="${CSS.escape(String(messageId))}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("message-highlight");
  setTimeout(() => target.classList.remove("message-highlight"), 1400);
}

async function reportCareMessage(messageId) {
  if (!supabaseClient || !state.user) return;
  const message = state.careMessages.find((item) => item.id === messageId);
  if (!message) return;
  const reason = prompt("Why are you reporting this message?", "Inappropriate or concerning content");
  if (!reason || !reason.trim()) return;
  const { error } = await supabaseClient.from("message_reports").insert({
    message_id: messageId,
    reporter_id: state.user.id,
    reason: reason.trim()
  });
  if (error) {
    showMessage(error.message || "Unable to submit report.", "error");
    return;
  }
  showMessage("Report submitted to the admin team.");
}

async function deleteCareMessage(
  messageId
) {
  if (
    !confirm(
      "Delete this message?"
    )
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    showMessage(
      error.message ||
      "Unable to delete message.",
      "error"
    );

    return;
  }

  await refreshCurrentConversation();
}

/* =========================================================
   FLASHCARDS
   ========================================================= */

async function loadFlashcardDecks() {
  if (!supabaseClient || !state.user)
    return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("flashcard_decks")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    console.error(
      "Flashcard deck error:",
      error
    );

    state.flashcardDecks = [];

    return [];
  }

  state.flashcardDecks =
    data || [];

  return state.flashcardDecks;
}

async function loadFlashcards(
  deckId
) {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("flashcards")
    .select("*")
    .eq("deck_id", deckId)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(
      "Flashcard load error:",
      error
    );

    state.flashcards = [];

    return [];
  }

  state.flashcards =
    data || [];

  return state.flashcards;
}

function renderFlashcards() {
  return `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            STUDY TOOLS
          </p>

          <h1>
            Flashcards
          </h1>

          <p>
            Build decks and review what you need to remember.
          </p>

        </div>

        <button
          class="primary-button"
          id="create-deck-button"
        >
          + New Deck
        </button>

      </div>

      <div
        class="study-tool-grid"
        id="flashcard-decks"
      >
        ${renderFlashcardDecks()}
      </div>

    </section>
  `;
}

function renderFlashcardDecks() {
  if (!state.flashcardDecks.length) {
    return `
      <div class="panel">
        <div class="empty-state">

          <div class="empty-icon">
            🧠
          </div>

          <h3>
            No flashcard decks yet
          </h3>

          <p>
            Create your first deck.
          </p>

        </div>
      </div>
    `;
  }

  return state.flashcardDecks
    .map(
      (deck) => `
        <div class="panel study-tool-card">

          <div class="panel-header">

            <div>
              <span class="panel-icon">
                🧠
              </span>

              <h2>
                ${escapeHtml(
                  deck.title
                )}
              </h2>
            </div>

          </div>

          <p>
            ${escapeHtml(
              deck.description ||
              "Flashcard deck"
            )}
          </p>

          <button
            class="primary-button"
            data-open-deck="${escapeHtml(
              deck.id
            )}"
          >
            Review Deck
          </button>

        </div>
      `
    )
    .join("");
}

async function hydrateFlashcards() {
  await loadFlashcardDecks();

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderFlashcards();

  $("#create-deck-button")
    ?.addEventListener(
      "click",
      createFlashcardDeck
    );

  document
    .querySelectorAll(
      "[data-open-deck]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          openFlashcardDeck(
            button.dataset
              .openDeck
          )
      );
    });
}

async function createFlashcardDeck() {
  const title =
    prompt(
      "Deck title:"
    );

  if (!title?.trim()) return;

  const description =
    prompt(
      "Deck description (optional):"
    );

  const {
    error
  } = await supabaseClient
    .from("flashcard_decks")
    .insert({
      user_id: state.user.id,
      title: title.trim(),
      description:
        description?.trim() ||
        null
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to create deck.",
      "error"
    );

    return;
  }

  showMessage("Flashcard deck created.");

  await hydrateFlashcards();
}

async function openFlashcardDeck(
  deckId
) {
  const deck =
    state.flashcardDecks.find(
      (item) =>
        item.id === deckId
    );

  if (!deck) return;

  state.currentDeck =
    deck;

  await loadFlashcards(
    deckId
  );

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML = `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            FLASHCARDS
          </p>

          <h1>
            ${escapeHtml(
              deck.title
            )}
          </h1>

        </div>

        <button
          class="secondary-button"
          id="back-decks"
        >
          ← Decks
        </button>

      </div>

      <div class="panel">

        <div class="panel-header">

          <h2>
            ${state.flashcards.length}
            cards
          </h2>

          <button
            class="primary-button"
            id="add-card-button"
          >
            + Add Card
          </button>

        </div>

        <div class="flashcard-list">

          ${
            state.flashcards.length
              ? state.flashcards
                  .map(
                    (card) => `
                      <div class="flashcard-item">

                        <strong>
                          ${escapeHtml(
                            card.question
                          )}
                        </strong>

                        <p>
                          ${escapeHtml(
                            card.answer
                          )}
                        </p>

                      </div>
                    `
                  )
                  .join("")
              : `
                <div class="empty-state">
                  <div class="empty-icon">
                    🧠
                  </div>

                  <p>
                    This deck has no cards yet.
                  </p>
                </div>
              `
          }

        </div>

      </div>

    </section>
  `;

  $("#back-decks")
    ?.addEventListener(
      "click",
      () => navigate("flashcards")
    );

  $("#add-card-button")
    ?.addEventListener(
      "click",
      () =>
        addFlashcard(deckId)
    );
}

async function addFlashcard(
  deckId
) {
  const question =
    prompt(
      "Question:"
    );

  if (!question?.trim()) return;

  const answer =
    prompt(
      "Answer:"
    );

  if (!answer?.trim()) return;

  const {
    error
  } = await supabaseClient
    .from("flashcards")
    .insert({
      deck_id: deckId,
      question:
        question.trim(),
      answer:
        answer.trim()
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to add card.",
      "error"
    );

    return;
  }

  await openFlashcardDeck(
    deckId
  );
}

/* =========================================================
   QUIZ MAKER
   ========================================================= */

async function loadQuizSets() {
  if (!supabaseClient || !state.user)
    return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("quiz_sets")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    state.quizSets = [];
    return [];
  }

  state.quizSets =
    data || [];

  return state.quizSets;
}

async function loadQuizQuestions(
  quizId
) {
  const {
    data,
    error
  } = await supabaseClient
    .from("quiz_questions")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    state.quizQuestions = [];
    return [];
  }

  state.quizQuestions =
    data || [];

  return state.quizQuestions;
}

function renderQuizMaker() {
  return `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            STUDY TOOLS
          </p>

          <h1>
            Quiz Maker
          </h1>

          <p>
            Build practice quizzes for yourself.
          </p>

        </div>

        <button
          class="primary-button"
          id="create-quiz-button"
        >
          + New Quiz
        </button>

      </div>

      <div class="study-tool-grid">

        ${
          state.quizSets.length
            ? state.quizSets
                .map(
                  (quiz) => `
                    <div class="panel study-tool-card">

                      <div class="panel-header">

                        <div>
                          <span class="panel-icon">
                            📝
                          </span>

                          <h2>
                            ${escapeHtml(
                              quiz.title
                            )}
                          </h2>
                        </div>

                      </div>

                      <p>
                        ${escapeHtml(
                          quiz.description ||
                          "Practice quiz"
                        )}
                      </p>

                      <button
                        class="primary-button"
                        data-open-quiz="${escapeHtml(
                          quiz.id
                        )}"
                      >
                        Open Quiz
                      </button>

                    </div>
                  `
                )
                .join("")
            : `
              <div class="panel">

                <div class="empty-state">

                  <div class="empty-icon">
                    📝
                  </div>

                  <h3>
                    No quizzes yet
                  </h3>

                  <p>
                    Create your first practice quiz.
                  </p>

                </div>

              </div>
            `
        }

      </div>

    </section>
  `;
}

async function hydrateQuizMaker() {
  await loadQuizSets();

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderQuizMaker();

  $("#create-quiz-button")
    ?.addEventListener(
      "click",
      createQuiz
    );

  document
    .querySelectorAll(
      "[data-open-quiz]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          openQuiz(
            button.dataset
              .openQuiz
          )
      );
    });
}

async function createQuiz() {
  const title =
    prompt(
      "Quiz title:"
    );

  if (!title?.trim()) return;

  const description =
    prompt(
      "Quiz description:"
    );

  const {
    error
  } = await supabaseClient
    .from("quiz_sets")
    .insert({
      user_id: state.user.id,
      title: title.trim(),
      description:
        description?.trim() ||
        null
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to create quiz.",
      "error"
    );

    return;
  }

  await hydrateQuizMaker();

  showMessage("Quiz created.");
}

async function openQuiz(quizId) {
  const quiz =
    state.quizSets.find(
      (item) =>
        item.id === quizId
    );

  if (!quiz) return;

  state.currentQuiz =
    quiz;

  await loadQuizQuestions(
    quizId
  );

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML = `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            QUIZ MAKER
          </p>

          <h1>
            ${escapeHtml(
              quiz.title
            )}
          </h1>

        </div>

        <button
          class="secondary-button"
          id="back-quizzes"
        >
          ← Quizzes
        </button>

      </div>

      <div class="panel">

        <div class="panel-header">

          <h2>
            Questions
          </h2>

          <button
            class="primary-button"
            id="add-question-button"
          >
            + Add Question
          </button>

        </div>

        ${
          state.quizQuestions.length
            ? `
              <div class="quiz-question-list">

                ${state.quizQuestions
                  .map(
                    (question, index) => `
                      <div class="quiz-question">

                        <strong>
                          ${index + 1}.
                          ${escapeHtml(
                            question.question
                          )}
                        </strong>

                        <p>
                          Type:
                          ${escapeHtml(
                            question.question_type ||
                            "multiple_choice"
                          )}
                        </p>

                      </div>
                    `
                  )
                  .join("")}

              </div>
            `
            : `
              <div class="empty-state">
                <div class="empty-icon">
                  📝
                </div>

                <p>
                  No questions yet.
                </p>
              </div>
            `
        }

      </div>

    </section>
  `;

  $("#back-quizzes")
    ?.addEventListener(
      "click",
      () => navigate("quiz-maker")
    );

  $("#add-question-button")
    ?.addEventListener(
      "click",
      () =>
        addQuizQuestion(
          quizId
        )
    );
}

async function addQuizQuestion(
  quizId
) {
  const question =
    prompt(
      "Question:"
    );

  if (!question?.trim()) return;

  const answer =
    prompt(
      "Correct answer:"
    );

  if (!answer?.trim()) return;

  const {
    error
  } = await supabaseClient
    .from("quiz_questions")
    .insert({
      quiz_id: quizId,
      question:
        question.trim(),
      question_type:
        "multiple_choice",
      options: [],
      correct_answer: [
        answer.trim()
      ]
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to add question.",
      "error"
    );

    return;
  }

  await openQuiz(
    quizId
  );
}

/* =========================================================
   STUDY TIMER
   ========================================================= */

function renderStudyTimer() {
  const minutes =
    Math.floor(
      state.timer.remaining / 60
    )
      .toString()
      .padStart(2, "0");

  const seconds =
    (
      state.timer.remaining % 60
    )
      .toString()
      .padStart(2, "0");

  return `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            STUDY TOOLS
          </p>

          <h1>
            Study Timer
          </h1>

          <p>
            Focus, take breaks, and record your study sessions.
          </p>

        </div>

      </div>

      <div class="panel timer-panel">

        <div class="timer-mode">
          ${
            state.timer.mode === "focus"
              ? "📚 Focus Session"
              : "☕ Break"
          }
        </div>

        <div class="timer-display">
          ${minutes}:${seconds}
        </div>

        <div class="timer-controls">

          <button
            class="primary-button"
            id="timer-start"
          >
            ${
              state.timer.running
                ? "Pause"
                : "Start"
            }
          </button>

          <button
            class="secondary-button"
            id="timer-reset"
          >
            Reset
          </button>

          <button
            class="secondary-button"
            id="timer-break"
          >
            ${
              state.timer.mode === "focus"
                ? "Start Break"
                : "Back to Focus"
            }
          </button>

        </div>

        <div class="timer-presets">

          <button
            class="small-button"
            data-timer="25"
          >
            25 min
          </button>

          <button
            class="small-button"
            data-timer="50"
          >
            50 min
          </button>

          <button
            class="small-button"
            data-timer="10"
          >
            10 min
          </button>

        </div>

      </div>

    </section>
  `;
}

async function hydrateStudyTimer() {
  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderStudyTimer();

  attachTimerEvents();
}

function attachTimerEvents() {
  $("#timer-start")
    ?.addEventListener(
      "click",
      toggleTimer
    );

  $("#timer-reset")
    ?.addEventListener(
      "click",
      resetTimer
    );

  $("#timer-break")
    ?.addEventListener(
      "click",
      toggleBreak
    );

  document
    .querySelectorAll(
      "[data-timer]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          setTimer(
            Number(
              button.dataset.timer
            )
          );
        }
      );
    });
}

function renderTimerOnly() {
  const display =
    document.querySelector(
      ".timer-display"
    );

  const button =
    $("#timer-start");

  if (!display) return;

  const minutes =
    Math.floor(
      state.timer.remaining / 60
    )
      .toString()
      .padStart(2, "0");

  const seconds =
    (
      state.timer.remaining % 60
    )
      .toString()
      .padStart(2, "0");

  display.textContent =
    `${minutes}:${seconds}`;

  if (button) {
    button.textContent =
      state.timer.running
        ? "Pause"
        : "Start";
  }
}

function setTimer(minutes) {
  stopTimer();

  state.timer.seconds =
    minutes * 60;

  state.timer.remaining =
    minutes * 60;

  renderTimerOnly();
}

function toggleTimer() {
  if (state.timer.running) {
    stopTimer();
  } else {
    startTimer();
  }

  renderTimerOnly();
}

function startTimer() {
  if (state.timer.running)
    return;

  state.timer.running =
    true;

  state.timer.interval =
    setInterval(
      async () => {
        state.timer.remaining--;

        if (
          state.timer.remaining <=
          0
        ) {
          state.timer.remaining =
            0;

          stopTimer();

          await saveStudySession();

          alert(
            state.timer.mode ===
              "focus"
              ? "Focus session complete!"
              : "Break complete!"
          );

          renderTimerOnly();
          return;
        }

        renderTimerOnly();
      },
      1000
    );
}

function stopTimer() {
  if (state.timer.interval) {
    clearInterval(
      state.timer.interval
    );
  }

  state.timer.interval =
    null;

  state.timer.running =
    false;
}

function resetTimer() {
  stopTimer();

  state.timer.remaining =
    state.timer.seconds;

  renderTimerOnly();
}

function toggleBreak() {
  stopTimer();

  if (
    state.timer.mode ===
    "focus"
  ) {
    state.timer.mode =
      "break";

    state.timer.seconds =
      5 * 60;

    state.timer.remaining =
      5 * 60;
  } else {
    state.timer.mode =
      "focus";

    state.timer.seconds =
      25 * 60;

    state.timer.remaining =
      25 * 60;
  }

  renderTimerOnly();

  const mode =
    document.querySelector(
      ".timer-mode"
    );

  if (mode) {
    mode.textContent =
      state.timer.mode ===
      "focus"
        ? "📚 Focus Session"
        : "☕ Break";
  }
}

async function saveStudySession() {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const duration =
    Math.max(
      1,
      Math.round(
        state.timer.seconds /
          60
      )
    );

  const {
    error
  } = await supabaseClient
    .from("study_sessions")
    .insert({
      user_id: state.user.id,
      duration_minutes:
        duration,
      session_type:
        state.timer.mode
    });

  if (error) {
    console.error(
      "Study session save error:",
      error
    );
  }
}

/* =========================================================
   STUDY CHECKLIST
   ========================================================= */

async function loadStudyChecklist() {
  if (!supabaseClient || !state.user)
    return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("study_checklist_items")
    .select("*")
    .eq("user_id", state.user.id)
    .order("completed", {
      ascending: true
    })
    .order("created_at", {
      ascending: false
    });

  if (error) {
    state.studyChecklist = [];
    return [];
  }

  state.studyChecklist =
    data || [];

  return state.studyChecklist;
}

function renderStudyChecklist() {
  return `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            STUDY TOOLS
          </p>

          <h1>
            Study Checklist
          </h1>

          <p>
            Keep track of what you need to study.
          </p>

        </div>

        <button
          class="primary-button"
          id="add-checklist-button"
        >
          + Add Task
        </button>

      </div>

      <div class="panel">

        <div id="checklist-content">
          ${renderChecklistItems()}
        </div>

      </div>

    </section>
  `;
}

function renderChecklistItems() {
  if (!state.studyChecklist.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">
          ✅
        </div>

        <h3>
          Your checklist is empty
        </h3>

        <p>
          Add a study task.
        </p>
      </div>
    `;
  }

  return `
    <div class="checklist-list">

      ${state.studyChecklist
        .map(
          (item) => `
            <div class="checklist-item">

              <label>

                <input
                  type="checkbox"
                  data-checklist-toggle="${escapeHtml(
                    item.id
                  )}"
                  ${
                    item.completed
                      ? "checked"
                      : ""
                  }
                />

                <span
                  class="${
                    item.completed
                      ? "completed"
                      : ""
                  }"
                >
                  ${escapeHtml(
                    item.title
                  )}
                </span>

              </label>

              <button
                class="danger-action"
                data-checklist-delete="${escapeHtml(
                  item.id
                )}"
              >
                Delete
              </button>

            </div>
          `
        )
        .join("")}

    </div>
  `;
}

async function hydrateStudyChecklist() {
  await loadStudyChecklist();

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderStudyChecklist();

  $("#add-checklist-button")
    ?.addEventListener(
      "click",
      addChecklistItem
    );

  attachChecklistEvents();
}

function attachChecklistEvents() {
  document
    .querySelectorAll(
      "[data-checklist-toggle]"
    )
    .forEach((input) => {
      input.addEventListener(
        "change",
        () =>
          toggleChecklistItem(
            input.dataset
              .checklistToggle,
            input.checked
          )
      );
    });

  document
    .querySelectorAll(
      "[data-checklist-delete]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          deleteChecklistItem(
            button.dataset
              .checklistDelete
          )
      );
    });
}

async function addChecklistItem() {
  const title =
    prompt(
      "What do you need to study?"
    );

  if (!title?.trim()) return;

  const {
    error
  } = await supabaseClient
    .from("study_checklist_items")
    .insert({
      user_id:
        state.user.id,
      title:
        title.trim()
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to add task.",
      "error"
    );

    return;
  }

  await hydrateStudyChecklist();
}

async function toggleChecklistItem(
  id,
  completed
) {
  const {
    error
  } = await supabaseClient
    .from(
      "study_checklist_items"
    )
    .update({
      completed,
      completed_at:
        completed
          ? new Date().toISOString()
          : null
    })
    .eq("id", id)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    showMessage(
      error.message ||
      "Unable to update task.",
      "error"
    );

    return;
  }

  await hydrateStudyChecklist();
}

async function deleteChecklistItem(
  id
) {
  if (
    !confirm(
      "Delete this study task?"
    )
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from(
      "study_checklist_items"
    )
    .delete()
    .eq("id", id)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    showMessage(
      error.message ||
      "Unable to delete task.",
      "error"
    );

    return;
  }

  await hydrateStudyChecklist();
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

          <h1>
            Chapter Tracker
          </h1>

          <p>
            Track your CNA chapter test scores. StudentHub keeps each program's curriculum separate so more programs can be added later.
          </p>

        </div>

      </div>

      <div class="tracker-layout">

        <section class="panel">

          <div class="panel-header">

            <div>
              <span class="panel-icon">
                ➕
              </span>

              <h2>
                Add Score
              </h2>
            </div>

          </div>

          <form
            id="score-form"
            class="score-form"
          >

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

              ${state.classes.length
                ? state.classes.map((classItem) => `
                    <option
                      value="${escapeHtml(classItem.id)}"
                      ${String(classItem.id) === String(state.currentClassId) ? "selected" : ""}
                    >
                      ${escapeHtml(getClassLabel(classItem))}
                    </option>
                  `).join("")
                : `<option value="cna" selected>CNA</option>`}

            </select>

            <label class="field-label">
              Chapter
            </label>

            <select
              id="score-chapter"
              class="text-input"
              required
            >
              ${renderChapterOptions()}
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

            <div
              id="score-form-message"
            ></div>

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
              <span class="panel-icon">
                📚
              </span>

              <h2>
                Your Scores
              </h2>
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

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderChapterTracker();

  attachChapterTrackerEvents();
}

function renderScoreList() {
  if (!state.scoreDetails.length) {
    return `
      <div class="empty-state">

        <div class="empty-icon">
          📚
        </div>

        <h3>
          No scores yet
        </h3>

        <p>
          Add your first chapter test score.
        </p>

      </div>
    `;
  }

  return `
    <div class="score-list">

      ${state.scoreDetails
        .map(
          (score) => {
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
          }
        )
        .join("")}

    </div>
  `;
}


function renderChapterOptions() {
  const currentClass = getCurrentClass();
  const chapters = getChaptersForClass(currentClass);

  if (!currentClass) {
    return '<option value="">No class assigned</option>';
  }

  if (!chapters.length) {
    return '<option value="">No chapters available for ' +
      escapeHtml(getClassLabel(currentClass)) +
      '</option>';
  }

  return '<option value="">Select a chapter</option>' +
    chapters.map((chapter) => (
      '<option value="' + escapeHtml(chapter.id) + '">' +
        'Chapter ' + escapeHtml(chapter.chapter_number) +
        ' — ' + escapeHtml(chapter.title) +
      '</option>'
    )).join("");
}

function refreshChapterSelect() {
  const chapterSelect = $("#score-chapter");
  if (!chapterSelect) return;
  chapterSelect.innerHTML = renderChapterOptions();
}

function attachChapterTrackerEvents() {
  const form = $("#score-form");
  if (!form) return;

  const classSelect = $("#score-class");

  classSelect?.addEventListener("change", () => {
    state.currentClassId = classSelect.value || null;
    storeCurrentClassId(state.currentClassId);
    refreshChapterSelect();
  });

  const dateInput = $("#score-date");

  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  refreshChapterSelect();
  form.addEventListener("submit", handleScoreSubmit);
}

async function handleScoreSubmit(
  event
) {
  event.preventDefault();

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const classId =
    $("#score-class")?.value;

  const chapterId =
    $("#score-chapter")?.value;

  const scoreValue =
    $("#score-value")?.value;

  const testDate =
    $("#score-date")?.value;

  const message =
    $("#score-form-message");

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

  const numericScore =
    Number(scoreValue);

  if (
    Number.isNaN(
      numericScore
    ) ||
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
    });

  if (error) {
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

  const scoreList =
    $("#score-list");

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
          <p class="eyebrow">ACADEMIC PERFORMANCE</p>
          <h1>Progress</h1>
          <p>Your scores, averages, GPA, consistency, and chapter progress.</p>
        </div>
        ${state.classes.length > 1 ? `
          <div class="progress-class-picker">
            <label class="field-label" for="progress-class">Class</label>
            <select id="progress-class" class="text-input">
              ${state.classes.map((classItem) => `
                <option value="${escapeHtml(classItem.id)}" ${String(classItem.id) === String(state.currentClassId) ? "selected" : ""}>
                  ${escapeHtml(getClassLabel(classItem))}
                </option>
              `).join("")}
            </select>
          </div>
        ` : ""}
      </div>
      <div id="progress-content">
        ${renderProgressContent()}
      </div>
    </section>
  `;
}

function getProgressScores() {
  const currentClass = getCurrentClass();
  if (!currentClass) return state.scoreDetails || [];

  const classId = String(currentClass.id);
  const matching = (state.scoreDetails || []).filter((score) =>
    score.class_id == null || String(score.class_id) === classId
  );

  return matching;
}

function getProgressMetrics() {
  const scores = getProgressScores()
    .filter((score) => Number.isFinite(Number(score.score)))
    .sort((a, b) => new Date(b.test_date || 0) - new Date(a.test_date || 0));

  const chapters = getChaptersForClass();
  const average = scores.length
    ? scores.reduce((sum, item) => sum + Number(item.score), 0) / scores.length
    : null;

  const lowest = scores.length ? Math.min(...scores.map((item) => Number(item.score))) : null;
  const highest = scores.length ? Math.max(...scores.map((item) => Number(item.score))) : null;

  const latestByChapter = new Map();
  scores.forEach((score) => {
    const key = String(score.chapter_id ?? score.chapter_number ?? score.id);
    if (!latestByChapter.has(key)) latestByChapter.set(key, score);
  });

  const completedChapters = chapters.filter((chapter) => {
    return scores.some((score) => String(score.chapter_id) === String(chapter.id));
  }).length;

  const pendingChapters = Math.max(chapters.length - completedChapters, 0);

  const summary = state.academicSummary || {};
  const mean = average;
  const deviations = scores.length > 1 && mean != null ? scores.map((item) => Math.pow(Number(item.score) - mean, 2)) : [];
  const standardDeviation = deviations.length ? Math.sqrt(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : 0;
  const calculatedConsistency = scores.length > 1 ? Math.max(0, Math.min(100, 100 - standardDeviation)) : null;
  const consistency = calculatedConsistency != null ? calculatedConsistency : (summary.score_consistency != null ? Number(summary.score_consistency) : null);

  return {
    scores,
    chapters,
    average,
    lowest,
    highest,
    latest: scores[0] || null,
    completedChapters,
    pendingChapters,
    consistency,
    totalTests: scores.length,
    standardDeviation,
    passing: average != null ? average >= 80 : null
  };
}

function renderProgressContent() {
  const metrics = getProgressMetrics();
  const summary = state.academicSummary || {};
  const hasScores = metrics.scores.length > 0;

  if (!hasScores && !metrics.chapters.length) {
    return `
      <div class="panel">
        <div class="empty-state">
          <div class="empty-icon">📈</div>
          <h2>No progress data yet</h2>
          <p>Add scores in Chapter Tracker to start building your progress.</p>
        </div>
      </div>
    `;
  }

  const average = metrics.average != null
    ? metrics.average.toFixed(2)
    : "—";

  const gpa = metrics.average != null
    ? calculateGPA(metrics.average).toFixed(2)
    : (
        summary.GPA != null
          ? Number(summary.GPA).toFixed(2)
          : summary.gpa != null
            ? Number(summary.gpa).toFixed(2)
            : "—"
      );

  const letter = metrics.average != null
    ? calculateLetterGrade(metrics.average)
    : (summary.overall_letter_grade || "—");

  const consistency = metrics.consistency != null ? metrics.consistency.toFixed(1) + "%" : "—";

  const chapterTotal = metrics.chapters.length;
  const completionPercent = chapterTotal
    ? Math.round((metrics.completedChapters / chapterTotal) * 100)
    : 0;

  return `
    <div class="progress-grid">
      <div class="panel progress-main-card">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📊</span>
            <h2>Personal Progress Snapshot</h2>
          </div>
        </div>

        <div class="progress-big-number">${average}%</div>
        <div class="progress-letter ${getLetterClass(letter)}">${escapeHtml(letter)}</div>
        <p>Current academic average · ${metrics.passing == null ? "No passing status yet" : metrics.passing ? "Meets the 80% class requirement" : "Below the 80% class requirement"}</p>

        <div class="progress-bar-wrap" aria-label="Chapter completion">
          <div class="progress-bar-label">
            <span>Chapter Completion</span>
            <strong>${metrics.completedChapters}/${chapterTotal || "—"}</strong>
          </div>
          <div class="progress-bar">
            <span style="width:${completionPercent}%"></span>
          </div>
          <small>${completionPercent}% complete</small>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">🎓</span>
            <h2>Academic Stats</h2>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card"><span>GPA</span><strong>${gpa}</strong></div>
          <div class="stat-card"><span>Tests Completed</span><strong>${metrics.totalTests}</strong></div>
          <div class="stat-card"><span>Pending Chapters</span><strong>${metrics.pendingChapters}</strong></div>
          <div class="stat-card"><span>Score Consistency</span><strong>${consistency}</strong><small>Higher = more consistent</small></div>
          <div class="stat-card"><span>Passing Status</span><strong class="${metrics.passing === true ? "status-pass" : metrics.passing === false ? "status-needs-review" : ""}">${metrics.passing == null ? "—" : metrics.passing ? "Passing" : "Below 80%"}</strong></div>
          <div class="stat-card"><span>Lowest Score</span><strong>${metrics.lowest != null ? metrics.lowest.toFixed(2) + "%" : "—"}</strong></div>
          <div class="stat-card"><span>Highest Score</span><strong>${metrics.highest != null ? metrics.highest.toFixed(2) + "%" : "—"}</strong></div>
        </div>
      </div>

      <div class="panel progress-trend-panel">
        <div class="panel-header"><div><span class="panel-icon">📈</span><h2>Score Trend</h2></div><span class="assignment-count">${metrics.totalTests} recorded</span></div>
        <div class="progress-trend">
          ${metrics.scores.length ? metrics.scores.slice().reverse().map((score,index,arr)=>{ const value=Number(score.score); const previous=index>0?Number(arr[index-1].score):null; const delta=previous!=null?value-previous:null; const deltaText=delta==null?"First recorded score":`${delta>0?"+":""}${delta.toFixed(1)} pts`; return `<div class="trend-item"><div class="trend-label"><span>Ch. ${escapeHtml(score.chapter_number ?? "—")}</span><strong>${value.toFixed(1)}%</strong></div><div class="trend-track"><span style="width:${Math.max(0,Math.min(100,value))}%"></span></div><small>${escapeHtml(deltaText)}</small></div>`; }).join("") : `<div class="empty-state compact"><p>No score trend available yet.</p></div>`}
        </div>
      </div>

      <div class="panel progress-chapters-panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📚</span>
            <h2>Chapter Progress</h2>
          </div>
          <span class="assignment-count">${metrics.completedChapters} completed · ${metrics.pendingChapters} pending</span>
        </div>

        ${metrics.chapters.length
          ? `
            <div class="chapter-progress-list">
              ${metrics.chapters.map((chapter) => {
                const matchingScore = metrics.scores.find(
                  (score) => String(score.chapter_id) === String(chapter.id)
                );
                const completed = Boolean(matchingScore);
                const scoreText = completed ? Number(matchingScore.score).toFixed(2) + "%" : "Pending";
                const chapterLetter = completed
                  ? (matchingScore.letter_grade || calculateLetterGrade(matchingScore.score))
                  : "";

                return `
                  <div class="chapter-progress-row ${completed ? "chapter-complete" : "chapter-pending-row"}">
                    <div class="chapter-progress-main">
                      <strong>Chapter ${escapeHtml(chapter.chapter_number)}</strong>
                      <span>${escapeHtml(chapter.title || "Chapter")}</span>
                    </div>
                    <div class="chapter-progress-result">
                      ${completed
                        ? `
                          <strong>${scoreText}</strong>
                          <span class="${getLetterClass(chapterLetter)}">${escapeHtml(chapterLetter)}</span>
                          <span class="chapter-complete-badge">✓ Complete</span>
                        `
                        : `<span class="chapter-pending">Pending</span>`}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          `
          : `
            <div class="empty-state">
              <p>Chapter list is not available yet.</p>
            </div>
          `
        }
      </div>

      <div class="panel progress-history-panel">
        <div class="panel-header">
          <div>
            <span class="panel-icon">📋</span>
            <h2>Score History</h2>
          </div>
          <span class="assignment-count">${metrics.scores.length} test${metrics.scores.length === 1 ? "" : "s"}</span>
        </div>

        ${metrics.scores.length
          ? `
            <div class="score-list">
              ${metrics.scores.map((score) => {
                const scoreLetter = score.letter_grade || calculateLetterGrade(score.score);
                return `
                  <div class="score-row">
                    <div class="score-row-main">
                      <strong>Chapter ${escapeHtml(score.chapter_number ?? "—")}</strong>
                      <span>${escapeHtml(score.chapter_title || "Chapter")}</span>
                    </div>
                    <div class="score-row-score">
                      <strong>${Number(score.score).toFixed(2)}%</strong>
                      <span class="${getLetterClass(scoreLetter)}">${escapeHtml(scoreLetter)}</span>
                    </div>
                    <div class="score-row-date">${formatDate(score.test_date)}</div>
                  </div>
                `;
              }).join("")}
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
    loadClasses(),
    loadAcademicSummary(),
    loadScoreDetails(),
    loadChapters()
  ]);

  const container = $("#progress-content");
  if (container) container.innerHTML = renderProgressContent();

  $("#progress-class")?.addEventListener("change", async (event) => {
    state.currentClassId = event.target.value || null;
    storeCurrentClassId(state.currentClassId);
    if (container) container.innerHTML = renderProgressContent();
  });
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function loadNotifications() {
  if (!supabaseClient || !state.user)
    return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {
    state.notifications = [];
    return [];
  }

  state.notifications =
    data || [];

  return state.notifications;
}

function renderNotifications() {
  if (!state.notifications.length) {
    return `
      <div class="notification-empty">

        <div>
          🔔
        </div>

        <p>
          No notifications
        </p>

      </div>
    `;
  }

  return `
    <div>

      ${state.notifications
        .map(
          (notification) => `
            <button
              class="notification-item ${
                notification.read
                  ? ""
                  : "unread"
              }"
              data-notification-id="${escapeHtml(
                notification.id
              )}"
            >

              <strong>
                ${escapeHtml(
                  notification.title ||
                  "Notification"
                )}
              </strong>

              <span>
                ${escapeHtml(
                  notification.message ||
                  notification.body ||
                  ""
                )}
              </span>

              <small>
                ${formatDateTime(
                  notification.created_at
                )}
              </small>

            </button>
          `
        )
        .join("")}

    </div>
  `;
}

function renderNotificationPage() {
  const unread = state.notifications.filter((item) => !item.read).length;
  return '<section class="page">' +
    '<div class="page-header notification-page-header">' +
      '<div><p class="eyebrow">STUDENTHUB</p><h1>Notifications</h1>' +
      '<p>Stay up to date with your StudentHub activity.</p></div>' +
      '<div class="notification-page-actions"><button class="secondary-button" id="mark-all-notifications-read" type="button"' +
        (unread ? '' : ' disabled') + '>✓ Mark All Read</button></div>' +
    '</div>' +
    '<div class="notification-summary-grid">' +
      '<div class="panel notification-summary-card"><span>All Notifications</span><strong>' + state.notifications.length + '</strong></div>' +
      '<div class="panel notification-summary-card"><span>Unread</span><strong>' + unread + '</strong></div>' +
      '<div class="panel notification-summary-card"><span>Latest</span><strong>' + (state.notifications.length ? escapeHtml(formatDate(state.notifications[0].created_at)) : '—') + '</strong></div>' +
    '</div>' +
    '<div class="panel notification-center-panel">' +
      '<div class="panel-header"><div><span class="panel-icon">🔔</span><h2>Notification Center</h2></div></div>' +
      '<div id="notification-page-list">' + renderNotificationCenterList() + '</div>' +
    '</div>' +
  '</section>';
}

function renderNotificationCenterList() {
  if (!state.notifications.length) {
    return '<div class="empty-state"><div class="empty-icon">🔔</div><h2>You\'re all caught up</h2><p>New StudentHub activity will appear here.</p></div>';
  }
  return '<div class="notification-center-list">' + state.notifications.map((notification) =>
    '<article class="notification-center-item ' + (notification.read ? '' : 'unread') + '">' +
      '<div class="notification-center-icon">' + (notification.read ? '🔔' : '●') + '</div>' +
      '<div class="notification-center-content">' +
        '<div class="notification-center-title-row"><strong>' + escapeHtml(notification.title || 'Notification') + '</strong><time>' + escapeHtml(formatDateTime(notification.created_at)) + '</time></div>' +
        '<p>' + escapeHtml(notification.message || notification.body || '') + '</p>' +
        (notification.read ? '' : '<button class="text-button notification-read-button" type="button" data-notification-read="' + escapeHtml(notification.id) + '">Mark as read</button>') +
      '</div></article>'
  ).join('') + '</div>';
}

async function markAllNotificationsRead() {
  if (!supabaseClient || !state.user) return;
  const { error } = await supabaseClient.from('notifications').update({ read: true }).eq('user_id', state.user.id).eq('read', false);
  if (error) { showMessage(error.message || 'Unable to mark notifications as read.', 'error'); return; }
  await loadNotifications();
  const list = $('#notification-page-list');
  if (list) list.innerHTML = renderNotificationCenterList();
  const button = $('#mark-all-notifications-read');
  if (button) button.disabled = true;
  renderTopbarAfterNotificationChange();
  showMessage('All notifications marked as read.');
}

function renderTopbarAfterNotificationChange() {
  const badge = $('#notification-badge');
  const unread = state.notifications.filter((item) => !item.read).length;
  if (badge) { badge.textContent = unread; badge.classList.toggle('has-unread', unread > 0); }
}

async function hydrateNotificationsPage() {
  await loadNotifications();
  const container = $('#page-container');
  if (!container) return;
  container.innerHTML = renderNotificationPage();
  $('#mark-all-notifications-read')?.addEventListener('click', markAllNotificationsRead);
  document.querySelectorAll('[data-notification-read]').forEach((button) => {
    button.addEventListener('click', async () => {
      await markNotificationRead(button.dataset.notificationRead);
      const list = $('#notification-page-list');
      if (list) list.innerHTML = renderNotificationCenterList();
      const markAll = $('#mark-all-notifications-read');
      if (markAll) markAll.disabled = !state.notifications.some((item) => !item.read);
      renderTopbarAfterNotificationChange();
    });
  });
}
async function markNotificationRead(
  id
) {
  if (!supabaseClient) return;

  const {
    error
  } = await supabaseClient
    .from("notifications")
    .update({
      read: true
    })
    .eq("id", id)
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    console.error(
      "Notification update error:",
      error
    );

    return;
  }

  await loadNotifications();

  const list =
    $("#notification-list");

  if (list) {
    list.innerHTML =
      renderNotifications();
  }
}


/* =========================================================
   PROFILE PAGE
   ========================================================= */

function renderProfile() {
  const profile = state.profile || {};
  const name = getDisplayName();
  const avatar = profile.avatar_url || "";
  const bio = profile.bio || "";

  return `
    <section class="page">
      <div class="page-header profile-page-header">
        <div>
          <p class="eyebrow">PROFILE</p>
          <h1>My Profile</h1>
          <p>Manage the information your classmates see.</p>
        </div>
      </div>

      <div class="profile-page-grid">
        <section class="panel profile-preview-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">👤</span>
              <h2>Profile Preview</h2>
            </div>
          </div>

          <div class="profile-preview">
            <div class="profile-preview-avatar">
              ${avatar ? '<img src="' + escapeHtml(avatar) + '" alt="Profile picture" />' : escapeHtml(getInitials(name))}
            </div>
            <h2>${escapeHtml(name)}</h2>
            <p class="profile-preview-email">${escapeHtml(state.user?.email || "")}</p>
            <p class="profile-preview-role"><span class="role-badge ${state.isAdmin ? "admin" : "student"}">${state.isAdmin ? "🛡️ Administrator" : "🎓 Student"}</span></p>
            <div class="profile-preview-bio">
              ${bio ? escapeHtml(bio) : "Add a short bio so your classmates can get to know you."}
            </div>
          </div>
        </section>

        <section class="panel profile-edit-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">✏️</span>
              <h2>Edit Profile</h2>
            </div>
          </div>

          <form id="profile-form" class="profile-form">
            <div class="profile-photo-editor">
              <div class="profile-form-avatar" id="profile-form-avatar">
                ${avatar ? '<img src="' + escapeHtml(avatar) + '" alt="Current profile picture" />' : escapeHtml(getInitials(name))}
              </div>
              <div>
                <strong>Profile picture</strong>
                <p>JPG, PNG, or WebP. Maximum 5 MB.</p>
                <label class="secondary-button profile-upload-button">
                  Choose Photo
                  <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" hidden />
                </label>
              </div>
            </div>

            <label class="field-label" for="profile-display-name">Display name</label>
            <input id="profile-display-name" class="text-input" type="text" maxlength="80"
              value="${escapeHtml(profile.display_name || name)}"
              placeholder="How classmates should see you" required />

            <label class="field-label" for="profile-full-name">Full name</label>
            <input id="profile-full-name" class="text-input" type="text" maxlength="120"
              value="${escapeHtml(profile.full_name || state.user?.user_metadata?.full_name || name)}"
              placeholder="Your full name" />

            <label class="field-label" for="profile-bio">Bio</label>
            <textarea id="profile-bio" class="text-input profile-bio-input" maxlength="240" rows="4"
              placeholder="Tell your classmates a little about yourself...">${escapeHtml(bio)}</textarea>

            <div id="profile-message" class="form-error"></div>
            <button class="primary-button" type="submit">Save Profile</button>
          </form>
        </section>
      </div>
    </section>
  `;
}

async function hydrateProfile() {
  await loadProfile();
  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderProfile();

  const avatarInput = $("#profile-avatar");
  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    const preview = $("#profile-form-avatar");
    if (!file || !preview) return;

    if (!file.type.startsWith("image/")) {
      avatarInput.value = "";
      showMessage("Please choose an image file.", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      avatarInput.value = "";
      showMessage("Profile pictures must be 5 MB or smaller.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      preview.innerHTML = '<img src="' + reader.result + '" alt="New profile picture preview" />';
    };
    reader.readAsDataURL(file);
  });

  $("#profile-form")?.addEventListener("submit", saveProfile);
}

async function saveProfile(event) {
  event.preventDefault();

  const displayName = $("#profile-display-name")?.value.trim();
  const fullName = $("#profile-full-name")?.value.trim();
  const bio = $("#profile-bio")?.value.trim() || "";
  const avatarInput = $("#profile-avatar");
  const message = $("#profile-message");
  const button = document.querySelector('#profile-form button[type="submit"]');

  if (message) {
    message.className = "form-error";
    message.textContent = "";
  }

  if (!displayName) {
    if (message) message.textContent = "Display name is required.";
    return;
  }

  if (!state.user || !supabaseClient) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    let avatarUrl = state.profile?.avatar_url || null;
    const file = avatarInput?.files?.[0];

    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
      const path = state.user.id + "/profile-" + Date.now() + "." + safeExtension;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(path);

      avatarUrl = publicData?.publicUrl || avatarUrl;
    }

    const profilePayload = {
      id: state.user.id,
      display_name: displayName,
      full_name: fullName || displayName,
      bio,
      avatar_url: avatarUrl
    };

    const { data, error } = await supabaseClient
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;

    state.profile = data;

    await supabaseClient.auth.updateUser({
      data: {
        display_name: displayName,
        full_name: fullName || displayName
      }
    });

    showMessage("Profile saved successfully.");
    avatarInput.value = "";
    renderAppShell();
    await hydrateProfile();
  } catch (error) {
    console.error("Profile save error:", error);

    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to save your profile.";
    }
  } finally {
    const currentButton = document.querySelector('#profile-form button[type="submit"]');
    if (currentButton) {
      currentButton.disabled = false;
      currentButton.textContent = "Save Profile";
    }
  }
}

function renderSearch(){return '<section class="page"><div class="page-header"><p class="eyebrow">STUDENTHUB SEARCH</p><h1>Search</h1><p>Find classmates, messages, assignments, calendar events, chapters, and feed posts.</p></div><section class="panel search-panel"><div class="global-search-box"><span>🔎</span><input id="global-search-input" class="text-input" type="search" placeholder="Search StudentHub..."/><button id="global-search-clear" class="secondary-button" type="button">Clear</button></div><div class="search-hint">Search is limited to information your account can access.</div></section><section id="search-results-panel">'+renderSearchResults()+'</section></section>';}
function renderSearchResults(){if(!state.searchQuery.trim())return '<section class="panel search-empty-state"><h2>Start searching</h2><p>Try a classmate, assignment, chapter, event, or message.</p></section>';if(!state.searchResults.length)return '<section class="panel search-empty-state"><h2>No results found</h2><p>Try a different keyword.</p></section>';return '<div class="search-result-summary"><strong>'+state.searchResults.length+'</strong> result(s)</div><div class="search-results-grid">'+state.searchResults.map(function(x){return '<button class="search-result-item" type="button" data-search-type="'+escapeHtml(x.type)+'" data-search-id="'+escapeHtml(x.id||'')+'"><span class="search-result-icon">'+escapeHtml(x.icon||'🔎')+'</span><span class="search-result-content"><strong>'+escapeHtml(x.title||'Result')+'</strong><small>'+escapeHtml(x.subtitle||'')+'</small><span>'+escapeHtml(x.preview||'')+'</span></span><span>›</span></button>';}).join('')+'</div>';}
function searchText(){return Array.from(arguments).filter(Boolean).join(' ').toLowerCase();}
async function loadSearchClassmates(){if(!supabaseClient||!state.user)return [];const r=await supabaseClient.from('profiles').select('id,display_name,full_name,bio').neq('id',state.user.id).limit(100);if(r.error)return [];return r.data||[];}
async function buildSearchResults(q){q=q.trim().toLowerCase();if(!q)return [];const people=await loadSearchClassmates();const r=[];people.forEach(function(x){if(searchText(x.display_name,x.full_name,x.bio).includes(q))r.push({type:'classmate',id:x.id,title:x.display_name||x.full_name||'Classmate',subtitle:'CNA Classmate',preview:x.bio||'Start a private message.',icon:'👤'});});state.assignments.forEach(function(x){if(searchText(x.title,x.description,x.status).includes(q))r.push({type:'assignment',id:x.id,title:x.title,subtitle:'Due '+formatDate(x.due_date),preview:x.description||'',icon:'📝'});});state.calendarEvents.forEach(function(x){if(searchText(x.title,x.description,x.location,x.event_type).includes(q))r.push({type:'calendar',id:x.id,title:x.title,subtitle:formatDate(x.start_time||x.event_date),preview:x.description||x.location||'',icon:'📅'});});state.chapters.forEach(function(x){if(searchText(x.title,x.name,x.chapter_title,x.description,x.chapter_number).includes(q))r.push({type:'chapter',id:x.id,title:x.title||x.name||('Chapter '+(x.chapter_number||'')),subtitle:'Chapter '+(x.chapter_number||''),preview:x.description||'',icon:'📖'});});state.feedPosts.forEach(function(x){if(searchText(x.title,x.content,x.body,x.message).includes(q))r.push({type:'feed',id:x.id,title:x.title||'Main Feed Post',subtitle:formatDateTime(x.created_at),preview:x.content||x.body||x.message||'',icon:'📰'});});state.careMessages.forEach(function(x){if(searchText(x.content,x.message).includes(q))r.push({type:'message',id:x.id,title:'The Care Team',subtitle:formatDateTime(x.created_at),preview:x.content||x.message||'',icon:'💬'});});return r.slice(0,100);}
async function hydrateSearch(){const container=$('#page-container');if(!container)return;container.innerHTML=renderSearch();const input=$('#global-search-input');input?.focus();const run=async function(){state.searchQuery=input?.value||'';const p=$('#search-results-panel');if(!p)return;if(!state.searchQuery.trim()){state.searchResults=[];p.innerHTML=renderSearchResults();return;}p.innerHTML='<section class="panel search-loading"><p>Searching StudentHub...</p></section>';state.searchResults=await buildSearchResults(state.searchQuery);p.innerHTML=renderSearchResults();attachSearchResultEvents();};input?.addEventListener('input',run);$('#global-search-clear')?.addEventListener('click',function(){if(input)input.value='';state.searchQuery='';state.searchResults=[];input?.focus();const p=$('#search-results-panel');if(p)p.innerHTML=renderSearchResults();});}
function attachSearchResultEvents(){document.querySelectorAll('[data-search-type]').forEach(function(b){b.addEventListener('click',async function(){const t=b.dataset.searchType,id=b.dataset.searchId;if(t==='classmate')await startDirectMessage(id);else if(t==='assignment')await navigate('assignments');else if(t==='calendar')await navigate('calendar');else if(t==='feed')await navigate('home');else if(t==='chapter')await navigate('chapter-tracker');else await navigate('care-team');});});}

/* =========================================================
   ACCOUNT & SETTINGS
   ========================================================= */

function renderAccount() {
  const notifications = state.notificationPreferences || {
    messages: true,
    feed_activity: true,
    calendar: true,
    study_reminders: true,
    academic_updates: true
  };

  const privacy = state.privacySettings || {
    show_online_status: true,
    allow_messages: true,
    show_profile_picture: true
  };

  return `
    <section class="page">
      <div class="page-header">
        <p class="eyebrow">ACCOUNT</p>
        <h1>Account & Settings</h1>
        <p>Manage your profile, security, notifications, privacy, and StudentHub preferences.</p>
      </div>

      <div class="settings-grid">

        <section class="panel settings-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">👤</span>
              <h2>Account</h2>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-account-card">
              <div class="large-avatar">
                ${state.profile?.avatar_url
                  ? '<img src="' + escapeHtml(state.profile.avatar_url) + '" alt="" />'
                  : escapeHtml(getInitials(getDisplayName()))}
              </div>
              <div>
                <strong>${escapeHtml(getDisplayName())}</strong>
                <span>${escapeHtml(state.user?.email || "")}</span>
              </div>
            </div>

            <div class="settings-actions">
              <button class="secondary-button" data-settings-action="profile">👤 Edit Profile</button>
              <button class="secondary-button" data-settings-action="export">📦 Export My Data</button>
              <button class="danger-button" data-settings-action="signout">🚪 Sign Out</button>
            </div>
          </div>
        </section>

        <section class="panel settings-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">🔐</span>
              <h2>Password & Security</h2>
            </div>
          </div>

          <form id="settings-password-form" class="settings-form">
            <label class="field-label">New password</label>
            <input id="settings-new-password" class="text-input" type="password" minlength="6" autocomplete="new-password" placeholder="At least 6 characters" required />

            <label class="field-label">Confirm new password</label>
            <input id="settings-confirm-password" class="text-input" type="password" minlength="6" autocomplete="new-password" placeholder="Re-enter your password" required />

            <div id="settings-password-message" class="form-error"></div>

            <button class="primary-button small-button" type="submit">Update Password</button>
          </form>
        </section>

        <section class="panel settings-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">🔔</span>
              <h2>Notification Settings</h2>
            </div>
          </div>

          <div class="settings-toggle-list">
            ${renderSettingToggle("messages", "Messages", "Private message notifications", notifications.messages)}
            ${renderSettingToggle("feed_activity", "Feed activity", "Updates from the Main Feed", notifications.feed_activity)}
            ${renderSettingToggle("calendar", "Calendar", "Class and calendar reminders", notifications.calendar)}
            ${renderSettingToggle("study_reminders", "Study reminders", "Study and learning reminders", notifications.study_reminders)}
            ${renderSettingToggle("academic_updates", "Academic updates", "Grades and academic updates", notifications.academic_updates)}
          </div>
        </section>

        <section class="panel settings-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">🛡️</span>
              <h2>Privacy</h2>
            </div>
          </div>

          <div class="settings-toggle-list">
            ${renderSettingToggle("show_online_status", "Online status", "Let classmates see when you're online or idle", privacy.show_online_status, "privacy")}
            ${renderSettingToggle("allow_messages", "Private messages", "Allow classmates to start one-on-one conversations with you", privacy.allow_messages, "privacy")}
            ${renderSettingToggle("show_profile_picture", "Profile picture", "Show your profile picture to classmates", privacy.show_profile_picture, "privacy")}
          </div>
        </section>

        <section class="panel settings-panel">
          <div class="panel-header">
            <div>
              <span class="panel-icon">🎨</span>
              <h2>Appearance</h2>
            </div>
          </div>

          <div class="appearance-setting">
            <div>
              <strong>Theme</strong>
              <span>Choose how StudentHub looks on this device.</span>
            </div>
            <button class="secondary-button" id="settings-theme-button" type="button">
              ${document.documentElement.dataset.theme === "light" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </section>

      </div>
    </section>
  `;
}

function renderSettingToggle(key, title, description, enabled, group = "notifications") {
  return `
    <label class="settings-toggle">
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </span>
      <input
        type="checkbox"
        data-settings-toggle="${escapeHtml(key)}"
        data-settings-group="${escapeHtml(group)}"
        ${enabled ? "checked" : ""}
      />
      <span class="settings-switch" aria-hidden="true"></span>
    </label>
  `;
}

async function hydrateAccount() {
  const container = $("#page-container");
  if (!container) return;

  container.innerHTML = renderAccount();

  document.querySelectorAll("[data-settings-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.settingsAction;

      if (action === "profile") {
        await navigate("profile");
      } else if (action === "export") {
        await exportMyData();
      } else if (action === "signout") {
        await signOut();
      }
    });
  });

  $("#settings-password-form")?.addEventListener("submit", handleSettingsPassword);

  document.querySelectorAll("[data-settings-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      saveSettingsToggle(toggle.dataset.settingsGroup, toggle.dataset.settingsToggle, toggle.checked);
    });
  });

  $("#settings-theme-button")?.addEventListener("click", () => {
    toggleTheme();
    hydrateAccount();
  });
}

async function handleSettingsPassword(event) {
  event.preventDefault();

  const password = $("#settings-new-password")?.value || "";
  const confirm = $("#settings-confirm-password")?.value || "";
  const message = $("#settings-password-message");
  const button = document.querySelector("#settings-password-form button[type=\"submit\"]");

  if (message) {
    message.className = "form-error";
    message.textContent = "";
  }

  if (password.length < 6) {
    if (message) message.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirm) {
    if (message) message.textContent = "Passwords do not match.";
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Updating...";
  }

  try {
    await updatePassword(password);

    if (message) {
      message.className = "form-success";
      message.textContent = "Password updated successfully.";
    }

    $("#settings-new-password").value = "";
    $("#settings-confirm-password").value = "";
  } catch (error) {
    console.error("Settings password update error:", error);
    if (message) {
      message.className = "form-error";
      message.textContent = error?.message || "Unable to update your password.";
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Update Password";
    }
  }
}

async function saveSettingsToggle(group, key, enabled) {
  if (!supabaseClient || !state.user) return;

  try {
    if (group === "privacy") {
      const next = {
        ...(state.privacySettings || {}),
        user_id: state.user.id,
        [key]: enabled
      };

      const { data, error } = await supabaseClient
        .from("privacy_settings")
        .upsert(next, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;
      state.privacySettings = data;
    } else {
      const next = {
        ...(state.notificationPreferences || {}),
        user_id: state.user.id,
        [key]: enabled
      };

      const { data, error } = await supabaseClient
        .from("notification_preferences")
        .upsert(next, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;
      state.notificationPreferences = data;
    }

    showMessage("Setting saved.");
  } catch (error) {
    console.error("Settings save error:", error);
    showMessage(error?.message || "Unable to save that setting.", "error");
  }
}

function buildExportData() {
  return {
    exported_at: new Date().toISOString(),
    account: {
      id: state.user?.id || null,
      email: state.user?.email || null,
      created_at: state.user?.created_at || null
    },
    profile: state.profile || null,
    academic_summary: state.academicSummary || null,
    score_details: state.scoreDetails || [],
    chapters: state.chapters || [],
    assignments: state.assignments || [],
    calendar_events: state.calendarEvents || [],
    notifications: state.notifications || [],
    notification_preferences: state.notificationPreferences || null,
    privacy_settings: state.privacySettings || null,
    care_team_messages: state.careMessages || [],
    pinned_messages: state.pinnedMessages || [],
    message_reactions: state.messageReactions || [],
    conversations: state.conversations || []
  };
}

async function exportMyData() {
  if (!state.user) return;

  try {
    showMessage("Preparing your data export...");

    await Promise.allSettled([
      loadAcademicSummary(),
      loadScoreDetails(),
      loadChapters(),
      loadAssignments(),
      loadCalendarEvents(),
      loadNotifications(),
      loadCareMessages(),
      loadPinnedMessages(),
      loadMessageReactions(),
      loadConversations()
    ]);

    const blob = new Blob(
      [JSON.stringify(buildExportData(), null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studenthub-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showMessage("Your StudentHub data export is ready.");
  } catch (error) {
    console.error("Data export error:", error);
    showMessage(error?.message || "Unable to export your data.", "error");
  }
}

async function handleAccountAction(action) {
  const menu = $("#account-menu");
  if (menu) menu.hidden = true;

  switch (action) {
    case "profile":
      await navigate("profile");
      break;
    case "details":
      await navigate("account");
      break;
    case "security":
      await navigate("account");
      break;
    case "privacy":
      await navigate("account");
      break;
    case "appearance":
      await navigate("account");
      break;
    case "export":
      await exportMyData();
      break;
    case "notifications":
      await navigate("account");
      break;
    case "signout":
      await signOut();
      break;
    default:
      break;
  }
}
/* =========================================================
   USER SETTINGS
   ========================================================= */

async function loadSettings() {
  if (!supabaseClient || !state.user)
    return;

  const [
    notificationResult,
    privacyResult
  ] = await Promise.all([
    supabaseClient
      .from(
        "notification_preferences"
      )
      .select("*")
      .eq(
        "user_id",
        state.user.id
      )
      .maybeSingle(),

    supabaseClient
      .from(
        "privacy_settings"
      )
      .select("*")
      .eq(
        "user_id",
        state.user.id
      )
      .maybeSingle()
  ]);

  state.notificationPreferences =
    notificationResult.data ||
    null;

  state.privacySettings =
    privacyResult.data ||
    null;
}

/* =========================================================
   SEARCH
   ========================================================= */

function globalSearch(query) {
  const search =
    query
      .trim()
      .toLowerCase();

  if (!search) return [];

  const results = [];

  state.chapters.forEach(
    (chapter) => {
      const text =
        `${chapter.chapter_number} ${chapter.title}`
          .toLowerCase();

      if (
        text.includes(search)
      ) {
        results.push({
          type: "Chapter",
          title:
            `Chapter ${chapter.chapter_number}`,
          description:
            chapter.title,
          page:
            "chapter-tracker"
        });
      }
    }
  );

  state.feedPosts.forEach(
    (post) => {
      if (
        String(
          post.content || ""
        )
          .toLowerCase()
          .includes(search)
      ) {
        results.push({
          type: "Feed",
          title:
            "Main Feed Post",
          description:
            post.content,
          page:
            "home"
        });
      }
    }
  );

  state.flashcardDecks.forEach(
    (deck) => {
      if (
        `${deck.title} ${
          deck.description || ""
        }`
          .toLowerCase()
          .includes(search)
      ) {
        results.push({
          type:
            "Flashcards",
          title:
            deck.title,
          description:
            deck.description ||
            "Flashcard deck",
          page:
            "flashcards"
        });
      }
    }
  );

  state.quizSets.forEach(
    (quiz) => {
      if (
        `${quiz.title} ${
          quiz.description || ""
        }`
          .toLowerCase()
          .includes(search)
      ) {
        results.push({
          type:
            "Quiz",
          title:
            quiz.title,
          description:
            quiz.description ||
            "Practice quiz",
          page:
            "quiz-maker"
        });
      }
    }
  );

  return results.slice(
    0,
    20
  );
}

/* =========================================================
   PLACEHOLDER FALLBACK
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
            ${escapeHtml(
              description
            )}
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
          This area is ready for StudentHub.
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
        state.user =
          session.user;

        if (event === "PASSWORD_RECOVERY") {
          renderResetPassword();
          return;
        }

        if (
          event ===
          "SIGNED_IN" &&
          !state.authStarting
        ) {
          await startAuthenticatedApp();
        }

        await setupCareRealtime();

        return;
      }

      if (
        event ===
        "SIGNED_OUT"
      ) {
        if (careRealtimeChannel) {
          supabaseClient.removeChannel(careRealtimeChannel);
          careRealtimeChannel = null;
        }

        if (careRealtimeRefreshTimer) {
          clearTimeout(careRealtimeRefreshTimer);
          careRealtimeRefreshTimer = null;
        }

        resetState();
        renderLogin();
      }

    }
  );
}

/* =========================================================
   AUTHENTICATED START
   ========================================================= */

async function startAuthenticatedApp() {
  if (state.authStarting)
    return;

  state.authStarting =
    true;

  try {
    showLoading(
      "Loading your StudentHub..."
    );

    state.user =
      await getCurrentUser();

    if (!state.user) {
      renderLogin();
      return;
    }

    await Promise.all([
      loadProfile(),
      loadClasses(),
      loadChapters(),
      loadSettings(),
      loadAdminStatus()
    ]);

    if (state.accountSuspended) {
      await supabaseClient.auth.signOut();
      resetState();
      renderLogin();
      return;
    }

    await updatePresence(
      "online"
    );

    startPresenceLifecycle();

    state.currentPage =
      "home";

    renderAppShell();

    await hydrateHome();

    state.initialized =
      true;
  } catch (error) {
    console.error(
      "Authenticated startup error:",
      error
    );

    showBootError(error);
  } finally {
    state.authStarting =
      false;
  }
}

/* =========================================================
   APPLICATION STARTUP
   ========================================================= */

async function startApp() {
  try {
    showLoading();

    initializeSupabase();

    setupAuthListener();

    const user =
      await getCurrentUser();

    if (!user) {
      renderLogin();
      return;
    }

    state.user =
      user;

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
   PRESENCE LIFECYCLE
   ========================================================= */

function markPresenceActivity() {
  if (!state.user) return;
  lastPresenceActivity = Date.now();
  if (!document.hidden) updatePresence("online");
}

function startPresenceLifecycle() {
  if (presenceHeartbeat) clearInterval(presenceHeartbeat);
  if (presenceIdleTimer) clearInterval(presenceIdleTimer);
  if (activeUsersRefreshTimer) clearInterval(activeUsersRefreshTimer);

  activeUsersRefreshTimer = setInterval(async () => {
    if (!state.user) return;

    await loadActiveUsers();

    const activeUsersContainer = $("#active-users");
    if (activeUsersContainer) {
      activeUsersContainer.innerHTML = renderActiveUsers();
    }
  }, 15000);

  lastPresenceActivity = Date.now();
  updatePresence(document.hidden ? "idle" : "online");

  presenceHeartbeat = setInterval(() => {
    if (!state.user) return;
    const inactiveFor = Date.now() - lastPresenceActivity;
    updatePresence(
      document.hidden || inactiveFor >= PRESENCE_IDLE_MS
        ? "idle"
        : "online"
    );
  }, PRESENCE_HEARTBEAT_MS);

  presenceIdleTimer = setInterval(() => {
    if (!state.user || document.hidden) return;
    if (Date.now() - lastPresenceActivity >= PRESENCE_IDLE_MS) {
      updatePresence("idle");
    }
  }, 30 * 1000);
}

["click", "keydown", "touchstart", "scroll"].forEach((eventName) => {
  document.addEventListener(eventName, markPresenceActivity, { passive: true });
});

document.addEventListener(
  "visibilitychange",
  () => {
    if (!state.user) return;
    lastPresenceActivity = Date.now();
    updatePresence(document.hidden ? "idle" : "online");
  }
);

window.addEventListener(
  "beforeunload",
  () => {
    if (state.user) updatePresence("offline");
    if (presenceHeartbeat) clearInterval(presenceHeartbeat);
    if (presenceIdleTimer) clearInterval(presenceIdleTimer);
    if (activeUsersRefreshTimer) clearInterval(activeUsersRefreshTimer);
  }
);

/* =========================================================
   GLOBAL ERROR HANDLING
   ========================================================= */

window.addEventListener(
  "error",
  (event) => {
    console.error(
      "StudentHub runtime error:",
      event.error ||
      event.message
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
   THEME RESTORE
   ========================================================= */

(function restoreTheme() {
  const saved =
    localStorage.getItem(
      "studenthub-theme"
    );

  if (
    saved === "dark" ||
    saved === "light"
  ) {
    document.documentElement
      .dataset.theme =
      saved;
  }
})();

/* =========================================================
   DOM READY
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startApp
  );
} else {
  startApp();
}