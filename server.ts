import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure data and uploads directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STATE_FILE = path.join(DATA_DIR, 'app-state.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Ensure subfolders for images and maps
['images', 'maps', 'objects'].forEach((folder) => {
  const p = path.join(UPLOADS_DIR, folder);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static route for uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// Default initial state
const defaultAppState = {
  nodes: {
    'node-1': {
      id: 'node-1',
      x: '2350px',
      y: '2300px',
      title: 'Scene 01: The Citadel Courtyard',
      image: null,
      mapImage: null,
      mapName: 'Citadel Plaza Map',
      enfoque: 'Wide tracking shot following the envoy arriving through the ancient granite archways.',
      accion: 'Guards react to the sudden arrival; gates slowly swing shut with atmospheric dust.',
      descripcion: 'Cinematic overcast lighting, cold stone tones with golden banners for high visual contrast.',
      pins: [
        {
          id: 'pin-node-1-1',
          num: 1,
          type: 'enfoque',
          text: 'Camera tracking speed should match the envoy steps.',
          author: 'Director',
          x: 48,
          y: 42,
          replies: [{ author: 'DP', text: 'Will use 50mm anamorphic prime.' }],
          review: true,
          done: false,
          edited: false,
        },
        {
          id: 'pin-node-1-2',
          num: 2,
          type: 'accion',
          text: 'Gatekeepers alert the high council bells.',
          author: 'Writer',
          x: 75,
          y: 30,
          replies: [],
          review: false,
          done: true,
          edited: false,
        },
      ],
      drawings: [],
      mapDrawings: [],
      videos: { enfoque: null, accion: null, descripcion: null },
      pinCounter: 2,
      containerId: 'text-1',
    },
    'node-2': {
      id: 'node-2',
      x: '2700px',
      y: '2300px',
      title: 'Scene 02: Council Chambers',
      image: null,
      mapImage: null,
      mapName: '',
      enfoque: 'Low-angle medium close-up of the High Envoy presenting the seal.',
      accion: 'Tension builds as the parchment is unrolled across the obsidian table.',
      descripcion: 'Warm candle-lit interior with deep amber shadows and sharp specular highlights.',
      pins: [],
      drawings: [],
      mapDrawings: [],
      videos: { enfoque: null, accion: null, descripcion: null },
      pinCounter: 0,
      containerId: 'text-1',
    },
  },
  connections: [
    {
      id: 'conn-1',
      source: 'node-1',
      sourcePort: 'right',
      target: 'node-2',
      targetPort: 'left',
      type: 'curve',
      style: 'solid',
      color: '#0052cc',
      label: 'Continues to',
      arrows: 'end',
    },
  ],
  texts: {
    'text-1': {
      id: 'text-1',
      x: '2300px',
      y: '2220px',
      text: 'Act I: The Arrival Sequence',
      mode: 'container',
      color: '#0052cc',
      size: 14,
      bold: true,
      italic: false,
      labelId: 'lbl-1',
      width: 700,
      height: 380,
    },
    'text-2': {
      id: 'text-2',
      x: '2350px',
      y: '2150px',
      text: 'Production Workflow Board',
      mode: 'floating',
      color: '#e2e8f0',
      size: 28,
      bold: true,
      italic: false,
      labelId: '',
    },
  },
  labels: {
    'lbl-1': { name: 'Act I - Sequence', color: '#0052cc' },
    'lbl-2': { name: 'Needs Review', color: '#ff5630' },
    'lbl-3': { name: 'Final Polish', color: '#36b37e' },
  },
  storedNodes: {},
  globalVideos: [
    {
      id: 'dQw4w9WgXcQ',
      name: 'Cinematography Camera Movement Reference',
      date: new Date().toLocaleDateString(),
      author: 'Lead Artist',
    },
  ],
};

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading state file:', err);
  }
  return defaultAppState;
}

function writeState(state: unknown) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing state file:', err);
    return false;
  }
}

// User authentication endpoint
app.post('/api/login', (req, res) => {
  const { username, pin } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }
  // Admin role or Editor
  const role = username.toLowerCase() === 'viewer' ? 'Viewer' : 'Admin';
  return res.json({
    success: true,
    user: {
      name: username,
      role: role,
      email: `${username.toLowerCase()}@workspace.local`,
    },
  });
});

