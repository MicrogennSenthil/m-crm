#!/bin/bash
set -e
npm install
printf '\n\n\n\n\n\n\n\n\n\n' | npm run db:push -- --force || true
