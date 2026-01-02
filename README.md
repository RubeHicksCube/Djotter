# Djotter 🦦

> A self-hosted daily journal application for logging activities minute-by-minute and exporting to second-brain apps.

![Otter Logo](https://raw.githubusercontent.com/RubeHicksCube/Djotter/main/client/public/images/peeking-otter-top.png)

## ✨ Features

**Daily Journaling**
- 📝 Minute-by-minute activity tracking
- 🖼️ Image upload support (base64)
- 📅 Historical date navigation
- 🎨 Clean, responsive interface

**Custom Fields & Templates**
- ⚙️ Persistent profile fields
- 📋 Daily custom fields
- 🔄 Reusable field templates
- 📊 Multiple field types

**Trackers & Counters**
- ⏱️ Time-since trackers (e.g., "days since last coffee")
- 📊 Duration trackers with timer functionality
- 🔢 Custom counters for habits (water, calories, etc.)

**Task Management**
- ✅ Daily task creation and management
- 🔄 Recurring task support
- 📈 Task completion tracking

**Export & Search**
- 📄 Export to Markdown, PDF, and CSV formats
- 🔍 Historical snapshots
- 🔎 Full-text search across entries
- 📅 Date range exports

**Multi-User & Admin**
- 👥 Multiple user support
- 🛡️ Admin user management
- ⚙️ User profile controls

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Clone and run
git clone <new-repo-url>
cd djotter
docker-compose up -d
```

### Manual Installation

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Initialize database
npm run init-db

# Start development
npm run dev

# Start production
npm start
```

## 📖 Documentation

- **Admin Guide**: See `docs/admin-setup.md`
- **User Guide**: See `docs/user-guide.md`
- **API Documentation**: Available at `/api/docs` when running

## 🔧 Configuration

Environment variables (see `.env.example`):
- `JWT_SECRET`: Secret for authentication
- `PORT`: Server port (default: 8000)
- `NODE_ENV`: Set to `production` for deployment

## 🐳 Docker Configurations

Multiple Docker configurations available:
- `Dockerfile` - Production optimized
- `Dockerfile.dev` - Development with hot reload
- `Dockerfile.simple` - Minimal setup
- `Dockerfile.minimal` - Single-stage build

## 🛡️ Security

- JWT authentication with bcrypt
- SQL injection prevention with prepared statements
- Rate limiting on auth endpoints
- Helmet.js security headers
- CORS properly configured

## 📦 Production Ready

✅ Clean repository structure  
✅ Security best practices implemented  
✅ Containerized deployment options  
✅ Multi-user support  
✅ Comprehensive error handling  

## 🌟 v1.0.0 Features

- **Stable Core**: All critical features tested and production-ready
- **Bug Fixes**: Cache invalidation issues resolved
- **Performance**: Optimized queries and caching
- **Security**: Hardened authentication and data protection

---

**Perfect for personal journaling, habit tracking, and building your digital garden!** 🌱

---

*Built with ❤️ using Node.js, Express, React, and SQLite*