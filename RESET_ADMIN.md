# Can't Log In as Admin? Reset Instructions

## Default Credentials

**Username:** `admin`
**Password:** `admin123`

If these don't work, the admin user may have been deleted or the database needs reset.

## Option 1: Check Docker Logs

```bash
docker compose logs app | grep -i admin
```

Look for:
- `✅ Default admin user created` - Admin was created successfully
- `✅ Admin user already exists` - Admin exists but password may have changed
- `❌ Error initializing admin user` - Something went wrong

## Option 2: Recreate Admin User (If Deleted)

If you deleted the admin user by accident, you need to recreate it.

### Manual Database Fix:

```bash
# 1. Access the Docker container
docker compose exec app sh

# 2. Run Node to create admin user
node -e "
const bcrypt = require('bcrypt');
const { createUser, getUserByUsername } = require('./server/dataAccess');

// Check if admin exists
const existing = getUserByUsername('admin');
if (existing) {
  console.log('Admin already exists with ID:', existing.id);
} else {
  // Create new admin
  const hash = bcrypt.hashSync('admin123', 10);
  const adminId = createUser('admin', null, hash, true);
  console.log('Admin created with ID:', adminId);
  console.log('Username: admin');
  console.log('Password: admin123');
}
"

# 3. Exit container
exit
```

## Option 3: Complete Database Reset (Nuclear Option)

⚠️ **WARNING:** This deletes ALL data including users, logs, tasks, everything!

```bash
# Stop containers
docker compose down

# Delete database volumes
docker volume rm djotter_djotter-data djotter_djotter-journal

# Restart (will recreate with fresh admin)
docker compose up -d

# Check logs
docker compose logs -f
```

You should see:
```
✅ Default admin user created (ID: 1)
   Username: admin
   Password: admin123
```

## Option 4: Change Admin Password (If You Remember Old One)

If you can log in with the old password but want to reset it:

1. Login as admin
2. Click settings (⚙️) → User Management
3. Find the admin user
4. Click 🔑 (Reset Password)
5. Enter new password

## Option 5: Environment Variable Password

If you set `ADMIN_PASSWORD` in your `.env` file or `docker-compose.yml`, that's the password.

Check your environment:
```bash
# Check docker-compose.yml
cat docker-compose.yml | grep ADMIN_PASSWORD

# Or check if .env exists
cat .env 2>/dev/null | grep ADMIN_PASSWORD
```

## Troubleshooting Login Errors

### "Invalid credentials"
- Password is wrong
- Admin user doesn't exist
- Try Option 2 to recreate admin

### "Error loading application data"
- Database corruption
- Try Option 3 (database reset)

### Page won't load at all
- Server not running: `docker compose ps`
- Check logs: `docker compose logs -f`

## After Reset

Once you can log in:
1. **Immediately change the admin password**
2. Create a second admin account as backup
3. Never delete the last admin account!

## Need Help?

If none of these work, check:
```bash
# Container status
docker compose ps

# Recent logs
docker compose logs --tail=50

# Database files exist?
docker volume ls | grep djotter
```
