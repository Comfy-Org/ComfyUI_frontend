# Setup Repository

Bootstrap the ComfyUI Frontend monorepo with all necessary dependencies and verification checks.

## Overview

This command will:
1. Install all project dependencies using npm
2. Verify the project builds successfully
3. Run unit tests to ensure functionality
4. Start development server to verify frontend boots correctly

## Prerequisites Check

First, let's verify the environment:

```bash
# Check Node.js version (should be >= 24)
node --version

# Check if we're in a git repository
git status
```

## Step 1: Install Dependencies

```bash
# Install all dependencies using npm
echo "Installing project dependencies..."
npm install

# Verify node_modules exists and has packages
ls -la node_modules | head -5
```

## Step 2: Verify Build

```bash
# Run TypeScript type checking
echo "Running TypeScript checks..."
npm run typecheck

# Build the project
echo "Building project..."
npm run build

# Verify dist folder was created
ls -la dist/
```

## Step 3: Run Unit Tests

```bash
# Run unit tests
echo "Running unit tests..."
npm run test:unit

# If tests fail, show the output and stop
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Please fix failing tests before continuing."
  exit 1
fi

echo "✅ Unit tests passed successfully"
```

## Step 4: Verify Development Server

```bash
# Start development server in background
echo "Starting development server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start (check for port 5173 or similar)
echo "Waiting for server to start..."
sleep 10

# Check if server is running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "✅ Development server started successfully at http://localhost:5173"
  
  # Kill the background server
  kill $SERVER_PID
  wait $SERVER_PID 2>/dev/null
else
  echo "❌ Development server failed to start or is not accessible"
  kill $SERVER_PID 2>/dev/null
  wait $SERVER_PID 2>/dev/null
  exit 1
fi
```

## Step 5: Final Verification

```bash
# Run linting to ensure code quality
echo "Running linter..."
npm run lint

# Show project status
echo ""
echo "🎉 Repository setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run test:unit    - Run unit tests"
echo "  npm run test:component - Run component tests"
echo "  npm run typecheck    - Run TypeScript checks"
echo "  npm run lint         - Run ESLint"
echo "  npm run format       - Format code with Prettier"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start developing"
echo "2. Open http://localhost:5173 in your browser"
echo "3. Check README.md for additional setup instructions"
```

## Troubleshooting

If any step fails:

1. **Dependencies fail to install**: Try clearing cache with `npm cache clean --force` and retry
3. **Build fails**: Check for TypeScript errors and fix them first
4. **Tests fail**: Review test output and fix failing tests
5. **Dev server fails**: Check if port 5173 is already in use

## Manual Verification Steps

After running the setup, manually verify:

1. **Dependencies installed**: `ls node_modules | wc -l` should show many packages
2. **Build artifacts**: `ls dist/` should show built files
3. **Server accessible**: Open http://localhost:5173 in browser
4. **Hot reload works**: Edit a file and see changes reflect

## Environment Requirements

- Node.js >= 24
- Git repository
- Internet connection for package downloads
- Available ports (typically 5173 for dev server)