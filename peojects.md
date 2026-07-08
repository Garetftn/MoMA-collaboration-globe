goal: build up an interactive network visualisation in html or other format with good accesiibity
i want to build an interactive network visualisation of the relations of authors from different countries that collabrated on the sam eprojects.
use the data from @artworks.csv and data.ipynb.
finally result should be a globle map in the form of a real rotabeble earth, each countries that involved should be highlited, on a specturm according to the count of authors from that countries.
there should be curve lines connceting 2 counteries ecerytime the authors collabed between.
legend design: some meta data should be provieded on the conner of the visualisation: country name, authors count, top3 most frequent collabration targets. those information should automatly refelects to the country that the mouse is currently hover over.the country should also automately be highlied when hovered.
when the line is hovered, another legend should pop up and it contains the following infos: the work id, the work name, publish time, author'sname,2 countries name and a thumnail of the work if the links provieded in arworks.csv.


///
I created a detailed README-style specification document for Cursor covering:

* full project architecture
* preprocessing pipeline
* Gephi/network logic
* globe visualization design
* interaction behavior
* accessibility requirements
* recommended libraries
* frontend/backend structure
* data schemas
* performance considerations
* deployment targets
* optional extensions

It is structured so Cursor can directly use it as an implementation blueprint.
# Global MoMA Collaboration Globe

## Project Goal

Build an interactive globe-based network visualization showing international artistic collaborations from the MoMA artworks dataset.

The visualization should:

* Display a real rotatable 3D Earth
* Highlight countries involved in collaborations
* Color countries according to the number of participating authors/artists
* Draw animated curved connection lines between collaborating countries
* Provide interactive hover-based metadata panels
* Display artwork-level details when hovering collaboration lines
* Be accessible and visually clear
* Export as a standalone HTML application

The project uses:

* `artworks.csv`
* preprocessing logic from `data.ipynb`

---

# Recommended Technology Stack

## Core Visualization

Use:

* `Three.js`
* `react-globe.gl`
* `three-globe`

Reason:

* high-quality rotatable Earth
* curved arc support
* performant rendering
* hover interaction support
* easy country polygon integration
* HTML overlay compatibility

---

## Data Processing

Use:

* Python
* pandas
* networkx (optional)

Python should preprocess the raw MoMA data into:

* nodes dataset
* edges dataset
* country statistics dataset
* artwork metadata dataset

---

## Frontend

Recommended:

* React
* Vite
* TypeScript

Reason:

* component architecture
* strong ecosystem
* good interactivity
* easier state handling for hover panels

---

## Accessibility

Requirements:

* keyboard navigable UI
* high contrast labels
* scalable text
* screen-reader friendly metadata panels
* colorblind-safe color palette
* tooltips should remain readable on dark backgrounds

---

# Final Output

The final application should export as:

* standalone HTML build
* or deployable static web app

Target deployment:

* GitHub Pages
* Netlify
* Vercel

---

# Project Structure

Recommended structure:

```text
project/
│
├── data/
│   ├── artworks.csv
│   ├── processed/
│   │   ├── nodes.json
│   │   ├── edges.json
│   │   ├── countries.json
│   │   └── artworks_meta.json
│
├── preprocessing/
│   ├── data.ipynb
│   └── build_network.py
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── Globe.tsx
│   │   ├── CountryTooltip.tsx
│   │   ├── EdgeTooltip.tsx
│   │   └── Legend.tsx
│   │
│   ├── public/
│   └── package.json
│
└── README.md
```

---

# Data Processing Requirements

## Step 1 — Parse Nationalities

Use the existing preprocessing from `data.ipynb`.

Extract:

* artwork ID
* artwork title
* artwork year/date
* artist names
* artist nationalities
* artwork thumbnail URL

---

## Step 2 — Build Country Collaboration Network

Each artwork containing artists from multiple countries should generate collaboration edges.

Example:

```text
Artwork:
Artists from:
- France
- Germany
- Italy
```

Creates edges:

```text
France ↔ Germany
France ↔ Italy
Germany ↔ Italy
```

---

## Step 3 — Aggregate Collaboration Counts

Each edge should contain:

```json
{
  "source": "France",
  "target": "Germany",
  "weight": 24,
  "works": [...]
}
```

---

## Step 4 — Country Statistics

Each country node should contain:

```json
{
  "country": "France",
  "artist_count": 120,
  "top_collaborators": [
    "Germany",
    "USA",
    "Italy"
  ]
}
```

---

# Required Output Data Files

## nodes.json

Structure:

```json
[
  {
    "id": "France",
    "artistCount": 120,
    "lat": 46.2276,
    "lng": 2.2137,
    "topCollaborators": ["Germany", "USA", "Italy"]
  }
]
```

---

## edges.json

Structure:

```json
[
  {
    "source": "France",
    "target": "Germany",
    "weight": 24,
    "works": [
      {
        "workId": 123,
        "title": "Artwork Name",
        "year": 1984,
        "artists": ["Artist A", "Artist B"],
        "thumbnail": "https://..."
      }
    ]
  }
]
```

---

# Globe Visualization Requirements

## Globe Design

The Earth should:

* be fully rotatable
* support zoom
* support drag interaction
* use realistic Earth textures
* support smooth animation
* have atmosphere glow
* render smoothly on mid-range hardware

Recommended:

* dark background
* subtle stars
* glowing arcs

---

# Country Highlighting

Countries involved in collaborations should:

* be highlighted on hover
* change opacity when active
* scale color intensity according to artist count

Use a continuous color spectrum.

Recommended:

```text
low activity → light blue
high activity → bright red
```

or a perceptually uniform scale.

---

# Arc / Collaboration Line Design

Each collaboration edge should:

* be drawn as a curved arc above Earth
* animate softly
* have opacity based on collaboration weight
* support hover interactions
* support filtering by minimum weight

Arc thickness should scale with collaboration frequency.

---

# Country Hover Interaction

When hovering over a country:

* country polygon should highlight
* related arcs should emphasize
* side metadata panel should update automatically

---

# Country Hover Metadata Panel

The panel should display:

```text
Country Name
Artist Count
Top 3 Collaboration Targets
Total Collaboration Count
```

Optional:

* collaboration ranking
* regional grouping
* timeline statistics

---

# Edge Hover Interaction

When hovering over an arc:

* line should glow
* tooltip card should appear
* connected countries should highlight

---

# Edge Tooltip Requirements

Tooltip should contain:

* artwork ID
* artwork title
* artwork year/date
* artist names
* source country
* target country
* collaboration count
* thumbnail image if available

Example layout:

```text
Artwork: The Example Work
Year: 1984
Artists:
- Artist A
- Artist B
Countries:
France ↔ Germany
```

with artwork thumbnail preview.

---

# Geographic Data

Use GeoJSON country polygons.

Recommended sources:

* Natural Earth
* geojson-world-map
* world-atlas

Need:

* country polygons
* country centroids
* ISO country mapping

---

# Country Name Normalization

Very important.

The MoMA dataset nationality labels may not match geographic dataset labels.

Create normalization mapping.

Example:

```python
COUNTRY_MAP = {
    "American": "United States",
    "British": "United Kingdom",
    "Dutch": "Netherlands"
}
```

This mapping should be applied before visualization.

---

# Performance Requirements

The app should:

* remain interactive with hundreds/thousands of arcs
* avoid unnecessary rerenders
* lazy-load images if possible
* debounce hover events
* use memoization for expensive computations

---

# Accessibility Requirements

Must include:

* keyboard navigation
* visible focus states
* alt text for thumbnails
* readable typography
* sufficient contrast
* responsive layout

---

# Optional Features

## Timeline Filter

Allow filtering by year range.

Example:

```text
1950–1960
1970–1980
1990–2000
```

The globe should update dynamically.

---

## Weight Filter

Slider:

```text
Minimum Collaboration Count
```

Used to reduce visual clutter.

---

## Search

Search for:

* country
* artist
* artwork

---

## Cluster View

Optional community detection visualization.

---

# Suggested Libraries

## Globe

```bash
npm install react-globe.gl three three-globe
```

---

## Geo Data

```bash
npm install d3-geo topojson-client
```

---

## Tooltips / UI

```bash
npm install framer-motion
npm install @radix-ui/react-tooltip
```

---

# Suggested Development Order

## Phase 1

* preprocess data
* build nodes/edges JSON
* verify network correctness

---

## Phase 2

* render rotatable globe
* render country polygons
* render arcs

---

## Phase 3

* implement hover interactions
* metadata side panels
* edge tooltips

---

## Phase 4

* accessibility
* optimization
* responsive layout
* deployment

---

# Important Design Principle

This project should emphasize:

```text
global artistic collaboration as spatial cultural networks
```

The visualization should feel:

* exploratory
* academic
* aesthetically clean
* information rich
* accessible

Avoid excessive visual clutter.

---

# Deliverables

Final deliverables:

* preprocessing scripts
* cleaned JSON datasets
* interactive globe visualization
* deployable frontend build
* documentation
* accessible UI

---

# Main Research Interpretation Goal

The visualization should help reveal:

* central countries in artistic collaboration
* transnational artistic exchange
* global collaboration hubs
* regional artistic communities
* historical collaboration patterns
* cultural globalization trends

---

# Notes for Cursor

When implementing:

* prioritize data integrity first
* keep preprocessing modular
* normalize country names carefully
* optimize hover performance early
* separate data processing from rendering logic
* avoid tightly coupling UI with network calculations

The visualization should support future extensions such as:

* temporal animation
* artist-level networks
* institution-level networks
* museum collection comparison
* filtering by artistic medium
