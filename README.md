# Nexus Attendance

> A cinematic, GPS-powered academic attendance system built with React Native / Expo and Supabase — featuring a deep-space glassmorphic UI, real-time geofencing, biometric authentication, and a full gamification economy.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Features](#features)
  - [Cinematic Preloader](#cinematic-preloader)
  - [Authentication](#authentication)
  - [Student Experience — Orbit View](#student-experience--orbit-view)
  - [Instructor Experience — Command Center](#instructor-experience--command-center)
  - [Phase 2 — Social & Smart Features](#phase-2--social--smart-features)
  - [Phase 3 — AR, Voice & Advanced](#phase-3--ar-voice--advanced)
  - [Legal & Support Infrastructure](#legal--support-infrastructure)
- [Design System](#design-system)
- [Component Library](#component-library)
- [Screens](#screens)
- [Hooks](#hooks)
- [Services](#services)
- [Database Schema](#database-schema)
- [Environment Setup](#environment-setup)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Overview

Nexus Attendance replaces traditional paper-based or manual attendance with a GPS-geofenced, biometric-verified system. Students check in by physically entering a classroom geofence; instructors monitor attendance in real time with live maps, proxy-detection alerts, and analytics dashboards.

The UI is built on a "deep space navy glassmorphic" design language — every screen uses the Nexus design token system, animated components, and haptic feedback to create a premium, fintech-grade experience.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Animations | React Native Animated API + Expo Haptics |
| Testing | Jest + fast-check (property-based testing) |
| Language | TypeScript |

---

## Architecture

```
geoapp/
├── app/                    # Expo Router screens (file = route)
│   ├── (tabs)/             # Bottom-tab screens
│   │   ├── index.tsx       # Home tab → HomeScreen
│   │   ├── attendance.tsx  # Radar tab → AttendanceScreen
│   │   ├── analytics.tsx   # Analytics tab → AnalyticsScreen
│   │   ├── profile.tsx     # Profile tab
│   │   └── achievements.tsx# Achievement Gallery
│   ├── login.tsx           # Login route → LoginScreen
│   ├── register.tsx        # Registration screen
│   ├── student-privacy.tsx # Student Privacy & Security
│   ├── student-help.tsx    # Student Help & Support
│   ├── student-terms.tsx   # Student Terms & Privacy
│   ├── instructor-privacy.tsx
│   ├── instructor-help.tsx
│   └── instructor-terms.tsx
├── components/
│   ├── nexus/              # Nexus component library (16 components)
│   ├── OrbitalPreloader.tsx# 4-phase cinematic boot sequence
│   ├── NexusLoader.tsx     # In-screen loading spinner
│   ├── MagneticButton.tsx  # Physics-based interactive button
│   └── StardustTrail.tsx   # Touch particle trail
├── constants/
│   └── theme.ts            # Design tokens (NexusColors, NexusFonts, etc.)
├── hooks/
│   └── nexus/              # Placeholder hooks for future integrations
├── screens/                # Screen components (role-branched)
│   ├── HomeScreen.tsx      # Student Orbit View + Instructor Command Center
│   ├── AttendanceScreen.tsx# Student Geospatial Hub + Instructor Geofence Mgmt
│   ├── AnalyticsScreen.tsx # Student Intelligence + Department Intelligence
│   ├── LoginScreen.tsx
│   └── InstructorDashboard.tsx
├── services/               # Business logic (never modified by UI layer)
│   ├── AuthService.ts
│   ├── GeofenceService.ts
│   ├── AttendanceService.ts
│   └── ReportService.ts
└── lib/
    └── supabase.ts         # Supabase client
```

Role branching happens inside each screen component — the same file renders a completely different UI depending on `profile.role === 'instructor'`.

---

## Features

### Cinematic Preloader

`OrbitalPreloader` plays on every cold launch before any navigation occurs.

| Phase | Duration | Visual |
|---|---|---|
| 1 — Boot | 0–2.5s | Wireframe hexagon blooms from center, typewriter "INITIALIZING NEXUS..." |
| 2 — GPS Lock | 2.5–4s | Radar pulse rings, orbiting satellite dot, "ESTABLISHING SECURE UPLINK..." |
| 3 — Biometric | 4–5s | Biometric hand glyph, neural crosshair lines, lock materializes |
| 4 — Ready | 5–5.8s | 16-particle burst, logo reveal, fades to app |

Tap anywhere to skip. Haptic feedback at each phase transition.

---

### Authentication

- Email/password sign-in via Supabase Auth
- Biometric authentication (Face ID / Touch ID) via `expo-local-authentication`
- Secure session storage via `expo-secure-store`
- Role-based access: `student` or `instructor` (set at registration)
- Auto-redirect: authenticated users skip login on cold launch

**Login screen features:** Nexus deep-space UI, `MagneticButton` with spring physics, `StardustTrail` particle effect on touch, biometric fingerprint button, "Remember me" checkbox.

**Register screen features:** Full name, email, password, role selector (Student / Instructor), optional Student ID field, success state with emerald glow ring.

---

### Student Experience — Orbit View

Four tabs, all using the Nexus glassmorphic design language.

#### Home Tab
- **NexusStatusBar** — GPS pulse (cyan/amber/rose), NTP sync, battery mode
- **StreakFlame** — consecutive-day attendance streak with amber flame animation
- **Next Class card** — upcoming session name, course code, time, LIVE badge
- **Geofence Proximity indicator** — polls `GeofenceService.getCurrentLocation()` every 5s, colors rose/amber/emerald by zone
- **Mark Attendance button** — enabled only when `inside && accuracyOk && sessionActive`
- **Today's Attendance** — horizontal scroll of `HolographicAttendanceCard` records
- **TimeWarp Prediction** — smart departure advice based on distance + walking pace
- **Campus Pulse** — live campus check-in count, energy level, hotspot heatmap
- **Nexus Coins Wallet** — NXS balance, recent earnings, spend categories
- **Ghost Mode toggle** — hides precise location from peers

#### Radar Tab (Geospatial Hub)
- Full-screen `GeofenceRadar` — animated radar canvas, pulsing student dot, cyan geofence circle, building markers
- Glass card overlay — room, floor, WiFi/GPS/BLE signal bars, checked-in count
- Distance progress bar to geofence boundary
- `AttendanceButton` — idle → ready → loading → confirmed state machine with haptic success
- Error messages from `ERRORS` map on failed check-in
- Phase 3 toolbar: AR Find, Echo, Chronos, Network

#### Analytics Tab (Student Intelligence)
- Semester trend line chart (`StatChart type="line"`)
- Per-subject attendance bar chart (`StatChart type="bar"`)
- Achievements card — Perfect Week, Early Bird, Marathoner, On Target badges
- Export Report button

#### Profile Tab (Security & Settings)
- Large avatar with emerald verification ring (biometric active)
- Security status grid — Biometric Linked, Device Trusted, 2FA, Backup Codes
- Geofence history timeline from `attendance_logs`
- Settings: Edit Profile, Achievement Gallery, Appearance, Privacy & Security, Help & Support, Terms & Privacy
- Sign Out → `AuthService.signOut()`

---

### Instructor Experience — Command Center

Same four tabs, completely different content.

#### Home Tab (Command Center)
- **NexusStatusBar**
- **Class selector** — horizontal chip row to switch between classes
- **Live Attendance Monitor** — `CircularProgress` ring, checked-in count/total, percentage badge
- **LiveMap** — blue dots (checked-in) / red dots (absent), updated via Supabase Realtime on `attendance_logs`
- **Quick Actions** — Extend Time (amber), Close Session (rose), Send Alert (indigo), View Details (cyan)
- Phase 3 toolbar: Echo, Chronos, Network

#### Radar Tab (Geofence Management)
- Student status list — checked-in + timestamp, pending, absent, proxy risk
- `ProxyAlert` cards — anomaly warnings with Investigate / Dismiss actions
- Geofence map card — concentric circles, crosshair, coordinate label

#### Analytics Tab (Department Intelligence)
- Multi-class comparison bar chart
- AI Forecast card — trend direction + percentage change per class
- Student Risk Matrix — students below 70% attendance
- Configure Automated Reports button

#### Profile Tab (Administration)
- Instructor name, email, indigo role badge
- Administration Overview — class count + total enrolled students
- My Classes list with per-class enrollment counts
- Settings: Edit Profile, Appearance, Privacy & Security, Help & Support, Terms & Privacy
- Sign Out

---

### Phase 2 — Social & Smart Features

| Component | Description |
|---|---|
| `CampusPulse` | Live campus check-in count, energy level (Electric/Buzzing/Active/Quiet), hotspot heatmap, share button |
| `TimeWarpCard` | Smart departure prediction — "Leave in X min" based on distance + walking pace. Auto-checkin prompt when inside geofence |
| `NexusCoinsWallet` | NXS token balance computed from streak × 10 + rate bonuses. Earnings list, spend categories (library, coffee, book loans) |
| `GhostModeToggle` | Spring-animated toggle. When on: student appears as "Present" only, no map pin |

---

### Phase 3 — AR, Voice & Advanced

| Component | Description |
|---|---|
| `ARClassroomFinder` | Full-screen modal with camera viewfinder, scanning line, directional arrows, portal preview card when within 5m. ARKit/ARCore ready |
| `EchoVoice` | Voice command bottom sheet — 20-bar waveform, mic button, command routing ("mark attendance" → Radar, "analytics" → Analytics), suggestion chips |
| `ChronosReplay` | Session replay — bar chart animates frame-by-frame, scrubber with glowing thumb, play/pause/skip controls, event log |
| `NexusNetwork` | Offline queue status, sync progress bar, QR backup code (17×17 finder pattern) for GPS-fail fallback |
| `AchievementGallery` | 16 badges across 4 categories (attendance, streak, social, special), rarity system (common/rare/epic/legendary), NXS rewards, animated reveals |

---

### Legal & Support Infrastructure

Six dedicated screens, role-specific content.

#### Student Screens
- **Privacy & Security** — animated security score ring, 4 spring-animated privacy toggles, data storage segments, activity timeline, Privacy Champion badge
- **Help & Support** — search + trending chips, quick-fix cards, 2×2 support channels, 3-step troubleshooter wizard, accordion learning center, emergency bar
- **Terms & Privacy** — ELI10 toggle (ultra-simple language mode), TL;DR card, policy explorer, data journey timeline, accordion legal docs

#### Instructor Screens
- **Data Stewardship** — enterprise dashboard with FERPA/GDPR/SOC 2 badges, access scope rings, audit trail table, pending privacy action cards, classroom security toggles, retention timeline
- **Instructor Support Center** — 3-tier escalation visualizer, admin task grid, certification progress, risk-labeled admin tools, institutional contacts, knowledge base
- **Legal & Compliance** — contract health score, obligation matrix (University/Nexus/You), liability protection cards, accordion governing documents, policy alignment checker, amendment history

---

## Design System

All design tokens are exported from `geoapp/constants/theme.ts`.

### NexusColors

```typescript
bgPrimary:    '#0B1120'              // Deep space navy — root background
bgCard:       'rgba(30,41,59,0.6)'  // Glassmorphic card base
bgCardSolid:  '#1E293B'             // Solid fallback
accentCyan:   '#06B6D4'             // Primary CTA, GPS active, student accent
accentAmber:  '#F59E0B'             // Warning, outside zone, NXS coins
accentEmerald:'#10B981'             // Success, confirmed, instructor verified
accentRose:   '#F43F5E'             // Error, absent, alert
accentIndigo: '#6366F1'             // Instructor accent, secondary
textPrimary:  '#F8FAFC'
textSecondary:'#94A3B8'
textDisabled: '#475569'
gpsActive:    '#06B6D4'
gpsSearching: '#F59E0B'
gpsDisabled:  '#F43F5E'
```

### NexusFonts

Inter typeface, sizes xs(10) through 4xl(36), weights regular(400) through black(900), letter-spacing tight through widest.

### NexusSpacing

`xs=4, sm=8, md=12, lg=16, xl=20, 2xl=24, 3xl=32`

### NexusRadius

`sm=8, md=12, lg=16, xl=20, 2xl=24, full=9999`

---

## Component Library

All components live in `geoapp/components/nexus/` and are exported from `index.ts`.

| Component | Props | Description |
|---|---|---|
| `GlassmorphicCard` | `children, style?, glowColor?` | Translucent card with blur effect and glass border |
| `NexusStatusBar` | `gpsState, ntpSynced` | GPS pulse, NTP sync, battery mode indicators |
| `NexusTabBar` | (tab bar renderer) | Glassmorphic bottom nav, cyan glow on active tab |
| `StreakFlame` | `streakDays` | Amber flame animation with streak count |
| `AttendanceButton` | `onPress, disabled, loading, confirmed` | idle → ready → loading → confirmed state machine |
| `GeofenceRadar` | `studentCoords, geofenceCenter, geofenceRadius, sessionActive` | Animated radar canvas |
| `LiveMap` | `students[]` | Blue/red dots for checked-in/absent students |
| `StatChart` | `type, data, title` | Line or bar chart using Nexus color tokens |
| `ProxyAlert` | `studentName, reason, onInvestigate, onDismiss` | Amber-glow proxy warning card |
| `HolographicAttendanceCard` | `log` | Holographic attendance record card |
| `CampusPulse` | `streakDays` | Live campus energy widget |
| `TimeWarpCard` | `nextSession, isInsideGeofence, sessionActive, onMarkAttendance?` | Smart departure prediction |
| `NexusCoinsWallet` | `streakDays, attendanceRate` | NXS token balance display |
| `GhostModeToggle` | `enabled, onToggle` | Privacy mode spring-animated toggle |
| `ARClassroomFinder` | `destination, distanceMetres?, visible, onClose` | AR modal with scanning line + arrows |
| `EchoVoice` | `visible, onClose, onMarkAttendance?, onNavigateRadar?, onNavigateAnalytics?` | Voice command bottom sheet |
| `ChronosReplay` | `visible, onClose, sessionName?, events?, role?` | Session replay with scrubber |
| `NexusNetwork` | `visible, onClose, studentId?, studentName?, isOnline?` | Offline queue + QR backup |

### Shared Components

| Component | Description |
|---|---|
| `OrbitalPreloader` | 4-phase cinematic boot sequence |
| `NexusLoader` | Lightweight in-screen spinner (replaces FuturisticLoader) |
| `MagneticButton` | Spring lean toward touch, ripple, glow halo, success morph |
| `StardustTrail` | Touch particle trail (used on login/register) |
| `CircularProgress` | Animated circular progress ring |

---

## Screens

| File | Route | Role | Description |
|---|---|---|---|
| `screens/LoginScreen.tsx` | `/login` | Both | Sign in with email/password or biometric |
| `app/register.tsx` | `/register` | Both | Create account with role selection |
| `screens/HomeScreen.tsx` | `/(tabs)/` | Student | Orbit View — streak, next class, geofence, quick actions |
| `screens/HomeScreen.tsx` | `/(tabs)/` | Instructor | Command Center — live attendance, LiveMap, quick actions |
| `screens/AttendanceScreen.tsx` | `/(tabs)/attendance` | Student | Geospatial Hub — full-screen radar, check-in |
| `screens/AttendanceScreen.tsx` | `/(tabs)/attendance` | Instructor | Geofence Management — student list, proxy alerts |
| `screens/AnalyticsScreen.tsx` | `/(tabs)/analytics` | Student | Student Intelligence — charts, badges, export |
| `screens/AnalyticsScreen.tsx` | `/(tabs)/analytics` | Instructor | Department Intelligence — multi-class charts, risk matrix |
| `app/(tabs)/profile.tsx` | `/(tabs)/profile` | Both | Profile, settings, sign out |
| `app/(tabs)/achievements.tsx` | `/(tabs)/achievements` | Student | Achievement Gallery — 16 badges, rarity, NXS rewards |
| `app/student-privacy.tsx` | `/student-privacy` | Student | Privacy & Security |
| `app/student-help.tsx` | `/student-help` | Student | Help & Support |
| `app/student-terms.tsx` | `/student-terms` | Student | Terms & Privacy |
| `app/instructor-privacy.tsx` | `/instructor-privacy` | Instructor | Data Stewardship |
| `app/instructor-help.tsx` | `/instructor-help` | Instructor | Instructor Support Center |
| `app/instructor-terms.tsx` | `/instructor-terms` | Instructor | Legal & Compliance |

---

## Hooks

### Nexus Placeholder Hooks (`hooks/nexus/`)

These are no-op hooks scaffolded for future integrations. All return stable interfaces and never throw.

| Hook | Future Integration |
|---|---|
| `useIndoorPositioning` | BLE beacon indoor positioning |
| `useBlockchainAttestation` | On-chain attendance attestation |
| `useAIAttendancePrediction` | ML-based attendance prediction |
| `useSmartwatchSync` | Wearable device sync |
| `useVoiceCommand` | Native speech recognition |

---

## Services

All services are in `geoapp/services/` and are **never modified by the UI layer**.

### AuthService
- `signIn(email, password)` → `{ success, error? }`
- `signOut()` → void
- `authenticateWithBiometric()` → `{ success, error? }`

### GeofenceService
- `getCurrentLocation()` → `LocationResult`
- `isWithinGeofence(coords, fence)` → `GeofenceCheckResult { inside, distanceMetres }`
- `isAccuracyAcceptable(metres)` → boolean

### AttendanceService
- `markAttendance(classId, selfieUrl?)` → `AttendanceResult { success, reason? }`
- `ERRORS` map — human-readable error messages keyed by reason code

### ReportService
- `generateReport(classId, options)` → report data

---

## Database Schema

Managed via Supabase migrations in `supabase/migrations/`.

### Tables

**`profiles`**
```sql
id          uuid (FK → auth.users)
full_name   text
role        text  -- 'student' | 'instructor'
student_id  text  -- optional institutional ID
created_at  timestamptz
```

**`classes`**
```sql
id                uuid
instructor_id     uuid (FK → profiles)
name              text
course_code       text
geofence_lat      float8
geofence_lng      float8
geofence_radius_m float8
created_at        timestamptz
```

**`class_sessions`**
```sql
id          uuid
class_id    uuid (FK → classes)
started_at  timestamptz
ended_at    timestamptz
is_active   boolean
```

**`enrollments`**
```sql
id          uuid
class_id    uuid (FK → classes)
student_id  uuid (FK → profiles)
```

**`attendance_logs`**
```sql
id          uuid
session_id  uuid (FK → class_sessions)
student_id  uuid (FK → profiles)
class_id    uuid (FK → classes)
signed_at   timestamptz
latitude    float8
longitude   float8
accuracy_m  float8
verified    boolean
```

Row-Level Security (RLS) is enabled on all tables. Students can only read/write their own records; instructors can read records for their classes.

---

## Google OAuth Setup (required for "Continue with Google")

Google sign-in requires a one-time configuration in both Google Cloud Console and your Supabase project.

### Step 1 — Create Google OAuth credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add these to **Authorized redirect URIs**:
   ```
   https://szsicpnrbnhcxakpinqa.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

### Step 2 — Enable Google in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication → Providers → Google**
3. Toggle **Enable Google provider**
4. Paste your **Client ID** and **Client Secret**
5. Save

### Step 3 — Add the redirect URL to app.json

The `scheme: "nexusattendance"` is already set in `app.json`. No changes needed.

That's it — Google sign-in will work on device after these steps.

---



The full Nexus UI is entirely in source code — it will look identical on any machine. The only thing you need to provide is a Supabase connection.

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/nexus-attendance.git
cd nexus-attendance/geoapp

# 2. Install dependencies
npm install

# 3. Create your env file (copy this, fill in your values)
cat > .env.local << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# 4. Apply the database schema (paste into Supabase SQL Editor)
# File: supabase/migrations/001_initial_schema.sql

# 5. Start
npx expo start
```

> The app will boot and show the full Nexus UI immediately. Without `.env.local`, the preloader and all static UI still works — only Supabase data calls will fail.

---

## Environment Setup

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your device (or iOS/Android simulator)
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/nexus-attendance.git
cd nexus-attendance/geoapp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `geoapp/.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Apply database migrations

In your Supabase dashboard → SQL Editor, run the contents of:
```
supabase/migrations/001_initial_schema.sql
```

Or using the Supabase CLI:
```bash
supabase db push
```

---

## Running the App

```bash
# Start Expo development server
cd geoapp
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run in web browser
npx expo start --web
```

Scan the QR code with Expo Go on your device for the fastest development experience.

---

## Testing

```bash
cd geoapp

# Run all tests (single pass, no watch mode)
npx jest --no-coverage

# Run property-based tests only
npx jest constants/__tests__/nexus.property.test.ts hooks/nexus/__tests__/placeholderHooks.property.test.ts --no-coverage
```

### Test Coverage

| File | Type | Tests |
|---|---|---|
| `constants/__tests__/theme.test.ts` | Unit | NexusColors keys, NexusFonts, NexusSpacing, NexusRadius, Colors.light/dark preservation |
| `constants/__tests__/nexus.property.test.ts` | Property-based | 7 correctness properties (Colors preservation, tab icon color, GPS state color, proximity zone color, attendance button gating, attendance result state, placeholder hooks) |
| `hooks/nexus/__tests__/placeholderHooks.test.ts` | Unit | All 5 placeholder hooks return correct interface shapes |
| `hooks/nexus/__tests__/placeholderHooks.property.test.ts` | Property-based | All 5 hooks never throw on any invocation |
| `services/__tests__/` | Unit + Integration + Property | AuthService, GeofenceService, AttendanceService, ReportService |

Property-based tests use [fast-check](https://github.com/dubzzz/fast-check) to generate arbitrary inputs and verify invariants hold across all cases.

---

## Project Structure

```
Geo-App/
├── geoapp/                     # React Native / Expo app
│   ├── app/                    # Expo Router file-based routes
│   ├── assets/                 # Images, icons, splash screen
│   ├── components/             # Shared + Nexus component library
│   ├── constants/              # Design tokens (theme.ts)
│   ├── hooks/                  # Custom hooks + nexus placeholders
│   ├── lib/                    # Supabase client
│   ├── navigation/             # AppNavigator (auth gate)
│   ├── screens/                # Role-branched screen components
│   ├── services/               # Business logic layer
│   └── scripts/                # Utility scripts
├── supabase/
│   └── migrations/             # SQL migration files
└── .kiro/
    └── specs/                  # Feature specs (requirements, design, tasks)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.
