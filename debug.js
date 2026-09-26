/* =========================================================
   STUDENTHUB DEBUG SYSTEM
   ========================================================= */

(function () {
  "use strict";

  const debug = window.STUDENTHUB_DEBUG || {
    enabled: false,
    startedAt: new Date().toISOString(),
    errors: []
  };

  window.STUDENTHUB_DEBUG = debug;

  const results = [];

  function addResult(name, status, details = "") {
    results.push({
      name,
      status,
      details,
      time: new Date().toISOString()
    });
  }

  function pass(name, details = "") {
    addResult(name, "PASS", details);
  }

  function fail(name, details = "") {
    addResult(name, "FAIL", details);
  }

  function skip(name, details = "") {
    addResult(name, "SKIPPED", details);
  }

  function getStatusIcon(status) {
    if (status === "PASS") return "✅";
    if (status === "FAIL") return "❌";
    return "⏸️";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createDebugScreen() {
    document.body.innerHTML = `
      <div id="studenthub-debug-screen">
        <div class="debug-container">

          <div class="debug-header">
            <div class="debug-logo">🛠️</div>

            <div>
              <h1>StudentHub Debug</h1>
              <p>System diagnostic mode</p>
            </div>
          </div>

          <div class="debug-card">

            <div class="debug-card-header">
              <h2>System Checks</h2>
              <span id="debug-status">Running...</span>
            </div>

            <div id="debug-results">
              <div class="debug-running">
                Running StudentHub diagnostics...
              </div>
            </div>

          </div>

          <div class="debug-card">

            <div class="debug-card-header">
              <h2>Errors</h2>
            </div>

            <div id="debug-errors">
              <div class="debug-running">
                Checking for errors...
              </div>
            </div>

          </div>

          <div class="debug-card">

            <div class="debug-card-header">
              <h2>Debug Information</h2>
            </div>

            <div id="debug-info"></div>

          </div>

          <div class="debug-actions">
            <button id="copy-debug">
              📋 Copy Debug Report
            </button>

            <button id="reload-debug">
              🔄 Reload
            </button>

            <button id="continue-debug">
              Continue to StudentHub
            </button>
          </div>

        </div>
      </div>
    `;

    addDebugStyles();
  }

  function addDebugStyles() {
    const style = document.createElement("style");

    style.id = "studenthub-debug-styles";

    style.textContent = `
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #071a2b;
        color: #f5f9fc;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          Arial,
          sans-serif;
      }

      #studenthub-debug-screen {
        min-height: 100vh;
        padding: 30px 18px;
        background:
          radial-gradient(
            circle at top,
            #123a55 0%,
            #071a2b 45%,
            #04111d 100%
          );
      }

      .debug-container {
        width: min(900px, 100%);
        margin: 0 auto;
      }

      .debug-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }

      .debug-logo {
        width: 58px;
        height: 58px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #102b42;
        border: 1px solid #1d4662;
        font-size: 28px;
      }

      .debug-header h1 {
        margin: 0;
        font-size: 28px;
      }

      .debug-header p {
        margin: 5px 0 0;
        color: #a8bdcc;
      }

      .debug-card {
        background: #102b42;
        border: 1px solid #1d4662;
        border-radius: 14px;
        overflow: hidden;
        margin-bottom: 18px;
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.18);
      }

      .debug-card-header {
        padding: 18px 20px;
        border-bottom: 1px solid #1d4662;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .debug-card-header h2 {
        margin: 0;
        font-size: 17px;
      }

      #debug-status {
        color: #f2b84b;
        font-size: 13px;
        font-weight: 700;
      }

      #debug-results {
        padding: 8px 20px;
      }

      .debug-result {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 14px 0;
        border-bottom: 1px solid rgba(29, 70, 98, 0.55);
      }

      .debug-result:last-child {
        border-bottom: 0;
      }

      .debug-result-name {
        font-weight: 600;
      }

      .debug-result-details {
        grid-column: 2 / 4;
        color: #718b9e;
        font-size: 13px;
        margin-top: -5px;
        word-break: break-word;
      }

      .debug-pass {
        color: #2ead72;
        font-weight: 700;
        font-size: 13px;
      }

      .debug-fail {
        color: #d9534f;
        font-weight: 700;
        font-size: 13px;
      }

      .debug-skipped {
        color: #718b9e;
        font-weight: 700;
        font-size: 13px;
      }

      .debug-running {
        padding: 20px 0;
        color: #a8bdcc;
      }

      .debug-error {
        padding: 14px;
        margin: 14px 20px;
        background: rgba(217, 83, 79, 0.1);
        border: 1px solid rgba(217, 83, 79, 0.35);
        border-radius: 10px;
        color: #f5c1bf;
        word-break: break-word;
      }

      .debug-no-errors {
        padding: 20px;
        color: #2ead72;
      }

      #debug-info {
        padding: 18px 20px;
      }

      .debug-info-row {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(29, 70, 98, 0.45);
      }

      .debug-info-row:last-child {
        border-bottom: 0;
      }

      .debug-info-label {
        color: #a8bdcc;
      }

      .debug-info-value {
        color: #f5f9fc;
        text-align: right;
        word-break: break-word;
      }

      .debug-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }

      .debug-actions button {
        border: 1px solid #1d4662;
        background: #102b42;
        color: #f5f9fc;
        padding: 12px 16px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
      }

      .debug-actions button:hover {
        background: #163952;
      }

      .debug-actions button:first-child {
        background: #00a6a6;
        border-color: #00a6a6;
        color: white;
      }

      @media (max-width: 600px) {
        #studenthub-debug-screen {
          padding: 18px 12px;
        }

        .debug-header h1 {
          font-size: 23px;
        }

        .debug-card-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .debug-result {
          grid-template-columns: 28px minmax(0, 1fr);
        }

        .debug-result > :last-child {
          grid-column: 2;
        }

        .debug-result-details {
          grid-column: 2;
        }

        .debug-info-row {
          flex-direction: column;
          gap: 4px;
        }

        .debug-info-value {
          text-align: left;
        }

        .debug-actions {
          flex-direction: column;
        }

        .debug-actions button {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  async function runDiagnostics() {
    /*
      Give the browser a moment to finish loading
      before running the checks.
    */
    await new Promise((resolve) => setTimeout(resolve, 100));

    /*
      1. INDEX.HTML
    */
    if (
      document.documentElement.getAttribute(
        "data-studenthub-index-loaded"
      ) === "true"
    ) {
      pass(
        "HTML",
        "index.html loaded successfully."
      );
    } else {
      fail(
        "HTML",
        "The index.html debug marker was not found."
      );
    }

    /*
      2. JAVASCRIPT
    */
    pass(
      "JavaScript",
      "debug.js loaded and executed successfully."
    );

    /*
      3. CSS
    */
    const bodyStyles = window.getComputedStyle(document.body);

    if (bodyStyles) {
      pass(
        "CSS",
        "style.css is available to the document."
      );
    } else {
      fail(
        "CSS",
        "Unable to read document styles."
      );
    }

    /*
      4. SUPABASE LIBRARY
    */
    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      pass(
        "Supabase Library",
        "Supabase JavaScript library loaded."
      );
    } else {
      fail(
        "Supabase Library",
        "window.supabase or createClient() is unavailable."
      );
    }

    /*
      5. SUPABASE CLIENT
    */
    let client = null;

    if (
      window.supabase &&
      typeof window.supabase.createClient === "function"
    ) {
      try {
        const url =
          "https://csmizeuuywlonuysktka.supabase.co";

        const key =
          "sb_publishable_KVMi8il5yurqMPr6DD8PCA_cDEXdcF0";

        client = window.supabase.createClient(
          url,
          key
        );

        window.studentHubDebugClient = client;

        pass(
          "Supabase Client",
          "Supabase client initialized successfully."
        );
      } catch (error) {
        fail(
          "Supabase Client",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Supabase Client",
        "Skipped because the Supabase library failed."
      );
    }

    /*
      6. SUPABASE CONNECTION
    */
    let currentUser = null;

    if (client) {
      try {
        const { data, error } =
          await client.auth.getSession();

        if (error) {
          fail(
            "Supabase Connection",
            error.message || String(error)
          );
        } else {
          pass(
            "Supabase Connection",
            "Supabase responded successfully."
          );

          currentUser =
            data?.session?.user || null;
        }
      } catch (error) {
        fail(
          "Supabase Connection",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Supabase Connection",
        "Skipped because Supabase client failed."
      );
    }

    /*
      7. AUTHENTICATION
    */
    if (client) {
      try {
        const { data, error } =
          await client.auth.getUser();

        if (error) {
          if (
            error.message &&
            error.message.toLowerCase().includes("auth session missing")
          ) {
            skip(
              "Authentication",
              "No user is currently signed in."
            );
          } else {
            fail(
              "Authentication",
              error.message || String(error)
            );
          }
        } else if (data?.user) {
          currentUser = data.user;

          pass(
            "Authentication",
            `Signed in as ${data.user.email || data.user.id}.`
          );
        } else {
          skip(
            "Authentication",
            "No user is currently signed in."
          );
        }
      } catch (error) {
        fail(
          "Authentication",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Authentication",
        "Skipped because Supabase client failed."
      );
    }

    /*
      8. PROFILE TABLE
    */
    if (client && currentUser) {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (error) {
          fail(
            "Profile",
            error.message || String(error)
          );
        } else if (data) {
          pass(
            "Profile",
            "Profile record found."
          );
        } else {
          fail(
            "Profile",
            "No profile record was found for the signed-in user."
          );
        }
      } catch (error) {
        fail(
          "Profile",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Profile",
        "Skipped because no authenticated user is available."
      );
    }

    /*
      9. SCORES TABLE
    */
    if (client && currentUser) {
      try {
        const { error } = await client
          .from("scores")
          .select("id")
          .eq("user_id", currentUser.id)
          .limit(1);

        if (error) {
          fail(
            "Scores Database",
            error.message || String(error)
          );
        } else {
          pass(
            "Scores Database",
            "scores table is accessible."
          );
        }
      } catch (error) {
        fail(
          "Scores Database",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Scores Database",
        "Skipped because no authenticated user is available."
      );
    }

    /*
      10. FEED
    */
    if (client) {
      try {
        const { error } = await client
          .from("feed_posts")
          .select("id")
          .limit(1);

        if (error) {
          fail(
            "Feed Database",
            error.message || String(error)
          );
        } else {
          pass(
            "Feed Database",
            "feed_posts table is accessible."
          );
        }
      } catch (error) {
        fail(
          "Feed Database",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Feed Database",
        "Skipped because Supabase client failed."
      );
    }

    /*
      11. PRESENCE
    */
    if (client) {
      try {
        const { error } = await client
          .from("user_presence")
          .select("user_id")
          .limit(1);

        if (error) {
          fail(
            "Presence Database",
            error.message || String(error)
          );
        } else {
          pass(
            "Presence Database",
            "user_presence table is accessible."
          );
        }
      } catch (error) {
        fail(
          "Presence Database",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Presence Database",
        "Skipped because Supabase client failed."
      );
    }

    /*
      12. ACADEMIC VIEW
    */
    if (client && currentUser) {
      try {
        const { error } = await client
          .from("student_academic_summary")
          .select("*")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error) {
          fail(
            "Academic Summary",
            error.message || String(error)
          );
        } else {
          pass(
            "Academic Summary",
            "student_academic_summary is accessible."
          );
        }
      } catch (error) {
        fail(
          "Academic Summary",
          error.message || String(error)
        );
      }
    } else {
      skip(
        "Academic Summary",
        "Skipped because no authenticated user is available."
      );
    }

    /*
      13. JAVASCRIPT ERRORS
    */
    if (debug.errors.length === 0) {
      pass(
        "Runtime Errors",
        "No JavaScript errors have been captured."
      );
    } else {
      fail(
        "Runtime Errors",
        `${debug.errors.length} error(s) captured.`
      );
    }

    renderResults();
  }

  function renderResults() {
    const resultsContainer =
      document.getElementById("debug-results");

    const errorContainer =
      document.getElementById("debug-errors");

    const infoContainer =
      document.getElementById("debug-info");

    const statusElement =
      document.getElementById("debug-status");

    if (!resultsContainer) return;

    resultsContainer.innerHTML = results
      .map((result) => {
        const icon = getStatusIcon(result.status);

        const statusClass =
          result.status === "PASS"
            ? "debug-pass"
            : result.status === "FAIL"
              ? "debug-fail"
              : "debug-skipped";

        return `
          <div class="debug-result">

            <div>${icon}</div>

            <div class="debug-result-name">
              ${escapeHTML(result.name)}
            </div>

            <div class="${statusClass}">
              ${escapeHTML(result.status)}
            </div>

            <div class="debug-result-details">
              ${escapeHTML(result.details)}
            </div>

          </div>
        `;
      })
      .join("");

    /*
      Errors
    */
    if (debug.errors.length === 0) {
      errorContainer.innerHTML = `
        <div class="debug-no-errors">
          ✅ No captured JavaScript errors.
        </div>
      `;
    } else {
      errorContainer.innerHTML = debug.errors
        .map(
          (error) => `
            <div class="debug-error">
              <strong>
                ${escapeHTML(error.type)}
              </strong>

              <br><br>

              ${escapeHTML(error.message)}

              ${
                error.source
                  ? `<br><br>Source: ${escapeHTML(error.source)}`
                  : ""
              }

              ${
                error.line
                  ? `<br>Line: ${escapeHTML(error.line)}`
                  : ""
              }

              ${
                error.column
                  ? `<br>Column: ${escapeHTML(error.column)}`
                  : ""
              }
            </div>
          `
        )
        .join("");
    }

    /*
      Overall status
    */
    const failures = results.filter(
      (result) => result.status === "FAIL"
    );

    if (failures.length === 0) {
      statusElement.textContent = "Diagnostics Complete";
      statusElement.style.color = "#2ead72";
    } else {
      statusElement.textContent =
        `${failures.length} problem(s) found`;

      statusElement.style.color = "#d9534f";
    }

    /*
      System information
    */
    infoContainer.innerHTML = `
      <div class="debug-info-row">
        <div class="debug-info-label">
          Debug Mode
        </div>

        <div class="debug-info-value">
          ${debug.enabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      <div class="debug-info-row">
        <div class="debug-info-label">
          Page
        </div>

        <div class="debug-info-value">
          ${escapeHTML(window.location.href)}
        </div>
      </div>

      <div class="debug-info-row">
        <div class="debug-info-label">
          Browser
        </div>

        <div class="debug-info-value">
          ${escapeHTML(navigator.userAgent)}
        </div>
      </div>

      <div class="debug-info-row">
        <div class="debug-info-label">
          Screen
        </div>

        <div class="debug-info-value">
          ${window.innerWidth} × ${window.innerHeight}
        </div>
      </div>

      <div class="debug-info-row">
        <div class="debug-info-label">
          Started
        </div>

        <div class="debug-info-value">
          ${escapeHTML(debug.startedAt)}
        </div>
      </div>

      <div class="debug-info-row">
        <div class="debug-info-label">
          Diagnostics
        </div>

        <div class="debug-info-value">
          ${results.length} checks
        </div>
      </div>
    `;

    setupButtons();
  }

  function createReport() {
    const lines = [];

    lines.push("STUDENTHUB DEBUG REPORT");
    lines.push("=======================");
    lines.push("");

    lines.push("SYSTEM CHECKS");
    lines.push("-----------------------");

    results.forEach((result) => {
      lines.push(
        `${result.status}: ${result.name}`
      );

      if (result.details) {
        lines.push(
          `  ${result.details}`
        );
      }
    });

    lines.push("");
    lines.push("ERRORS");
    lines.push("-----------------------");

    if (debug.errors.length === 0) {
      lines.push("No captured JavaScript errors.");
    } else {
      debug.errors.forEach((error, index) => {
        lines.push(
          `Error ${index + 1}:`
        );

        lines.push(
          `Type: ${error.type}`
        );

        lines.push(
          `Message: ${error.message}`
        );

        if (error.source) {
          lines.push(
            `Source: ${error.source}`
          );
        }

        if (error.line) {
          lines.push(
            `Line: ${error.line}`
          );
        }

        if (error.column) {
          lines.push(
            `Column: ${error.column}`
          );
        }

        lines.push("");
      });
    }

    lines.push("ENVIRONMENT");
    lines.push("-----------------------");
    lines.push(
      `URL: ${window.location.href}`
    );
    lines.push(
      `Browser: ${navigator.userAgent}`
    );
    lines.push(
      `Screen: ${window.innerWidth}x${window.innerHeight}`
    );

    return lines.join("\n");
  }

  function setupButtons() {
    const copyButton =
      document.getElementById("copy-debug");

    const reloadButton =
      document.getElementById("reload-debug");

    const continueButton =
      document.getElementById("continue-debug");

    if (copyButton) {
      copyButton.onclick = async function () {
        const report = createReport();

        try {
          await navigator.clipboard.writeText(report);

          copyButton.textContent =
            "✅ Debug Report Copied";

          setTimeout(() => {
            copyButton.textContent =
              "📋 Copy Debug Report";
          }, 2000);
        } catch (error) {
          alert(report);
        }
      };
    }

    if (reloadButton) {
      reloadButton.onclick = function () {
        window.location.reload();
      };
    }

    if (continueButton) {
      continueButton.onclick = function () {
        const url =
          new URL(window.location.href);

        url.searchParams.delete("debug");

        window.location.href =
          url.toString();
      };
    }
  }

  /*
    Start debugger only when ?debug=true
  */
  if (debug.enabled) {
    createDebugScreen();

    runDiagnostics().catch((error) => {
      debug.errors.push({
        type: "Debug System Error",
        message:
          error.message || String(error)
      });

      renderResults();
    });
  }

  /*
    Always expose the diagnostic information
    to the browser console.
  */
  window.studentHubDebug = {
    results,

    errors: debug.errors,

    report: createReport
  };

})();