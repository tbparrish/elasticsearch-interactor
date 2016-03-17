#!/bin/bash
if [ -e handlers/entrypoint.js ]; then
   rm handlers/entrypoint.js;
fi
for h in handlers/*.js; do echo "var $(basename -s .js $h | tr - _) = require(\"./$(basename $h)\");" >> handlers/entrypoint.js;done

$(npm bin)/obfuscator --strings --no-color --out elasticsearch-interactor.js --entry index.js index.js && \
$(npm bin)/obfuscator --strings --no-color --out handlers/handlers.js --entry handlers/entrypoint.js handlers/*.js helpers/*.js helpers/**/*.js
