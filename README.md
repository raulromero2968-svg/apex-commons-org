# Apex Commons: The Public Knowledge Library

![Status](https://img.shields.io/badge/Status-Alpha-cyan) ![License](https://img.shields.io/badge/License-MIT-blue) ![Stack](https://img.shields.io/badge/Stack-Vite_tRPC_Drizzle-purple)

> **"Open Knowledge for the AGI Era"**

Apex Commons is a community-governed, open-source repository for educational resources. It serves as the "public good" pillar of the Apex Ecosystem, designed to democratize access to knowledge through a gamified, reputation-based economy.

---

## Architecture & Tech Stack

We utilize a **Type-Safe, Full-Stack** architecture designed for developer experience and rapid iteration.

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React (Vite) | High-performance, client-side rendering with instant HMR. |
| **Styling** | TailwindCSS | Utility-first styling with a custom "Cyber-Grid" theme. |
| **API Layer** | tRPC | End-to-end type safety without schema definitions or code generation. |
| **Backend** | Node.js (Express/Standalone) | Lightweight server hosting the tRPC router. |
| **Database** | SQLite (via Drizzle ORM) | Portable, serverless-ready SQL database (File-based for local dev). |
| **Validation** | Zod | Runtime schema validation for all inputs and environment variables. |

---

## Key Features

### 1. The Discovery Engine (`/browse`)
- **Search & Filter:** Real-time filtering by Category, Grade Level, and Resource Type.
- **URL Sync:** All filters sync to the URL for easy sharing.
- **Optimistic UI:** Skeleton loaders and instant feedback loops.
- **Infinite Scroll:** Cursor-based pagination for seamless browsing.

### 2. The Contribution Pipeline (`/contribute`)
- **Metadata Validation:** Strict Zod schemas ensure high-quality data entry.
- **Hybrid Uploads:** Supports external links (Drive, YouTube) and file metadata.
- **Teacher Verification:** Role-based access control restricts uploads to verified educators.
- **Status Tracking:** Draft, Pending, Approved, Rejected states with moderation workflow.

### 3. The Moral Engine (Reputation System)
- **Gamified Economy:** Users earn **Reputation Credits (RC)** for contributions and upvotes.
- **Leveling Logic:** Automatic promotion (Bronze -> Silver -> Gold -> Platinum) based on RC thresholds.
- **Transaction Ledger:** Complete history of all RC gains and losses.
- **Incentive Alignment:** High-quality contributions are rewarded; spam is filtered.

### 4. Community Governance (`/governance`)
- **Democratic Control:** Users spend RC to propose platform changes.
- **Voting:** Weighted voting system to approve or reject proposals.
- **Transparency:** Full history of passed and rejected measures.

### 5. Teacher Dashboard (`/dashboard`)
- **Contribution Management:** View all your resources with status, views, and downloads.
- **Reputation Tracking:** Monitor your RC balance and progress to the next level.
- **Activity Feed:** Recent reputation transactions and milestones.

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/apex-commons.git
   cd apex-commons
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Initialize the Database:**
   This creates the local SQLite file and pushes the schema.
   ```bash
   pnpm db:push
   ```

4. **Start the Development Server:**
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:5173`.

---

## Project Structure

```
├── client/                 # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/     # Shared UI components (ResourceCard, VoteButton)
│   │   ├── pages/          # Route views (Browse, Dashboard, Contribute)
│   │   ├── lib/            # tRPC client and helpers
│   │   └── hooks/          # Custom hooks (useDebounce, useAuth)
│
├── server/                 # Backend (tRPC)
│   ├── routers/            # Logic Domains
│   │   ├── resourceRouter.ts  # CRUD for Library Content
│   │   ├── reputation.ts      # Gamification & History
│   │   └── governanceRouter.ts # Proposals & Voting
│   └── _core/              # Router initialization & Middleware
│
├── drizzle/                # Database Layer
│   └── schema.ts           # Single Source of Truth for Data Models
│
└── drizzle.config.ts       # Migration configuration
```

---

## API Reference

### Resources Router (`resource.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `browse` | Query | Paginated resource listing with filters |
| `getById` | Query | Get single resource by ID |
| `create` | Mutation | Create new resource (teacher+) |
| `getMyResources` | Query | Get all resources by logged-in user |
| `vote` | Mutation | Upvote/downvote a resource |
| `trackDownload` | Mutation | Track resource download |

### Reputation Router (`reputation.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `getHistory` | Query | User's RC transaction history |
| `getMyStats` | Query | User's reputation stats & level |
| `getLeaderboard` | Query | Top contributors |
| `syncLevel` | Mutation | Update user level based on RC |

### Governance Router (`governance.*`)

| Procedure | Type | Description |
|-----------|------|-------------|
| `listProposals` | Query | Active governance proposals |
| `createProposal` | Mutation | Submit new proposal |
| `vote` | Mutation | Vote on a proposal |

---

## Reputation Credits (RC) Economy

| Action | RC Awarded |
|--------|------------|
| Resource Submitted | +10 RC |
| Resource Approved | +50 RC |
| Upvote Received | +5 RC |
| Downvote Received | -2 RC |
| Resource Downloaded | +1 RC |

### Level Thresholds

| Level | RC Required |
|-------|-------------|
| Bronze | 0 |
| Silver | 1,000 |
| Gold | 5,000 |
| Platinum | 10,000 |

---

## Governance & Roles

The platform enforces the following Role-Based Access Control (RBAC):

- **User:** Can view resources, vote (requires login), and earn RC.
- **Teacher:** Can upload resources and access the Teacher Dashboard.
- **Moderator:** Can approve/reject pending resources and flag content.
- **Admin:** Full system access.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Run production server |
| `pnpm check` | TypeScript type checking |
| `pnpm db:push` | Push schema to database |
| `pnpm test` | Run tests |

---

## Future Roadmap

- [ ] **Blob Storage Integration:** Replace external link uploads with S3/Vercel Blob.
- [ ] **Comments System:** Threaded discussions on Resource Detail pages.
- [ ] **Federated Auth:** Connect Apex Commons identity with the main Apex Ecosystem.
- [ ] **Mobile App:** React Native port for on-the-go learning.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

Apex Commons is part of the Apex Ecosystem, designed to balance "Public Good" with "Private Profit" - democratizing access to knowledge while building sustainable technology.

---

*Built with dedication for educators worldwide.*