// Load state
app.get('/api/state', (_req, res) => {
  const state = readState();
  res.json(state);
});

// Save state
app.post('/api/state', (req, res) => {
  const state = req.body;
  if (!state || typeof state !== 'object') {
    return res.status(400).json({ error: 'Invalid state payload' });
  }
  const success = writeState(state);
  res.json({ success });
});

// Upload image (base64 or data url)
app.post('/api/upload', (req, res) => {
  try {
    const { base64Data, filename, folder = 'images' } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    const safeFolder = ['images', 'maps', 'objects'].includes(folder) ? folder : 'images';
    const folderPath = path.join(UPLOADS_DIR, safeFolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Split base64 header
    const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(base64Data, 'base64');

    const cleanName = `${Date.now()}_${(filename || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(folderPath, cleanName);

    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${safeFolder}/${cleanName}`;
    res.json({ success: true, url: fileUrl, filename: cleanName, id: cleanName });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// Download full project source zip (without node_modules, fully compatible with Windows Explorer)
app.get('/api/download-project', (_req, res) => {
  try {
    const zipPath = path.join(__dirname, 'public', 'visual-workflow-canvas.zip');
    execSync(
      `python3 -c "
import shutil, os, tempfile
exclude_names = {'node_modules', '.git', '.aistudio', 'public'}
zip_output = os.path.join('${__dirname}', 'public', 'visual-workflow-canvas')

with tempfile.TemporaryDirectory() as tmpdir:
    dest = os.path.join(tmpdir, 'visual-workflow-canvas')
    os.makedirs(dest)
    for item in os.listdir('${__dirname}'):
        if item in exclude_names:
            continue
        src_item = os.path.join('${__dirname}', item)
        dst_item = os.path.join(dest, item)
        if os.path.isdir(src_item):
            shutil.copytree(src_item, dst_item)
        else:
            shutil.copy2(src_item, dst_item)
    dest_public = os.path.join(dest, 'public')
    os.makedirs(dest_public, exist_ok=True)
    pub_dir = os.path.join('${__dirname}', 'public')
    if os.path.exists(pub_dir):
        for pitem in os.listdir(pub_dir):
            if pitem.endswith('.zip') or pitem.endswith('.tar.gz'):
                continue
            psrc = os.path.join(pub_dir, pitem)
            pdst = os.path.join(dest_public, pitem)
            if os.path.isdir(psrc):
                shutil.copytree(psrc, pdst)
            else:
                shutil.copy2(psrc, pdst)
    shutil.make_archive(zip_output, 'zip', tmpdir, 'visual-workflow-canvas')
"`,
      { cwd: __dirname }
    );
    return res.download(zipPath, 'visual-workflow-canvas.zip');
  } catch (err: any) {
    console.error('Error generating project zip:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate zip' });
  }
});

// Get gallery images
app.get('/api/gallery/:folder', (req, res) => {
  try {
    const folder = req.params.folder;
    const safeFolder = ['images', 'maps', 'objects'].includes(folder) ? folder : 'images';
    const folderPath = path.join(UPLOADS_DIR, safeFolder);

    if (!fs.existsSync(folderPath)) {
      return res.json([]);
    }

    const files = fs.readdirSync(folderPath);
    const items = files
      .filter((file) => !file.startsWith('.') && fs.statSync(path.join(folderPath, file)).isFile())
      .map((file) => ({
        id: file,
        name: file.replace(/^\d+_/, ''),
        url: `/uploads/${safeFolder}/${file}`,
      }));

    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete gallery images
app.post('/api/gallery/delete', (req, res) => {
  try {
    const { fileIds, folder = 'images' } = req.body;
    const safeFolder = ['images', 'maps', 'objects'].includes(folder) ? folder : 'images';
    const folderPath = path.join(UPLOADS_DIR, safeFolder);

    if (Array.isArray(fileIds)) {
      fileIds.forEach((id) => {
        const filePath = path.join(folderPath, id);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Development vs Production static/Vite mounting
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
