#!/usr/bin/env node
// Launch the ClipFarm dashboard (read-only D1). Binds localhost by default.
// Usage: node bin/dashboard.js   (env: DASH_PORT, DASH_HOST)
import { start } from '../dashboard/server.js';
start();
