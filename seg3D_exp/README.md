# Seg3D Studio

Simple frontend for a Seg3D backend: upload a JPG, draw a contour, run Seg3D, and preview the resulting GLB in Three.js.

## Files
- `index.html`
- `styles.css`
- `app.js`

## Configure the backend
Edit `app.js` and update `API_CONFIG`:

```
const API_CONFIG = {
  baseUrl: 'https://api.yfcosmos.com',
  submitPath: '/seg3d',
  statusPath: '/seg3d/status',
  pollIntervalMs: 2000,
};
```

Expected backend behavior:
- `POST {baseUrl}{submitPath}` accepts multipart form:
  - `image`: the JPG/PNG file
  - `contour`: JSON string with `{ points: [{x,y}], width, height }`
- Response returns either:
  - `mesh_url` (or `result_url` / `glb_url`) for direct download, OR
  - `job_id` plus optional `status_url`
- `GET {baseUrl}{statusPath}/{job_id}` returns JSON with:
  - `status`: `queued|running|done|failed`
  - `mesh_url` when done

## CORS
Your backend must allow cross-origin requests from `https://yfcosmos.com` and `https://colinfirth5566.github.io`.
