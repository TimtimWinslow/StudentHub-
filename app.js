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
  chapters: [],

  feedPosts: [],
  activeUsers: [],

  calendarEvents: [],
  notifications: [],
  unreadNotifications: 0,

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
  notes: [],
  studySessions: [],

  notificationPreferences: null,
  privacySettings: null,

  calendarDate: new Date(),

  timer: {
    running: false,
    mode: "study",
    seconds: 25 * 60,
    interval: null
  },

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

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);

  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
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

function getCurrentClass() {
  return (
    state.classes.find(
      (item) => item.id === state.currentClassId
    ) || state.classes[0] || null
  );
}

function showLoading(message = "Loading StudentHub...") {
  const app = $("#app");

  if (!app) return;

  app.innerHTML = `
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <div class="loading-title">StudentHub</div>
      <div class="loading-message">
        ${escapeHtml(message)}
      </div>
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

        <button
          class="primary-button"
          id="retry-app"
        >
          Try Again
        </button>
      </div>
    </div>
  `;

  $("#retry-app")?.addEventListener("click", () => {
    window.location.reload();
  });
}

function showMessage(container, message, type = "success") {
  if (!container) return;

  container.innerHTML = `
    <div class="form-${type}">
      ${escapeHtml(message)}
    </div>
  `;
}

function getProfileFromRecord(record) {
  return record?.profiles || {};
}

function getNameFromProfile(profile) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.name ||
    "Student"
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
    console.error(
      "Unable to get current user:",
      error
    );

    return null;
  }

  return data?.user || null;
}

async function signIn(email, password) {
  if (!supabaseClient) {
    throw new Error(
      "Supabase is not initialized."
    );
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

async function resetPassword(email) {
  if (!supabaseClient) {
    throw new Error(
      "Supabase is not initialized."
    );
  }

  const {
    error
  } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin
    }
  );

  if (error) throw error;
}

async function signOut() {
  if (!supabaseClient) return;

  const {
    error
  } = await supabaseClient.auth.signOut();

  if (error) {
    console.error(
      "Sign out error:",
      error
    );
  }

  resetState();

  renderLogin();
}

function resetState() {
  if (state.timer.interval) {
    clearInterval(state.timer.interval);
  }

  state.user = null;
  state.profile = null;
  state.classes = [];
  state.currentPage = "home";

  state.academicSummary = null;
  state.scoreDetails = [];
  state.chapters = [];

  state.feedPosts = [];
  state.activeUsers = [];

  state.calendarEvents = [];
  state.notifications = [];
  state.unreadNotifications = 0;

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

  state.timer.running = false;
  state.timer.mode = "study";
  state.timer.seconds = 25 * 60;
  state.timer.interval = null;
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

            <p>
              Your CNA class. Your progress. Your community.
            </p>
          </div>
        </div>

        <div class="auth-heading">
          <h2>Welcome back</h2>

          <p>
            Sign in to continue to StudentHub.
          </p>
        </div>

        <form id="login-form">

          <label
            class="field-label"
            for="login-email"
          >
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

          <label
            class="field-label"
            for="login-password"
          >
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
}

async function handleLogin(event) {
  event.preventDefault();

  const email =
    $("#login-email")?.value.trim();

  const password =
    $("#login-password")?.value || "";

  const errorElement =
    $("#login-error");

  const submitButton =
    document.querySelector(
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
    submitButton.textContent =
      "Signing In...";
  }

  try {
    await signIn(email, password);
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    if (errorElement) {
      errorElement.textContent =
        error?.message ||
        "Unable to sign in. Please check your information.";
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "Sign In";
    }
  }
}

async function handleForgotPassword() {
  const email =
    $("#login-email")?.value.trim();

  if (!email) {
    alert(
      "Enter your email address first."
    );

    $("#login-email")?.focus();

    return;
  }

  try {
    await resetPassword(email);

    alert(
      "If that email is registered, a password reset link has been sent."
    );
  } catch (error) {
    console.error(
      "Password reset error:",
      error
    );

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
  if (!supabaseClient || !state.user) {
    return null;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Profile load error:",
      error
    );

    return null;
  }

  state.profile = data || null;

  return state.profile;
}

/* =========================================================
   CLASSES
   ========================================================= */

