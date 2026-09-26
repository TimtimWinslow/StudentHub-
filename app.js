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
          <div class="auth-logo-mark">S</div>

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
}

function renderSignUp() {
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

    if (message) {
      message.className = "form-success";
      message.textContent = "Account created. Check your email to confirm your account, then sign in.";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "Create Account";
    }
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

function renderResetPassword() {
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
        <div class="brand-mark">S</div>

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

            <span>Student</span>
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
            ${escapeHtml(
              getInitials(
                getDisplayName()
              )
            )}
          </span>

          <span class="account-name">
            ${escapeHtml(
              getDisplayName()
            )}
          </span>

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
    "care-team": "The Care Team",
    flashcards: "Flashcards",
    "quiz-maker": "Quiz Maker",
    "study-timer": "Study Timer",
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
      toggleNotificationPanel
    );

  $("#close-notifications")
    ?.addEventListener(
      "click",
      closeNotificationPanel
    );

  $("#messages-button")
    ?.addEventListener(
      "click",
      () => navigate("care-team")
    );

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

  if (page === "calendar") {
    await hydrateCalendar();
  }

  if (page === "assignments") {
    await hydrateAssignments();
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

  if (page === "account") {
    await hydrateAccount();
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
    .from("assignments").select("*").eq("user_id", state.user.id)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) { console.error("Assignments load error:", error); state.assignments=[]; return []; }
  state.assignments = data || [];
  return state.assignments;
}

function assignmentStatusLabel(status) {
  return ({not_started:"Not Started",in_progress:"In Progress",completed:"Completed"})[status] || "Not Started";
}

function renderAssignments() {
  const now = new Date();
  const active = state.assignments.filter(a => a.status !== "completed");
  const completed = state.assignments.filter(a => a.status === "completed");
  const overdue = active.filter(a => a.due_date && new Date(a.due_date) < now);
  return `<section class="page"><div class="page-header"><div><p class="eyebrow">STUDENTHUB</p><h1>Assignments</h1><p>Keep track of classwork, due dates, and what still needs to be finished.</p></div><button class="primary-button" id="add-assignment-button">+ Add Assignment</button></div><div class="assignment-summary-grid"><div class="panel assignment-stat"><strong>${active.length}</strong><span>Active</span></div><div class="panel assignment-stat"><strong>${completed.length}</strong><span>Completed</span></div><div class="panel assignment-stat"><strong>${overdue.length}</strong><span>Overdue</span></div></div><div class="panel"><div class="panel-header"><div><span class="panel-icon">📝</span><h2>My Assignments</h2></div></div>${renderAssignmentList()}</div></section>`;
}

function renderAssignmentList() {
  if (!state.assignments.length) return `<div class="empty-state"><div class="empty-icon">📝</div><h3>No assignments yet</h3><p>Add your first class assignment.</p></div>`;
  const now = new Date();
  return `<div class="assignment-list">${state.assignments.map(a => {
    const overdue = a.status !== "completed" && a.due_date && new Date(a.due_date) < now;
    return `<article class="assignment-item ${overdue ? "assignment-overdue" : ""}"><div class="assignment-main"><div class="assignment-title-row"><h3>${escapeHtml(a.title || "Assignment")}</h3><span class="assignment-status">${escapeHtml(assignmentStatusLabel(a.status))}</span></div><p>${escapeHtml(a.description || "No description")}</p><div class="assignment-meta"><span>📅 ${a.due_date ? escapeHtml(formatDate(a.due_date)) : "No due date"}</span>${a.priority ? `<span>⚑ ${escapeHtml(a.priority)}</span>` : ""}</div></div><div class="assignment-actions"><button class="secondary-button" data-assignment-status="${escapeHtml(a.id)}">Status</button><button class="danger-action" data-assignment-delete="${escapeHtml(a.id)}">Delete</button></div></article>`;
  }).join("")}</div>`;
}

async function addAssignment() {
  if (!supabaseClient || !state.user) return;
  const title = prompt("Assignment name:");
  if (!title?.trim()) return;
  const dueDate = prompt("Due date (YYYY-MM-DD, optional):");
  const description = prompt("Description (optional):");
  const priority = prompt("Priority (Low / Normal / High):", "Normal");
  const { error } = await supabaseClient.from("assignments").insert({
    user_id: state.user.id, title: title.trim(), description: description?.trim() || null,
    due_date: dueDate?.trim() || null, priority: priority?.trim().toLowerCase() || "normal", status: "not_started"
  });
  if (error) { showMessage(error.message || "Unable to add assignment.", "error"); return; }
  showMessage("Assignment added."); await navigate("assignments");
}

async function changeAssignmentStatus(id) {
  const item = state.assignments.find(a => String(a.id) === String(id));
  if (!item) return;
  const choice = prompt("Status: not_started, in_progress, or completed", item.status || "not_started");
  if (!choice) return;
  const status = choice.trim().toLowerCase().replace(/\s+/g, "_");
  if (!["not_started","in_progress","completed"].includes(status)) { showMessage("Invalid status.", "error"); return; }
  const { error } = await supabaseClient.from("assignments").update({status}).eq("id", id).eq("user_id", state.user.id);
  if (error) { showMessage(error.message || "Unable to update assignment.", "error"); return; }
  await navigate("assignments");
}

async function deleteAssignment(id) {
  if (!confirm("Delete this assignment?")) return;
  const { error } = await supabaseClient.from("assignments").delete().eq("id", id).eq("user_id", state.user.id);
  if (error) { showMessage(error.message || "Unable to delete assignment.", "error"); return; }
  showMessage("Assignment deleted."); await navigate("assignments");
}

async function hydrateAssignments() {
  await loadAssignments();
  const container = $("#page-container"); if (!container) return;
  container.innerHTML = renderAssignments();
  $("#add-assignment-button")?.addEventListener("click", addAssignment);
  document.querySelectorAll("[data-assignment-status]").forEach(b => b.addEventListener("click", () => changeAssignmentStatus(b.dataset.assignmentStatus)));
  document.querySelectorAll("[data-assignment-delete]").forEach(b => b.addEventListener("click", () => deleteAssignment(b.dataset.assignmentDelete)));
}

/* =========================================================
   CARE TEAM
   ========================================================= */

async function loadCareMessages() {
  if (!supabaseClient) return [];

  const {
    data,
    error
  } = await supabaseClient
    .from("messages")
    .select(`
      *,
      profiles (
        id,
        display_name,
        full_name,
        avatar_url
      )
    `)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(
      "Care Team load error:",
      error
    );

    state.careMessages = [];

    return [];
  }

  state.careMessages =
    data || [];

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

function renderCareTeam() {
  return `
    <section class="page">

      <div class="page-header">

        <div>

          <p class="eyebrow">
            COMMUNITY
          </p>

          <h1>
            The Care Team
          </h1>

          <p>
            Stay connected with your CNA classmates.
          </p>

        </div>

      </div>

      <div class="panel care-team-panel">

        <div
          class="care-team-messages"
          id="care-team-messages"
        >
          ${renderCareMessages()}
        </div>

        <form
          id="care-message-form"
          class="care-message-form"
        >

          <input
            id="care-message-input"
            class="text-input"
            type="text"
            maxlength="2000"
            placeholder="Message The Care Team..."
            autocomplete="off"
            required
          />

          <button
            class="primary-button"
            type="submit"
          >
            Send
          </button>

        </form>

      </div>

    </section>
  `;
}

function renderCareMessages() {
  if (!state.careMessages.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <h3>No messages yet</h3>
        <p>
          Start the conversation.
        </p>
      </div>
    `;
  }

  return `
    <div class="care-message-list">

      ${state.careMessages
        .map((message) =>
          renderCareMessage(
            message
          )
        )
        .join("")}

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
    message.user_id ===
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

        <div class="care-message-content">
          ${escapeHtml(
            message.content ||
            message.message ||
            ""
          )}
        </div>

        ${
          mine
            ? `
              <div class="care-message-actions">

                ${
                  editable
                    ? `
                      <button
                        data-edit-message="${escapeHtml(
                          message.id
                        )}"
                      >
                        Edit
                      </button>
                    `
                    : ""
                }

                <button
                  data-delete-message="${escapeHtml(
                    message.id
                  )}"
                >
                  Delete
                </button>

              </div>
            `
            : ""
        }

      </div>

    </div>
  `;
}

async function hydrateCareTeam() {
  await Promise.all([
    loadCareMessages(),
    loadPinnedMessages()
  ]);

  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderCareTeam();

  $("#care-message-form")
    ?.addEventListener(
      "submit",
      handleCareMessageSubmit
    );

  document
    .querySelectorAll(
      "[data-edit-message]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          editCareMessage(
            button.dataset
              .editMessage
          )
      );
    });

  document
    .querySelectorAll(
      "[data-delete-message]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () =>
          deleteCareMessage(
            button.dataset
              .deleteMessage
          )
      );
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

  await sendCareMessage(
    content
  );

  if (input) {
    input.value = "";
  }
}

async function sendCareMessage(content) {
  if (!supabaseClient || !state.user)
    return;

  const payload = {
    user_id: state.user.id,
    content
  };

  let result =
    await supabaseClient
      .from("messages")
      .insert(payload);

  if (
    result.error &&
    result.error.message
      ?.toLowerCase()
      .includes("content")
  ) {
    result =
      await supabaseClient
        .from("messages")
        .insert({
          user_id:
            state.user.id,
          message: content
        });
  }

  if (result.error) {
    showMessage(
      result.error.message ||
      "Unable to send message.",
      "error"
    );

    return;
  }

  await hydrateCareTeam();
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
      content:
        updated.trim()
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

  await hydrateCareTeam();
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

  await hydrateCareTeam();
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
            Enter and manage your chapter test scores.
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

              ${state.classes
                .map(
                  (classItem) => `
                    <option
                      value="${escapeHtml(
                        classItem.id
                      )}"
                      ${
                        classItem.id ===
                        state.currentClassId
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

function attachChapterTrackerEvents() {
  const form =
    $("#score-form");

  if (!form) return;

  const dateInput =
    $("#score-date");

  if (
    dateInput &&
    !dateInput.value
  ) {
    dateInput.value =
      new Date()
        .toISOString()
        .split("T")[0];
  }

  form.addEventListener(
    "submit",
    handleScoreSubmit
  );
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

          <p class="eyebrow">
            ACADEMIC PERFORMANCE
          </p>

          <h1>
            Progress
          </h1>

          <p>
            Your scores, averages, GPA,
            consistency, and chapter progress.
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
  const summary =
    state.academicSummary;

  if (!summary) {
    return `
      <div class="panel">

        <div class="empty-state">

          <div class="empty-icon">
            📈
          </div>

          <h2>
            No progress data yet
          </h2>

          <p>
            Add scores in Chapter Tracker
            to start building your progress.
          </p>

        </div>

      </div>
    `;
  }

  const average =
    summary.overall_average !==
      null &&
    summary.overall_average !==
      undefined
      ? Number(
          summary.overall_average
        ).toFixed(2)
      : "—";

  const gpa =
    summary.GPA !== undefined &&
    summary.GPA !== null
      ? Number(
          summary.GPA
        ).toFixed(2)
      : summary.gpa !== undefined &&
        summary.gpa !== null
      ? Number(
          summary.gpa
        ).toFixed(2)
      : "—";

  const letter =
    summary.overall_letter_grade ||
    "—";

  const consistency =
    summary.score_consistency !==
      null &&
    summary.score_consistency !==
      undefined
      ? Number(
          summary.score_consistency
        ).toFixed(2)
      : "—";

  const lowest =
    summary.lowest_score !==
      null &&
    summary.lowest_score !==
      undefined
      ? `${Number(
          summary.lowest_score
        ).toFixed(2)}%`
      : "—";

  const highest =
    summary.highest_score !==
      null &&
    summary.highest_score !==
      undefined
      ? `${Number(
          summary.highest_score
        ).toFixed(2)}%`
      : "—";

  return `
    <div class="progress-grid">

      <div class="panel progress-main-card">

        <div class="panel-header">

          <div>
            <span class="panel-icon">
              📊
            </span>

            <h2>
              Personal Progress Snapshot
            </h2>
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
            <span class="panel-icon">
              🎓
            </span>

            <h2>
              Academic Stats
            </h2>

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

      <div class="panel progress-chapters-panel">

        <div class="panel-header">

          <div>
            <span class="panel-icon">📚</span>
            <h2>Chapter Progress</h2>
          </div>

        </div>

        ${
          state.chapters.length
            ? `
              <div class="chapter-progress-list">
                ${state.chapters
                  .map((chapter) => {
                    const matchingScore =
                      state.scoreDetails.find(
                        (score) =>
                          String(score.chapter_id) ===
                          String(chapter.id)
                      );

                    const completed = Boolean(matchingScore);
                    const scoreText = completed
                      ? `${Number(matchingScore.score).toFixed(2)}%`
                      : "Pending";

                    const letter = completed
                      ? (matchingScore.letter_grade || calculateLetterGrade(matchingScore.score))
                      : "";

                    return `
                      <div class="chapter-progress-row">
                        <div class="chapter-progress-main">
                          <strong>Chapter ${escapeHtml(chapter.chapter_number)}</strong>
                          <span>${escapeHtml(chapter.title || "Chapter")}</span>
                        </div>
                        <div class="chapter-progress-result">
                          ${completed
                            ? `<strong>${scoreText}</strong><span class="${getLetterClass(letter)}">${escapeHtml(letter)}</span>`
                            : `<span class="chapter-pending">Pending</span>`}
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
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
            <span class="panel-icon">
              📚
            </span>

            <h2>
              Score History
            </h2>
          </div>

        </div>

        ${
          state.scoreDetails.length
            ? `
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
            `
            : `
              <div class="empty-state">
                <p>
                  No score history yet.
                </p>
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
    loadScoreDetails(),
    loadChapters()
  ]);

  const container =
    $("#progress-content");

  if (container) {
    container.innerHTML =
      renderProgressContent();
  }
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

          <h1>
            Account
          </h1>

          <p>
            Manage your StudentHub account.
          </p>

        </div>

      </div>

      <div class="account-grid">

        <section class="panel">

          <div class="panel-header">

            <div>
              <span class="panel-icon">
                👤
              </span>

              <h2>
                My Profile
              </h2>
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
              <span class="panel-icon">
                ⚙️
              </span>

              <h2>
                Account Controls
              </h2>
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
              data-account-page-action="appearance"
            >
              🎨 Appearance / Theme
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

async function hydrateAccount() {
  const container =
    $("#page-container");

  if (!container) return;

  container.innerHTML =
    renderAccount();

  document
    .querySelectorAll(
      "[data-account-page-action]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          handleAccountAction(
            button.dataset
              .accountPageAction
          );
        }
      );
    });
}

