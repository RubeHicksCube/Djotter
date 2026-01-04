# Djotter - Daily Jotter v1.0.0

An otter-themed, self-hosted daily journal application for logging activities minute-by-minute and exporting to your favorite second-brain apps.

## ✨ Features

- **Health Metrics Tracking**: Sleep, heart rate, alcohol consumption, exercise, mood, energy, and stress levels
- **Daily Journaling**: Markdown-based journal entries with automatic date organization
- **User Management**: Built-in authentication with admin controls for multi-user support
- **Data Export**: Export your data as Markdown or PDF files for backup and analysis
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Docker Ready**: Easy deployment with Docker Compose

## 📋 Prerequisites

Before you begin, make sure you have installed:

- **Docker Desktop** (includes Docker and Docker Compose)
  - [Download for Windows/Mac](https://www.docker.com/products/docker-desktop/)
  - Linux: Install Docker Engine and Docker Compose separately
- **Git** (to clone the repository)
  - [Download Git](https://git-scm.com/downloads)

**OR** for manual installation:
- Node.js 18+ and npm

## 🚀 Quick Start (Docker Compose - Recommended)

This is the easiest way to get Djotter running. Follow these steps exactly:

```bash
# 1. Clone the repository
git clone https://github.com/RubeHicksCube/Djotter.git
cd Djotter

# 2. Start the application (first time will take 5-10 minutes to build)
docker compose up -d

# 3. Wait for the container to be ready
# Check the logs to see when it's ready:
docker compose logs -f

# When you see "Server is running on port 8000", press Ctrl+C to exit logs

# 4. Access the application
# Open http://localhost:8001 in your browser
```

**Default Login Credentials:**
- Username: `admin`
- Password: `admin123`

> ⚠️ **Security Warning**: Change the default password and JWT secret after first login!

### First Time Setup

After logging in for the first time:
1. Click on your username → **Profile**
2. Change your password
3. Update timezone preferences
4. Optionally customize environment variables (see Configuration section)

## 🔧 Manual Installation

### Without Docker (Advanced Users)

If you prefer not to use Docker, you can run Djotter directly with Node.js:

```bash
# 1. Clone the repository
git clone https://github.com/RubeHicksCube/Djotter.git
cd Djotter

# 2. Install server dependencies
npm install

# 3. Install client dependencies
cd client
npm install
cd ..

# 4. Build the React client
npm run build

# 5. (Optional) Set up environment variables
# Create a .env file with your configuration (see Configuration section)

# 6. Start the application
npm start
```

The application will be available at:
- **Production mode**: `http://localhost:8000`
- **Development mode**: `http://localhost:8001` (use `npm run dev` instead of `npm start`)

### Development Mode

For active development with hot-reload:

```bash
# Start both backend and frontend in development mode
npm run dev
```

This runs:
- Backend server on `http://localhost:8000`
- Frontend dev server on `http://localhost:3000` (with proxy to backend)

## ⚙️ Configuration

### Changing Default Credentials (Recommended)

For security, you should change the default admin password and JWT secret.

#### Option 1: Using Environment Variables (Recommended for Docker)

Create a `.env` file in the root directory **before** starting Docker:

```env
# Security - CHANGE THESE VALUES
ADMIN_PASSWORD=your-secure-password-here
JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long

# Optional: Custom admin username (default is 'admin')
ADMIN_USERNAME=admin
```

Then start Docker Compose as normal:
```bash
docker compose up -d
```

Docker Compose will automatically use the values from your `.env` file.

#### Option 2: Direct Edit in docker-compose.yml

Edit the `docker-compose.yml` file and change the default values:

```yaml
environment:
  - ADMIN_PASSWORD=your-secure-password-here
  - JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long
```

> 💡 **Tip**: Use a password manager to generate a strong JWT_SECRET (32+ characters)

#### Option 3: Change Password After First Login

You can also change the password after logging in:
1. Login with default credentials (`admin` / `admin123`)
2. Click on your username → **Profile**
3. Update your password

> ⚠️ **Note**: The JWT_SECRET should still be changed in the `.env` file for production use

### Other Configuration Options

```env
# Application Settings
NODE_ENV=production          # or 'development'
PORT=8000                    # Internal container port (don't change unless needed)

# Admin Settings
ADMIN_USERNAME=admin         # Default admin username
ADMIN_PASSWORD=admin123      # Default admin password (CHANGE THIS!)
JWT_SECRET=change-this-secret-key-in-production  # JWT signing key (CHANGE THIS!)
```

## 🗂️ Data Storage

Djotter uses in-memory state management with optional persistent storage:

- **User Accounts**: SQLite database (`data/djotter.db`) for authentication
- **Daily State**: In-memory per-user state for entries, trackers, and custom fields
- **Snapshots**: Saved to `journal/` directory as Markdown files with YAML frontmatter
- **Exports**: Available in both Markdown and PDF formats

### Docker Volumes

When using Docker Compose, data is stored in named volumes:
- `djotter-data`: SQLite database and structured data
- `djotter-journal`: Markdown journal entries

## 📱 Usage Guide

### First Steps

1. **Login**: Use the default admin credentials (`admin` / `admin123`)
2. **Profile**: Navigate to Profile → Update your password and preferences
3. **Start Tracking**: Use the Home page to track daily activities, moods, tasks, etc.
4. **Journal**: Add journal entries for reflection and documentation

### Tracking Features

**Time Since Trackers**: Track elapsed time since specific events
**Activity Duration Timers**: Start/stop timers for activities with manual time entry
**Custom Counters**: Track daily counts (water, coffee, etc.) with auto-reset
**Profile Fields**: Persistent custom fields that appear in all exports
**Activity Entries**: Log activities with timestamps throughout the day

### Journaling

- Create daily entries using Markdown
- Automatic file organization by date
- Support for YAML frontmatter
- Export functionality for backup

### User Management (Admin)

As an administrator, you can:
- Create and manage user accounts
- Assign admin roles to users
- **Privacy**: Each user's data is completely isolated and private
- Admins can manage accounts but cannot see other users' journal data

## 🔒 Security & Privacy

- **Authentication**: JWT-based authentication with secure tokens
- **Password Security**: Bcrypt password hashing with salt
- **Per-User Data Isolation**: Each user's data is completely separate and private
- **Admin Boundaries**: Admins can manage users but cannot access their journal data
- **Environment Variables**: Sensitive data stored in environment variables
- **No External Dependencies**: Completely self-contained, no external service calls

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Start development servers
npm run dev
```

This starts:
- Backend server on `http://localhost:8001`
- Frontend development server on `http://localhost:3001` (with proxy to backend)

### Project Structure

```
Djotter/
├── server/                 # Node.js backend
│   ├── index.js           # Main server file
│   └── routes/            # API route handlers
├── client/                # React frontend
│   ├── src/               # React source code
│   └── dist/              # Built frontend
├── data/                  # SQLite database directory
├── journal/               # Markdown journal entries
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile            # Docker build configuration
└── package.json          # Node.js dependencies
```

## 📦 Backup and Restore

### Backup

```bash
# Docker volumes backup
docker run --rm -v djotter-data:/data -v djotter-journal:/journal -v $(pwd):/backup alpine tar czf /backup/djotter-backup.tar.gz /data /journal

# Manual backup (non-Docker)
cp -r data/ journal/ backup/
```

### Restore

```bash
# Docker volumes restore
docker run --rm -v djotter-data:/data -v djotter-journal:/journal -v $(pwd):/backup alpine tar xzf /backup/djotter-backup.tar.gz -C /
```

## 🔄 Updating Djotter

### Docker Compose Updates

When a new version is available on GitHub:

```bash
# 1. Stop the current container
docker compose down

# 2. Pull the latest code from GitHub
git pull

# 3. Rebuild the container with the new code
docker compose build --no-cache

# 4. Start the updated container
docker compose up -d

# 5. Verify it's running
docker compose logs -f
```

**Expected build times**:
- First build: 5-10 minutes
- Subsequent builds: 3-8 minutes (depending on changes)

> 💡 **Tip**: Your data is safe! Docker volumes (`djotter-data` and `djotter-journal`) persist across updates.

### Manual Updates (Without Docker)

```bash
# 1. Pull latest changes
git pull

# 2. Install any new dependencies
npm install
cd client && npm install && cd ..

# 3. Rebuild the client
npm run build

# 4. Restart the server
npm start
```

## 🐛 Troubleshooting

### Common Issues

#### Docker Installation Issues

**"docker: command not found" or "docker compose: command not found"**
- Docker is not installed or not in your PATH
- Solution: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- After installing, restart your terminal/command prompt
- Verify installation: `docker --version` and `docker compose version`

**"Cannot connect to the Docker daemon"**
- Docker Desktop is not running
- Solution: Start Docker Desktop application
- Wait for Docker to fully start (check system tray icon)

**"permission denied while trying to connect to the Docker daemon socket"**
- Linux only: Your user doesn't have Docker permissions
- Solution: `sudo usermod -aG docker $USER` then log out and back in
- Or run Docker commands with `sudo`

#### Application Issues

**Application won't start / Port already in use:**
- Port 8001 is already being used by another application
- Check what's using the port: `lsof -i :8001` (Mac/Linux) or `netstat -ano | findstr :8001` (Windows)
- Solution: Stop the other application or change the port in `docker-compose.yml`:
  ```yaml
  ports:
    - "8002:8000"  # Use 8002 instead of 8001
  ```

**Container keeps restarting / crashes:**
- Check the logs for errors: `docker compose logs -f`
- Common causes:
  - Out of memory (allocate more resources to Docker Desktop)
  - Port conflicts (see above)
  - Corrupted build (try `docker compose down` then rebuild)

**Can't access http://localhost:8001:**
- Verify container is running: `docker compose ps`
- Check container logs: `docker compose logs -f`
- Try accessing from the container IP directly
- Firewall might be blocking the connection
- Try `http://127.0.0.1:8001` instead

**Build is very slow or timing out:**
- First build takes 5-10 minutes - this is normal
- Slow internet can cause npm package downloads to timeout
- Docker Desktop resource limits may be too low
  - Go to Docker Desktop → Settings → Resources
  - Increase CPU and Memory allocation
- Try building without cache to start fresh: `docker compose build --no-cache`

**Can't login / "Invalid credentials":**
- Make sure you're using the default credentials:
  - Username: `admin`
  - Password: `admin123`
- Clear browser cache and cookies
- Try in an incognito/private browsing window
- Check container logs for authentication errors: `docker compose logs -f`

**Data not persisting after restart:**
- Volumes might not be properly created
- Check volumes exist: `docker volume ls | grep djotter`
- If volumes are missing, recreate them:
  ```bash
  docker compose down
  docker volume create djotter-data
  docker volume create djotter-journal
  docker compose up -d
  ```

**Changes to code not reflecting:**
- For Docker: You must rebuild after code changes
  ```bash
  docker compose down
  docker compose build --no-cache
  docker compose up -d
  ```
- For manual setup: Restart the server: `npm start`
- Clear browser cache or try incognito mode

### Health Check

The application includes a built-in health check endpoint:
```bash
# From outside the container
curl http://localhost:8001/api

# Or from inside the container
docker compose exec app wget -qO- http://localhost:8000/api
```

Should return a 200 status with JSON data about the application.

### Getting More Help

If you're still having issues:

1. **Check container status**: `docker compose ps`
2. **View full logs**: `docker compose logs -f`
3. **Check Docker resources**: Docker Desktop → Settings → Resources
4. **Verify Docker is working**: `docker run hello-world`
5. **Search existing issues**: [GitHub Issues](https://github.com/RubeHicksCube/Djotter/issues)
6. **Create a new issue** with:
   - Your operating system (Windows/Mac/Linux)
   - Docker version: `docker --version`
   - Error messages from logs
   - Steps you've already tried

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you encounter issues or have questions:

1. Check the troubleshooting section above
2. Search existing [GitHub Issues](https://github.com/RubeHicksCube/Djotter/issues)
3. Create a new issue with detailed information

## 🎯 Features & Updates (v1.0.0)

✅ **Completed**:
- Dark/Light theme toggle with persistence
- PDF export with professional formatting
- Markdown export with YAML frontmatter
- Per-user data isolation for privacy
- Timer pause/resume with elapsed time preservation
- Manual time entry for activity duration trackers
- Editable custom counter values
- Auto-save snapshots before exports

🔮 **Future Enhancements**:
- [ ] Data visualization and analytics
- [ ] Mobile app (React Native)
- [ ] Integration with health devices
- [ ] Multi-language support

---

## Sample Images

<img width="1382" height="1264" alt="Screenshot 2025-12-27 202059" src="https://github.com/user-attachments/assets/aa544be5-efcb-409b-ac74-1a37914fa8b3" />

<img width="1049" height="1231" alt="image" src="https://github.com/user-attachments/assets/72f8ccae-6eab-4063-9cd3-8d670d6aac2a" />

<img width="1397" height="1244" alt="Screenshot 2025-12-27 201959" src="https://github.com/user-attachments/assets/cdbdc9b5-9c39-4bbd-b13d-dff76efd5e3e" />

<img width="1403" height="1272" alt="Screenshot 2025-12-27 201753" src="https://github.com/user-attachments/assets/4a909d68-167c-48f9-8ad5-9a37b97dccd5" />

<img width="792" height="1121" alt="Screenshot 2025-12-27 203007" src="https://github.com/user-attachments/assets/d76df7fc-38a8-4162-a569-ae019c936275" />

<img width="793" height="1331" alt="Screenshot 2025-12-27 203029" src="https://github.com/user-attachments/assets/d1794d32-6710-4cac-81d8-933c175fe36a" />




**Djotter v1.0.0** - An otter-themed daily jotter built with ❤️ for daily journaling and personal productivity.
## Production Status

🦦 **Djotter is ready for production use!** 🚀

### ✅ Key Features
- Daily activity logging with minute-by-minute tracking
- Custom fields and templates for structured journaling  
- Time-since and duration trackers
- Custom counters for habit tracking
- Task management with recurring options
- Export to Markdown, PDF, and CSV formats
- Historical snapshots and search functionality
- Multi-user support with admin controls

### 🐛 Critical Fixes
- Fixed cache invalidation for delete/update operations
- Log entries now delete immediately from UI
- All tracker and counter operations reflect in real-time

### 📦 Deployment Ready
- Clean repository with no development files
- Docker deployment configurations available
- Security best practices implemented
- AGENTS.md documentation for maintainability