async function loadClasses() {
  if (!supabaseClient || !state.user) {
    return [];
  }

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
    .eq(
      "student_id",
      state.user.id
    );

  if (error) {
    console.error(
      "Class load error:",
      error
    );

    state.classes = [];

    return [];
  }

  state.classes = (data || [])
    .map((item) => item.classes)
    .filter(Boolean);

  if (
    !state.currentClassId &&
    state.classes.length
  ) {
    state.currentClassId =
      state.classes[0].id;
  }

  return state.classes;
}

/* =========================================================
   ACADEMIC DATA
   ========================================================= */

async function loadAcademicSummary() {
  if (!supabaseClient || !state.user) {
    return null;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("student_academic_summary")
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

    state.academicSummary = null;

    return null;
  }

  state.academicSummary =
    data || null;

  return state.academicSummary;
}

async function loadScoreDetails() {
  if (!supabaseClient || !state.user) {
    return [];
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("student_score_details")
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
    );

  if (error) {
    console.error(
      "Score details error:",
      error
    );

    state.scoreDetails = [];

    return [];
  }

  state.scoreDetails =
    data || [];

  return state.scoreDetails;
}

async function loadChapters() {
  if (!supabaseClient) {
    return [];
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("chapters")
    .select("*")
    .order(
      "chapter_number",
      {
        ascending: true
      }
    );

  if (error) {
    console.error(
      "Chapter load error:",
      error
    );

    state.chapters = [];

    return [];
  }

  state.chapters =
    data || [];

  return state.chapters;
}

/* =========================================================
   FEED
   ========================================================= */

async function loadFeed() {
  if (!supabaseClient) {
    return [];
  }

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
    );

  if (error) {
    console.error(
      "Feed load error:",
      error
    );

    state.feedPosts = [];

    return [];
  }

  state.feedPosts =
    data || [];

  return state.feedPosts;
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
          const profile =
            post.profiles || {};

          const name =
            getNameFromProfile(
              profile
            );

          return `
            <article
              class="feed-post"
              data-post-id="${escapeHtml(
                post.id
              )}"
            >

              <div class="feed-post-header">

                <div class="avatar">
                  ${
                    profile.avatar_url
                      ? `
                        <img
                          src="${escapeHtml(
                            profile.avatar_url
                          )}"
                          alt=""
                        />
                      `
                      : escapeHtml(
                          getInitials(
                            name
                          )
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
                ${escapeHtml(
                  post.content
                )}
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
                  state.user?.id ===
                  post.user_id
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

            </article>
          `;
        })
        .join("")}

    </div>
  `;
}

function attachFeedEvents() {
  document
    .querySelectorAll(
      "[data-reaction]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await reactToPost(
            button.dataset.postId,
            button.dataset.reaction
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-comment-post]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openCommentDialog(
            button.dataset.commentPost
          );
        }
      );
    });

  document
    .querySelectorAll(
      "[data-edit-post]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          editPost(
            button.dataset.editPost
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
          deletePost(
            button.dataset.deletePost
          );
        }
      );
    });
}

async function reactToPost(
  postId,
  reaction
) {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

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
    console.error(
      "Reaction error:",
      error
    );

    return;
  }

  await loadFeed();

  const feed =
    $("#feed-content");

  if (feed) {
    feed.innerHTML =
      renderFeed();

    attachFeedEvents();
  }
}

async function openCreatePostDialog() {
  const content =
    prompt(
      "What would you like to post?"
    );

  if (
    !content ||
    !content.trim()
  ) {
    return;
  }

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .insert({
      user_id:
        state.user.id,
      content:
        content.trim()
    });

  if (error) {
    alert(
      error.message ||
        "Unable to create your post."
    );

    return;
  }

  await loadFeed();

  const feed =
    $("#feed-content");

  if (feed) {
    feed.innerHTML =
      renderFeed();

    attachFeedEvents();
  }
}

async function editPost(postId) {
  const post =
    state.feedPosts.find(
      (item) =>
        item.id === postId
    );

  if (!post) return;

  const updatedContent =
    prompt(
      "Edit your post:",
      post.content
    );

  if (
    updatedContent === null ||
    !updatedContent.trim()
  ) {
    return;
  }

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("feed_posts")
    .update({
      content:
        updatedContent.trim(),
      updated_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      postId
    )
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    alert(
      error.message ||
        "Unable to edit the post."
    );

    return;
  }

  await loadFeed();

  const feed =
    $("#feed-content");

  if (feed) {
    feed.innerHTML =
      renderFeed();

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

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
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
    alert(
      error.message ||
        "Unable to delete the post."
    );

    return;
  }

  await loadFeed();

  const feed =
    $("#feed-content");

  if (feed) {
    feed.innerHTML =
      renderFeed();

    attachFeedEvents();
  }
}

function openCommentDialog(postId) {
  const content =
    prompt(
      "Write a comment:"
    );

  if (
    !content ||
    !content.trim()
  ) {
    return;
  }

  createComment(
    postId,
    content.trim()
  );
}

async function createComment(
  postId,
  content
) {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("feed_comments")
    .insert({
      post_id: postId,
      user_id:
        state.user.id,
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
   PRESENCE
   ========================================================= */

async function loadActiveUsers() {
  if (!supabaseClient) {
    return [];
  }

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
    .order(
      "status",
      {
        ascending: true
      }
    )
    .order(
      "last_seen_at",
      {
        ascending: false
      }
    );

  if (error) {
    console.error(
      "Presence load error:",
      error
    );

    state.activeUsers = [];

    return [];
  }

  state.activeUsers =
    data || [];

  return state.activeUsers;
}

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
  } = await supabaseClient
    .from("user_presence")
    .upsert({
      user_id:
        state.user.id,
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
            getNameFromProfile(
              profile
            );

          const status =
            item.status ||
            "offline";

          return `
            <div class="active-user">

              <div class="presence-avatar-wrapper">

                <div class="avatar">
                  ${
                    profile.avatar_url
                      ? `
                        <img
                          src="${escapeHtml(
                            profile.avatar_url
                          )}"
                          alt=""
                        />
                      `
                      : escapeHtml(
                          getInitials(
                            name
                          )
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
   CALENDAR
   ========================================================= */

async function loadCalendarEvents() {
  if (
    !supabaseClient ||
    !state.user
  ) {
    return [];
  }

  let query =
    supabaseClient
      .from("calendar_events")
      .select("*")
      .order(
        "start_time",
        {
          ascending: true
        }
      );

  const {
    data,
    error
  } = await query;

  if (error) {
    console.error(
      "Calendar load error:",
      error
    );

    state.calendarEvents = [];

    return [];
  }

  state.calendarEvents =
    data || [];

  return state.calendarEvents;
}

function renderCalendar() {
  const date =
    state.calendarDate;

  const month =
    date.toLocaleDateString(
      undefined,
      {
        month: "long",
        year: "numeric"
      }
    );

  return `
    <section class="page">

      <div class="page-header">

        <div>
          <p class="eyebrow">
            STUDENTHUB
          </p>

          <h1>Calendar</h1>

          <p>
            Keep track of tests, class events,
            deadlines, and personal events.
          </p>
        </div>

        <button
          class="primary-button"
          id="add-calendar-event"
        >
          + Add Event
        </button>

      </div>

      <div class="panel">

        <div class="calendar-toolbar">

          <button
            class="secondary-button"
            id="calendar-prev"
          >
            ←
          </button>

          <h2>
            ${escapeHtml(month)}
          </h2>

          <button
            class="secondary-button"
            id="calendar-next"
          >
            →
          </button>

        </div>

        <div class="calendar-list">
          ${
            renderCalendarEvents()
          }
        </div>

      </div>

    </section>
  `;
}

function renderCalendarEvents() {
  if (!state.calendarEvents.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📅</div>

        <h3>No calendar events yet</h3>

        <p>
          Add an event to start building your class calendar.
        </p>
      </div>
    `;
  }

  return `
    <div class="score-list">

      ${state.calendarEvents
        .map((event) => {
          return `
            <div class="score-row">

              <div class="score-row-main">
                <strong>
                  ${escapeHtml(
                    event.title ||
                      "Calendar Event"
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    event.description ||
                      ""
                  )}
                </span>
              </div>

              <div class="score-row-date">
                ${formatDateTime(
                  event.start_time ||
                    event.event_date
                )}
              </div>

            </div>
          `;
        })
        .join("")}

    </div>
  `;
}

async function addCalendarEvent() {
  const title =
    prompt("Event title:");

  if (
    !title ||
    !title.trim()
  ) {
    return;
  }

  const date =
    prompt(
      "Event date/time (example: 2026-10-20 09:00):"
    );

  if (
    !date ||
    !date.trim()
  ) {
    return;
  }

  const description =
    prompt(
      "Description (optional):"
    ) || "";

  if (
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const payload = {
    title: title.trim(),
    description:
      description.trim(),
    start_time:
      new Date(date).toISOString(),
    user_id:
      state.user.id
  };

  const {
    error
  } = await supabaseClient
    .from("calendar_events")
    .insert(payload);

  if (error) {
    alert(
      error.message ||
        "Unable to create the calendar event."
    );

    return;
  }

  await loadCalendarEvents();

  await navigate("calendar");
}

/* =========================================================
   CARE TEAM
   ========================================================= */

async function loadCareMessages() {
  if (!supabaseClient) {
    return [];
  }

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
    .order(
      "created_at",
      {
        ascending: true
      }
    );

  if (error) {
    console.error(
      "Care Team message error:",
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
  if (!supabaseClient) {
    return [];
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("pinned_messages")
    .select("*");

  if (error) {
    console.error(
      "Pinned messages error:",
      error
    );

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
            CLASS COMMUNITY
          </p>

          <h1>The Care Team</h1>

          <p>
            Stay connected with your CNA classmates.
          </p>
        </div>

      </div>

      <div class="panel care-team-panel">

        <div class="care-team-messages">

          ${
            state.careMessages.length
              ? state.careMessages
                  .map(
                    renderCareMessage
                  )
                  .join("")
              : `
                <div class="empty-state">
                  <div class="empty-icon">
                    💬
                  </div>

                  <h3>No messages yet</h3>

                  <p>
                    Start the conversation.
                  </p>
                </div>
              `
          }

        </div>

        <form
          id="care-message-form"
          class="care-message-form"
        >

          <input
            id="care-message-input"
            class="text-input"
            type="text"
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

function renderCareMessage(message) {
  const profile =
    message.profiles || {};

  const name =
    getNameFromProfile(
      profile
    );

  const mine =
    message.user_id ===
    state.user?.id;

  return `
    <article
      class="feed-post"
      data-message-id="${escapeHtml(
        message.id
      )}"
    >

      <div class="feed-post-header">

        <div class="avatar">
          ${
            profile.avatar_url
              ? `
                <img
                  src="${escapeHtml(
                    profile.avatar_url
                  )}"
                  alt=""
                />
              `
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
              message.created_at
            )}
          </span>

        </div>

        ${
          mine
            ? `
              <button
                class="feed-action"
                data-edit-message="${escapeHtml(
                  message.id
                )}"
              >
                ✏️
              </button>

              <button
                class="feed-action danger-action"
                data-delete-message="${escapeHtml(
                  message.id
                )}"
              >
                🗑️
              </button>
            `
            : ""
        }

      </div>

      <div class="feed-post-content">
        ${escapeHtml(
          message.content ||
            message.message ||
            ""
        )}
      </div>

    </article>
  `;
}

async function sendCareMessage(event) {
  event.preventDefault();

  const input =
    $("#care-message-input");

  const content =
    input?.value.trim();

  if (
    !content ||
    !supabaseClient ||
    !state.user
  ) {
    return;
  }

  const {
    error
  } = await supabaseClient
    .from("messages")
    .insert({
      user_id:
        state.user.id,
      content
    });

  if (error) {
    alert(
      error.message ||
        "Unable to send your message."
    );

    return;
  }

  input.value = "";

  await loadCareMessages();

  const container =
    $("#page-container");

  if (container) {
    container.innerHTML =
      renderCareTeam();

    attachCareTeamEvents();
  }
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

  const updated =
    prompt(
      "Edit your message:",
      message.content ||
        message.message ||
        ""
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
        updated.trim(),
      updated_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      messageId
    )
    .eq(
      "user_id",
      state.user.id
    );

  if (error) {
    alert(
      error.message ||
        "Unable to edit the message."
    );

    return;
  }

  await loadCareMessages();

  const container =
    $("#page-container");

  if (container) {
    container.innerHTML =
      renderCareTeam();

    attachCareTeamEvents();
  }
}

async function deleteCareMessage(
  message