async function handleAccountAction(
  action
) {
  const menu =
    $("#account-menu");

  if (menu) {
    menu.hidden = true;
  }

  switch (action) {
    case "profile":
    case "details":
      await navigate("account");
      break;

    case "security":
      await changePassword();
      break;

    case "privacy":
      await managePrivacy();
      break;

    case "appearance":
      toggleTheme();
      break;

    case "export":
      await requestDataExport();
      break;

    case "notifications":
      await manageNotifications();
      break;

    case "signout":
      await signOut();
      break;

    default:
      break;
  }
}

async function changePassword() {
  const password =
    prompt(
      "Enter your new password:"
    );

  if (!password) return;

  if (password.length < 6) {
    alert(
      "Password must be at least 6 characters."
    );

    return;
  }

  const {
    error
  } = await supabaseClient.auth.updateUser({
    password
  });

  if (error) {
    showMessage(
      error.message ||
      "Unable to change password.",
      "error"
    );

    return;
  }

  showMessage(
    "Password updated successfully."
  );
}

async function managePrivacy() {
  if (!supabaseClient || !state.user)
    return;

  const current =
    state.privacySettings || {
      show_online_status: true,
      allow_messages: true,
      show_profile_picture: true
    };

  const showOnline =
    confirm(
      `Show your online status?\n\nCurrent: ${
        current.show_online_status
          ? "ON"
          : "OFF"
      }`
    );

  const allowMessages =
    confirm(
      `Allow other students to message you?\n\nCurrent: ${
        current.allow_messages
          ? "ON"
          : "OFF"
      }`
    );

  const {
    error
  } = await supabaseClient
    .from("privacy_settings")
    .upsert({
      user_id:
        state.user.id,
      show_online_status:
        showOnline,
      allow_messages:
        allowMessages,
      show_profile_picture:
        current.show_profile_picture
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to update privacy.",
      "error"
    );

    return;
  }

  state.privacySettings = {
    ...current,
    show_online_status:
      showOnline,
    allow_messages:
      allowMessages
  };

  showMessage(
    "Privacy settings updated."
  );
}

