#!/bin/bash
# Quick script to recreate admin user if deleted

echo "============================================"
echo "RECREATE ADMIN USER"
echo "============================================"
echo ""

# Check if Docker container is running
if ! docker compose ps | grep -q "djotter.*Up"; then
  echo "❌ Container is not running!"
  echo "Please start it first: docker compose up -d"
  exit 1
fi

echo "This will recreate the default admin user."
echo "Username: admin"
echo "Password: admin123"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Creating admin user..."
docker compose exec app node -e "
const bcrypt = require('bcrypt');
const { createUser, getUserByUsername, deleteUser } = require('./server/dataAccess');

try {
  // Check if admin exists
  const existing = getUserByUsername('admin');

  if (existing) {
    console.log('⚠️  Admin user already exists (ID:', existing.id, ')');
    console.log('If you can\\'t login, the password may have been changed.');
    console.log('');
    console.log('To reset password:');
    console.log('1. Delete this admin user through another admin account');
    console.log('2. Or use Option 3 in RESET_ADMIN.md (database reset)');
  } else {
    // Create new admin
    const hash = bcrypt.hashSync('admin123', 10);
    const adminId = createUser('admin', null, hash, true);
    console.log('✅ Admin user created!');
    console.log('   ID:', adminId);
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('You can now login at http://localhost:8001');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
"

echo ""
echo "============================================"
echo "Done!"
echo "============================================"
