# Global MoMA Collaboration Globe

Interactive 3D globe of international artistic collaborations in the [MoMA collection](https://github.com/MuseumofModernArt/collection). Countries are shaded by collaboration activity; arcs show cross-country collaboration counts. Author dots inside each country represent individual collaborating artists.

## Project structure

```
collection-main/
├── Artworks.csv              # MoMA artwork records (~70 MB)
├── Artists.csv               # MoMA artist registry (bio, nationality)
├── data.ipynb                # Exploratory notebook
├── preprocessing/
│   ├── build_network.py      # Data pipeline → JSON
│   ├── artist_registry.py    # Canonical metadata from Artists.csv
│   ├── country_map.py        # Nationality → ISO mapping
│   └── geo_utils.py          # Country polygons & author placement
├── frontend/
│   ├── public/data/          # Pre-built JSON (served by Vite)
│   └── src/                  # React + Vite + react-globe.gl app
└── requirements.txt          # Python dependencies for preprocessing
```

## Quick start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`

### 1. Python environment & preprocessing

```bash
# From repo root
python -m venv .venv

# Windows
.venv\Scripts\activate
pip install -r requirements.txt
python preprocessing\build_network.py

# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
python preprocessing/build_network.py
```

This writes JSON to `frontend/public/data/` (and `data/processed/` locally, which is gitignored as a duplicate).

> **Note:** The repo includes pre-built JSON in `frontend/public/data/` so you can skip preprocessing and run the frontend directly.

### 2. Run the globe

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### 3. Production build

```bash
cd frontend
npm run build
npm run preview
```

Static output is in `frontend/dist/` — deploy to GitHub Pages, Netlify, or Vercel.

## Interaction guide

| Action | Result |
|--------|--------|
| **Rotate / zoom** | Explore the globe |
| **Hover country** | Country overview panel (top-left) |
| **Click country** | Pin country stats in panel only (map unchanged) |
| **Click author dot** | Author details (bio, works, top collaborations) + author arcs |
| **Search** | Find authors by name |
| **Weight filter** | Hide low-frequency country collaboration arcs |
| **Zoom in very close** | Country arcs hide; author arcs stay visible when an author is selected |

## Data model

- **Collaborations:** multi-artist works where artists from **2+ countries** share the same `ObjectID`
- **Author metadata:** from `Artists.csv` (name, bio, nationality)
- **Country arcs:** total collaboration count per country pair
- **Author arcs:** shown when an author is selected

| File | Description |
|------|-------------|
| `nodes.json` | Per-country stats and top partners |
| `edges.json` | Country-pair collaboration weights |
| `author_points.json` | Author dot positions inside countries |
| `author_summaries.json` | Lightweight author records for initial load |
| `authors.json` | Full author records including works |
| `country_polygons.json` | Pre-filtered GeoJSON for the globe |
| `search_index.json` | Author search index |
| `meta.json` | Build stats and defaults |

## Upload to GitHub

From the repo root (after cloning or first-time init):

```bash
# Install Git LFS once (required for Artworks.csv)
git lfs install

git init   # skip if already initialized
git add .
git commit -m "Initial commit: MoMA collaboration globe"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Repository size notes

- `Artworks.csv` is ~70 MB — tracked with **Git LFS** (install [Git LFS](https://git-lfs.com/) before pushing)
- Processed JSON in `frontend/public/data/` is ~26 MB total
- `.gitignore` excludes `node_modules/`, `.venv/`, `frontend/dist/`, duplicate `data/processed/`, and local scratch files
- `Artworks.json` / `Artists.json` are omitted (redundant; `Artworks.json` exceeds GitHub’s file size limit)

### GitHub Pages (optional)

1. Run `cd frontend && npm run build`
2. Deploy the `frontend/dist/` folder (e.g. GitHub Actions or `gh-pages` branch)
3. Set the site base path in `vite.config.ts` if using a project Pages URL (`/repo-name/`)

## License

MoMA collection data is used under [MoMA’s open data terms](https://github.com/MuseumofModernArt/collection). Visualization code is provided as-is for academic exploration.
