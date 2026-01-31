# Seg3D Studio

Static frontend that uploads JPG/PNG images, triggers a local Seg3D backend, and previews the resulting `.glb` in Three.js.

## Files
- `index.html`
- `styles.css`
- `app.js`
- `backend/` (local API)

## Usage
1. Start the local backend in `backend/`.
2. Open the site and upload JPG/PNG images.
3. Click **Run Seg3D** and wait for the `.glb` preview.

## Notes
- The frontend expects the backend at `http://localhost:8000`.
- If you open the site on `https://yfcosmos.com`, browsers may block requests to `http://localhost`.
  - Use a local copy of the site, or run the backend with HTTPS (e.g. ngrok/Cloudflare Tunnel).
