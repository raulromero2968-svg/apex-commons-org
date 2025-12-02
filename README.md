# Apex Commons: The Public Knowledge Library

![Status](https://img.shields.io/badge/Status-Alpha-cyan) ![License](https://img.shields.io/badge/License-MIT-blue) ![Stack](https://img.shields.io/badge/Stack-Vite_tRPC_Drizzle-purple)

> **"Open Knowledge for the AGI Era"**

Apex Commons is a community-governed, open-source repository for educational resources. It serves as the "public good" pillar of the Apex Ecosystem, designed to democratize access to knowledge through a gamified, reputation-based economy.

---

## Key Features

### 1. The Discovery Engine (`/browse`)
- **Search & Filter:** Real-time filtering by Category, Grade Level, and Resource Type.
- **URL Sync:** All filters sync to the URL for easy sharing.
- **Infinite Scroll:** Cursor-based pagination for seamless browsing.

### 2. The Contribution Pipeline (`/contribute`)
- **Metadata Validation:** Strict Zod schemas ensure high-quality data entry.
- **Hybrid Uploads:** Supports external links (Drive, YouTube) and file metadata.
- **Status Tracking:** Draft, Pending, Approved, Rejected states with moderation workflow.

### 3. The Moral Engine (Reputation System)
- **Gamified Economy:** Users earn **Reputation Credits (RC)** for contributions and upvotes.
- **Leveling Logic:** Automatic promotion (Bronze -> Silver -> Gold -> Platinum) based on RC thresholds.
- **Transaction Ledger:** Complete history of all RC gains and losses.

### 4. Community Governance (`/governance`)
- **Democratic Control:** Users spend RC to propose platform changes.
- **Voting:** Weighted voting system to approve or reject proposals.

### 5. Teacher Dashboard (`/dashboard`)
- **Contribution Management:** View all your resources with status, views, and downloads.
- **Reputation Tracking:** Monitor your RC balance and progress to the next level.
- **Activity Feed:** Recent reputation transactions and milestones.

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/apex-commons-org.git
   cd apex-commons-org
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database connection string
   ```

4. **Initialize the Database:**
   This creates the database schema using Drizzle ORM.
   ```bash
   pnpm db:push
   ```

5. **Start the Development Server:**
   ```bash
   pnpm dev
   ```

   The app will be available at `http://localhost:5173`.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Tailwind CSS 4, shadcn/ui |
| **State Management** | TanStack Query (React Query) |
| **API Layer** | tRPC v11 (End-to-end type safety) |
| **Database** | SQLite (dev) / PostgreSQL (prod) via Drizzle ORM |
| **Validation** | Zod schemas |
| **Authentication** | Session-based with cookies |

---

## Project Structure

```
apex-commons-org/
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── pages/           # Page components
│   │   │   ├── Browse.tsx   # Resource discovery
│   │   │   ├── Contribute.tsx # Resource submission
│   │   │   ├── Dashboard.tsx  # Teacher dashboard
│   │   │   └── ...
│   │   ├── lib/             # Utilities (trpc client)
│   │   └── hooks/           # Custom React hooks
│   └── public/              # Static assets
├── server/                  # Backend tRPC server
│   ├── routers/             # Domain-specific routers
│   │   ├── resourceRouter.ts
│   │   ├── reputation.ts
│   │   ├── governanceRouter.ts
│   │   └── ...
│   ├── _core/               # Core server infrastructure
│   └── db.ts                # Database connection
├── drizzle/                 # Database schema
│   └── schema.ts
└── shared/                  # Shared types & constants
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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

Apex Commons is part of the Apex Ecosystem, designed to balance "Public Good" with "Private Profit" - democratizing access to knowledge while building sustainable technology.

---

Built with dedication for educators worldwide.
