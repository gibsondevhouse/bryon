# Feature Specification: "Launch Ollama" Auto-Recovery

### 1. Feature Overview

* **Core Functionality:** The implementation of a self-healing UI mechanism that allows users to initialize the local Ollama daemon directly from the application's interface. A **Launch Ollama** action button will be integrated adjacent to the existing **Retry** button within the "Ollama unavailable" error banner.
* **Objective:** To eliminate context switching and reduce operational friction. By abstracting command-line interface (CLI) management, the application provides a seamless, one-click recovery path when the connection to `http://127.0.0.1:11434` fails.
* **Target Users:** End-users and developers interacting with the local-first application who rely on local LLM serving, streamlining the experience for those who prefer not to manually manage background daemons.

---

### 2. Implementation Plan

* **Technical Approach:** A full-stack integration requiring a frontend state update in Svelte 5 and a secure backend system execution route via SvelteKit. The backend must spawn an independent, detached process to ensure the host application's lifecycle does not interfere with the Ollama daemon.
* **Key Components:**
    * **Frontend (Svelte 5):**
        * Update the error banner component to include the primary **Launch Ollama** button.
        * Implement state management for the button (default, loading/spinner, disabled) to provide visual feedback during the launch process.
        * Automate the existing **Retry** logic to trigger immediately upon a successful response from the launch API.
    * **Backend (SvelteKit / Node.js):**
        * Utilize Node.js `child_process.spawn`.
        * Configure the spawn options with `detached: true` and `stdio: 'ignore'`.
        * Invoke `child.unref()` immediately after spawning so the parent SvelteKit process can terminate independently of the Ollama daemon.
* **API Requirements:**
    * **Route:** Create a new endpoint (e.g., `POST /api/system/launch-ollama`).
    * **Logic:** Execute the hardcoded shell command `ollama serve`.
    * **Response:** Implement a lightweight polling mechanism (e.g., attempting a TCP connection to port `11434` or fetching `/api/tags`) to verify the daemon is active before returning a `200 OK` status to the frontend.

---

### 3. Risk Mitigation

**Security**
* **Remote Code Execution (RCE) Prevention:** The API endpoint must accept *zero* payload parameters from the frontend request. The command `ollama serve` must be strictly hardcoded on the server to eliminate injection vectors.
* **Environment Restriction:** Ensure the endpoint includes middleware or checks to verify the request originates from `localhost` or `127.0.0.1`. It should immediately reject requests from external network IPs to prevent unauthorized users from executing system binaries if the application is exposed over a local network.

**Performance**
* **Concurrency & Idempotency:** Rapid, successive clicks on the frontend must not spawn multiple conflicting daemons. The backend must check if port `11434` is already in use (handling `EADDRINUSE` errors) or check the process list before initiating the `spawn` command.
* **Latency & Timeouts:** Polling the port to verify Ollama's availability must have a strict timeout (e.g., 5 to 10 seconds). If the daemon fails to start within this window, the API must return a `500 Internal Server Error` with a clear message to prevent the HTTP request from hanging indefinitely and blocking the server's event loop.

**Regressions**
* **Cross-Platform Pathing:** Hardcoding `ollama serve` relies on the binary existing in the global `PATH`. Testing must verify behavior across Windows, macOS, and Linux. If the application fails to find the command, it must gracefully degrade back to the standard **Retry** state without crashing the host app.
* **Lifecycle Testing:** Integration testing must confirm that shutting down the SvelteKit development server or production build does not result in zombie processes or abruptly kill the detached Ollama daemon. Unit tests should verify that the frontend correctly handles timeouts and resets the button state if the launch fails.