async function manageNotifications() {
  if (!supabaseClient || !state.user)
    return;

  const current =
    state.notificationPreferences || {
      messages: true,
      feed_activity: true,
      calendar: true,
      study_reminders: true,
      academic_updates: true
    };

  const messages =
    confirm(
      "Enable message notifications?"
    );

  const feed =
    confirm(
      "Enable feed notifications?"
    );

  const calendar =
    confirm(
      "Enable calendar notifications?"
    );

  const study =
    confirm(
      "Enable study reminders?"
    );

  const academic =
    confirm(
      "Enable academic updates?"
    );

  const {
    error
  } = await supabaseClient
    .from(
      "notification_preferences"
    )
    .upsert({
      user_id:
        state.user.id,
      messages,
      feed_activity:
        feed,
      calendar,
      study_reminders:
        study,
      academic_updates:
        academic
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to update notifications.",
      "error"
    );

    return;
  }

  state.notificationPreferences = {
    messages,
    feed_activity:
      feed,
    calendar,
    study_reminders:
      study,
    academic_updates:
      academic
  };

  showMessage(
    "Notification settings updated."
  );
}

function toggleTheme() {
  const current =
    document.documentElement
      .dataset.theme ||
    "dark";

  const next =
    current === "dark"
      ? "light"
      : "dark";

  document.documentElement
    .dataset.theme =
    next;

  localStorage.setItem(
    "studenthub-theme",
    next
  );

  showMessage(
    `${next === "dark" ? "Dark" : "Light"} theme selected.`
  );
}

async function requestDataExport() {
  if (!supabaseClient || !state.user)
    return;

  const {
    error
  } = await supabaseClient
    .from("data_export_requests")
    .insert({
      user_id:
        state.user.id,
      status:
        "requested"
    });

  if (error) {
    showMessage(
      error.message ||
      "Unable to request your data export.",
      "error"
    );

    return;
  }

  showMessage(
    "Your data export request has been submitted."
  );
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

        return;
      }

      if (
        event ===
        "SIGNED_OUT"
      ) {
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
      loadSettings()
    ]);

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