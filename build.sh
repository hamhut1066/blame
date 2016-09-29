#!/usr/bin/sh
tsc --module commonjs ./src/blame.ts
mkdir -p ./build
mv ./src/blame.js ./build/
mv ./src/types.js ./build/
mv ./src/tracking.js ./build/
