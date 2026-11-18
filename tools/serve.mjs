#!/usr/bin/env node
// Serve the project for the browser preview:  node tools/serve.mjs [--port 5173]   → open http://localhost:5173/
import { serve, parseArgs } from './lib.mjs';
const a = parseArgs();
const { url } = await serve(undefined, Number(a.port ?? 5173));
console.log(`The Pelican Test — preview at ${url}/   (Ctrl+C to stop)`);
