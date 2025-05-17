function getImagesAndColorFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let images = [];
  let color = '#181818';
  if (params.has('images')) {
    const raw = params.get('images');
    if (raw) {
      images = decodeURIComponent(raw).split(',').map(u => u.trim()).filter(Boolean);
    }
  }
  if (params.has('bg')) {
    color = decodeURIComponent(params.get('bg'));
  }
  // Debug log
  console.log('Loaded images:', images, 'color:', color);
  return { images, color };
}

function renderGrid(images) {
  const wall = document.getElementById('infinity-wall');
  wall.innerHTML = '';
  if (!images.length) {
    wall.innerHTML = '<div style="color:#888;text-align:center;width:100%">No images found in URL.</div>';
    return;
  }
  const gridStyle = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:24px;padding:32px;';
  wall.style = gridStyle;
  images.forEach(name => {
    const src = name.startsWith('http') ? name : `/images/${name}`;
    const box = document.createElement('div');
    box.className = 'rect-box';
    box.style = 'background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Image';
    img.style = 'width:100%;height:100%;object-fit:cover;display:block;';
    box.appendChild(img);
    wall.appendChild(box);
  });
}

function updateBackground(color) {
  document.body.style.background = color;
  document.getElementById('infinity-wall-container').style.background = color;
  const edgeOverlay = document.getElementById('edge-gradient-overlay');
  if (edgeOverlay) edgeOverlay.style.background = color;
}

function syncFromUrl() {
  const { images, color } = getImagesAndColorFromUrl();
  renderGrid(images);
  updateBackground(color);
}

// Copy iframe button
const copyBtn = document.getElementById('copy-iframe-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    const url = window.location.href;
    const iframeCode = `<iframe src=\"${url}\" width=\"100%\" height=\"600\" frameborder=\"0\"></iframe>`;
    await navigator.clipboard.writeText(iframeCode);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
  });
}

// Initial render
syncFromUrl(); 