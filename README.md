# Treasure Hunt Challenge — Netlify deployment package

This is the source package for the Treasure Hunt multiplayer prototype.

## Important
Do **not** deploy this ZIP by dragging it onto Netlify Drop if you need multiplayer rooms. Netlify Drop publishes static files and does not build/deploy the serverless function in `netlify/functions/game.mjs`. That is why room creation may fail on the current site.

## Deploy so the server function is included
1. Create a new repository on GitHub (a private repository is fine).
2. Upload the contents of this folder to the repository's root. Upload the files and folders themselves, not the ZIP as a single file.
3. In Netlify, choose **Add new project** / **Import an existing project** and connect that GitHub repository.
4. When asked for build settings, use:
   - Build command: leave blank (or `npm install` if Netlify requires a command)
   - Publish directory: `.`
   - Functions directory: `netlify/functions` (normally read from `netlify.toml`)
5. Deploy the project. Then open the published site and test room creation.

## Included files
- `index.html` — game interface
- `netlify.toml` — Netlify build and functions configuration
- `package.json` — dependency declaration
- `netlify/functions/game.mjs` — multiplayer room API
- `README.md` — project notes and deployment guidance

This package is an initial prototype and needs to be tested after deployment. Do not delete the existing Netlify site until the new deployment is working.
