/**
 * Sherlocked Attendance Tablet Server
 *
 * Serves a tablet-facing HTML page that displays the rotating 6-digit
 * WiFi token for employees to enter when clocking in/out.
 *
 * The token rotates every 5 minutes and is derived from HMAC-SHA256
 * of the branch_id + current 5-minute window. This allows the main
 * API to validate tokens without storing them.
 *
 * Route: GET / → HTML tablet display
 * Route: GET /token → JSON { token, expires_in_ms }
 */

import 'dotenv/config'
import express from 'express'
import crypto from 'crypto'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3002')

const BRANCH_ID = process.env.BRANCH_ID ?? 'default'
const WIFI_TOKEN_SECRET = process.env.WIFI_TOKEN_SECRET ?? ''

function getCurrentToken(): { token: string; expiresInMs: number } {
  const windowMs = 5 * 60 * 1000
  const window = Math.floor(Date.now() / windowMs)
  const expiresInMs = windowMs - (Date.now() % windowMs)

  const hmac = crypto.createHmac('sha256', WIFI_TOKEN_SECRET)
  hmac.update(`${BRANCH_ID}:${window}`)
  const hash = hmac.digest('hex')
  const token = (parseInt(hash.slice(0, 8), 16) % 900000 + 100000).toString()

  return { token, expiresInMs }
}

// JSON endpoint
app.get('/token', (req, res) => {
  const { token, expiresInMs } = getCurrentToken()
  res.json({ token, expires_in_ms: expiresInMs, branch_id: BRANCH_ID })
})

// Tablet HTML display
app.get('/', (req, res) => {
  const { token, expiresInMs } = getCurrentToken()

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="${Math.ceil(expiresInMs / 1000)}">
  <title>קוד כניסה — Sherlocked</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;700;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Heebo', sans-serif;
      background: #0F1117;
      color: #E8EAFF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      user-select: none;
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: #00C4AA;
      color: #0F1117;
      font-size: 28px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #E8EAFF;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 15px;
      color: #8B8FA8;
      margin-bottom: 48px;
    }
    .token-card {
      background: #1A1D27;
      border: 1px solid #2E3150;
      border-radius: 20px;
      padding: 48px 64px;
      margin-bottom: 32px;
    }
    .token-label {
      font-size: 13px;
      color: #555870;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 16px;
    }
    .token {
      font-size: 80px;
      font-weight: 900;
      letter-spacing: 0.15em;
      color: #00C4AA;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .countdown {
      margin-top: 16px;
      font-size: 14px;
      color: #555870;
    }
    .countdown span {
      color: #F59E0B;
      font-weight: 700;
    }
    .instructions {
      font-size: 15px;
      color: #8B8FA8;
      max-width: 400px;
    }
    .instructions strong {
      color: #E8EAFF;
    }
    .footer {
      position: fixed;
      bottom: 24px;
      font-size: 12px;
      color: #1E2035;
    }
  </style>
</head>
<body>
  <div class="logo">S</div>
  <h1>קוד כניסה למשמרת</h1>
  <p class="subtitle">Sherlocked האוס — מערכת נוכחות</p>

  <div class="token-card">
    <div class="token-label">הקוד הנוכחי</div>
    <div class="token" id="token">${token.split('').join(' ')}</div>
    <div class="countdown">
      מתחלף בעוד <span id="countdown">...</span>
    </div>
  </div>

  <p class="instructions">
    הכנס את הקוד הזה במכשיר שלך ב<strong>מסך דיווח נוכחות</strong><br>
    הקוד בתוקף רק כשאתה <strong>בתוך המתחם</strong>
  </p>

  <div class="footer">Sherlocked ERP Attendance System</div>

  <script>
    let expiresInMs = ${expiresInMs};
    const countdownEl = document.getElementById('countdown');

    function update() {
      const secs = Math.ceil(expiresInMs / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      countdownEl.textContent = m + ':' + String(s).padStart(2, '0');
      expiresInMs -= 1000;
      if (expiresInMs <= 0) {
        fetch('/token').then(r => r.json()).then(d => {
          document.getElementById('token').textContent = d.token.split('').join(' ');
          expiresInMs = d.expires_in_ms;
        });
      }
    }

    setInterval(update, 1000);
    update();
  </script>
</body>
</html>`)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Attendance Tablet] Listening on port ${PORT}`)
  console.log(`[Attendance Tablet] Branch ID: ${BRANCH_ID}`)
})
