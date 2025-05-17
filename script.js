// Image storage and URL management
const dbName = 'imageStorage';
const storeName = 'images';
let db;

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
  });
};

// Generate short URL key
const generateKey = () => {
  return Math.random().toString(36).substring(2, 8);
};

// Store image in IndexedDB
const storeImage = async (imageData) => {
  const key = generateKey();
  try {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(imageData, key);
      
      request.onsuccess = () => resolve(key);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    handleDBError(error);
    throw error;
  }
};

// Retrieve image from IndexedDB
const getImage = async (key) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Handle URL routing
const handleRoute = async () => {
  const path = window.location.pathname;
  if (path.startsWith('/img/')) {
    const key = path.slice(5);
    try {
      const imageData = await getImage(key);
      if (imageData) {
        // Create and show image
        const img = document.createElement('img');
        img.src = imageData;
        img.className = 'wall-image';
        document.getElementById('infinity-wall').appendChild(img);
      }
    } catch (error) {
      console.error('Error loading image:', error);
    }
  }
};

// Save scroll position
const saveScrollPosition = () => {
  const scrollPos = window.scrollY;
  sessionStorage.setItem('scrollPosition', scrollPos.toString());
};

// Restore scroll position
const restoreScrollPosition = () => {
  const scrollPos = sessionStorage.getItem('scrollPosition');
  if (scrollPos) {
    window.scrollTo(0, parseInt(scrollPos));
  }
};

// Initialize everything
window.addEventListener('load', async () => {
  await initDB();
  handleRoute();
  restoreScrollPosition();
  
  // Save scroll position before unload
  window.addEventListener('beforeunload', saveScrollPosition);
  
  // Handle scroll position on hash change
  window.addEventListener('hashchange', restoreScrollPosition);

  // --- Load images and background from URL if present (for embed/iframe) ---
  (function loadFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const imagesParam = params.get('images');
    const bgParam = params.get('bg');
    if (imagesParam) {
      const urls = decodeURIComponent(imagesParam).split(',').map(u => u.trim()).filter(Boolean);
      uploadedImages = urls.map(url => ({ src: url }));
    }
    if (bgParam) {
      currentBgColor = decodeURIComponent(bgParam);
      updateBackgrounds(currentBgColor);
      if (bgColorInput) bgColorInput.value = currentBgColor;
    }
  })();
});

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80',
];

const wall = document.getElementById('infinity-wall');
const container = document.getElementById('infinity-wall-container');
let uploadedImages = [];
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;
const ROWS = 20, COLS = 20, CELL_SIZE = 120, GAP = 24;

let targetScrollLeft = 0;
let targetScrollTop = 0;
let isSmoothScrolling = false;

// --- Apple Watch Dock-like Horizontal Dock ---
let isDockDragging = false;
let dockStartX = 0, dockScrollLeft = 0, dockVelocity = 0, dockLastMove = 0, dockMomentumId = null;

// --- Animation loop control ---
let isAnimating = false;
let isUserInteracting = false;
let scrollTimeoutId = null;

// --- Color input and dynamic background/gradient update ---
const bgColorInput = document.getElementById('bg-color-input');
let currentBgColor = bgColorInput ? bgColorInput.value : '#888888';

function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const num = parseInt(hex, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function updateBackgrounds(color) {
  // Set body and grid backgrounds
  document.body.style.background = color;
  container.style.background = color;
  wall.style.background = 'transparent';
  // Update edge gradient overlay
  const [r, g, b] = hexToRgb(color);
  const edgeGradient =
    `linear-gradient(to right, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0) 8%, rgba(${r},${g},${b},0) 92%, rgba(${r},${g},${b},1) 100%),` +
    `linear-gradient(to bottom, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0) 8%, rgba(${r},${g},${b},0) 92%, rgba(${r},${g},${b},1) 100%)`;
  const edgeOverlay = document.getElementById('edge-gradient-overlay');
  if (edgeOverlay) edgeOverlay.style.background = edgeGradient;
  // Update .rect-box background for all boxes (unless they have an image)
  document.querySelectorAll('.rect-box').forEach(box => {
    const hasImg = box.querySelector('img');
    if (!hasImg) {
      box.style.background = color;
    }
  });
}

if (bgColorInput) {
  bgColorInput.addEventListener('input', (e) => {
    currentBgColor = e.target.value;
    updateBackgrounds(currentBgColor);
  });
  // Initial set
  updateBackgrounds(currentBgColor);
}

function startScaleAnimationLoop() {
  if (isAnimating) return;
  isAnimating = true;
  requestAnimationFrame(scaleAnimationFrame);
}

function stopScaleAnimationLoop() {
  isAnimating = false;
}

function scaleAnimationFrame() {
  applyParallaxAndScaleEffect();
  if (isAnimating) {
    requestAnimationFrame(scaleAnimationFrame);
  }
}

// Start animation loop on scroll, stop it 100ms after scroll ends
container.addEventListener('scroll', () => {
  startScaleAnimationLoop();
  if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
  scrollTimeoutId = setTimeout(() => {
    stopScaleAnimationLoop();
  }, 100);
});

container.addEventListener('mousedown', (e) => {
  isDockDragging = true;
  isUserInteracting = true;
  setBoxTransformTransition(false);
  startScaleAnimationLoop();
  dockStartX = e.pageX;
  dockScrollLeft = container.scrollLeft;
  dockLastMove = Date.now();
  dockVelocity = 0;
  if (dockMomentumId) cancelAnimationFrame(dockMomentumId);
  container.style.cursor = 'grabbing';
});
container.addEventListener('mouseleave', () => {
  if (isDockDragging) {
    isDockDragging = false;
    isUserInteracting = false;
    container.style.cursor = '';
    snapDockToCenter();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('mouseup', () => {
  if (isDockDragging) {
    isDockDragging = false;
    isUserInteracting = false;
    container.style.cursor = '';
    snapDockToCenter();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('mousemove', (e) => {
  if (!isDockDragging) return;
  e.preventDefault();
  const dx = e.pageX - dockStartX;
  const now = Date.now();
  dockVelocity = (dx) / (now - dockLastMove + 1);
  dockLastMove = now;
  container.scrollLeft = dockScrollLeft - dx;
  // No per-event scale update
});
// Touch events for mobile
container.addEventListener('touchstart', (e) => {
  isDockDragging = true;
  isUserInteracting = true;
  setBoxTransformTransition(false);
  startScaleAnimationLoop();
  dockStartX = e.touches[0].pageX;
  dockScrollLeft = container.scrollLeft;
  dockLastMove = Date.now();
  dockVelocity = 0;
  if (dockMomentumId) cancelAnimationFrame(dockMomentumId);
});
container.addEventListener('touchend', () => {
  if (isDockDragging) {
    isDockDragging = false;
    isUserInteracting = false;
    snapDockToCenter();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('touchcancel', () => {
  if (isDockDragging) {
    isDockDragging = false;
    isUserInteracting = false;
    snapDockToCenter();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('touchmove', (e) => {
  if (!isDockDragging) return;
  const dx = e.touches[0].pageX - dockStartX;
  const now = Date.now();
  dockVelocity = (dx) / (now - dockLastMove + 1);
  dockLastMove = now;
  container.scrollLeft = dockScrollLeft - dx;
  // No per-event scale update
});

// --- Apple Watch Dock-like Momentum for 2D Grid ---
let dragStartX = 0, dragStartY = 0, dragScrollLeft = 0, dragScrollTop = 0;
let dragLastX = 0, dragLastY = 0, dragLastTime = 0;
let velocityX = 0, velocityY = 0, momentumFrame = null;

container.addEventListener('mousedown', (e) => {
  isDragging = true;
  isUserInteracting = true;
  setBoxTransformTransition(false);
  startScaleAnimationLoop();
  dragStartX = dragLastX = e.pageX;
  dragStartY = dragLastY = e.pageY;
  dragScrollLeft = container.scrollLeft;
  dragScrollTop = container.scrollTop;
  dragLastTime = Date.now();
  velocityX = velocityY = 0;
  if (momentumFrame) cancelAnimationFrame(momentumFrame);
  container.style.cursor = 'grabbing';
});
container.addEventListener('mouseleave', () => {
  if (isDragging) {
    isDragging = false;
    isUserInteracting = false;
    container.style.cursor = '';
    startMomentum();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    isUserInteracting = false;
    container.style.cursor = '';
    startMomentum();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const now = Date.now();
  const dx = e.pageX - dragLastX;
  const dy = e.pageY - dragLastY;
  velocityX = dx / (now - dragLastTime + 1);
  velocityY = dy / (now - dragLastTime + 1);
  dragLastX = e.pageX;
  dragLastY = e.pageY;
  dragLastTime = now;
  container.scrollLeft -= dx;
  container.scrollTop -= dy;
  // No per-event scale update
});
container.addEventListener('touchstart', (e) => {
  isDragging = true;
  isUserInteracting = true;
  setBoxTransformTransition(false);
  startScaleAnimationLoop();
  dragStartX = dragLastX = e.touches[0].pageX;
  dragStartY = dragLastY = e.touches[0].pageY;
  dragScrollLeft = container.scrollLeft;
  dragScrollTop = container.scrollTop;
  dragLastTime = Date.now();
  velocityX = velocityY = 0;
  if (momentumFrame) cancelAnimationFrame(momentumFrame);
});
container.addEventListener('touchend', () => {
  if (isDragging) {
    isDragging = false;
    isUserInteracting = false;
    startMomentum();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('touchcancel', () => {
  if (isDragging) {
    isDragging = false;
    isUserInteracting = false;
    startMomentum();
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
});
container.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  const now = Date.now();
  const dx = e.touches[0].pageX - dragLastX;
  const dy = e.touches[0].pageY - dragLastY;
  velocityX = dx / (now - dragLastTime + 1);
  velocityY = dy / (now - dragLastTime + 1);
  dragLastX = e.touches[0].pageX;
  dragLastY = e.touches[0].pageY;
  dragLastTime = now;
  container.scrollLeft -= dx;
  container.scrollTop -= dy;
  // No per-event scale update
});

function getImages() {
  return uploadedImages.length > 0 ? uploadedImages.map(img => img.src) : PLACEHOLDER_IMAGES;
}

function smoothScrollTo(left, top) {
  targetScrollLeft = left;
  targetScrollTop = top;
  if (!isSmoothScrolling) {
    isSmoothScrolling = true;
    setBoxTransformTransition(false);
    startScaleAnimationLoop();
    requestAnimationFrame(animateScrollStep);
  }
}

function animateScrollStep() {
  const currentLeft = container.scrollLeft;
  const currentTop = container.scrollTop;
  const dx = targetScrollLeft - currentLeft;
  const dy = targetScrollTop - currentTop;
  // Use a springy ease
  container.scrollLeft += dx * 0.18;
  container.scrollTop += dy * 0.18;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    requestAnimationFrame(animateScrollStep);
  } else {
    container.scrollLeft = targetScrollLeft;
    container.scrollTop = targetScrollTop;
    isSmoothScrolling = false;
    setTimeout(() => setBoxTransformTransition(true), 0);
    setTimeout(() => stopScaleAnimationLoop(), 200);
  }
}

// =============================
// APPLE GRID STYLE (Reusable)
// =============================
/**
 * Renders the Apple Grid style (classic grid with infinite scroll, parallax, and image logic).
 * Usage: renderAppleGrid(targetWall, imagesOverride, hideEmbedBtn)
 */
function renderAppleGrid(targetWall = wall, imagesOverride = null, hideEmbedBtn = false) {
  targetWall.innerHTML = '';
  const boxSize = window.innerWidth <= 600 ? 80 : 120;
  const gapSize = window.innerWidth <= 600 ? Math.round(30 * 1.3 * 1.3) : Math.round(54 * 1.3 * 1.3); // Increased gap
  const visibleCols = Math.ceil(window.innerWidth / (boxSize + gapSize));
  const visibleRows = Math.ceil(window.innerHeight / (boxSize + gapSize));
  const COLS = visibleCols * 3;
  const ROWS = visibleRows * 3;
  let images = imagesOverride || getImages();
  images = images.slice();
  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }
  targetWall.style.display = 'grid';
  targetWall.style.gridTemplateColumns = `repeat(${COLS}, ${boxSize}px)`;
  targetWall.style.gridTemplateRows = `repeat(${ROWS}, ${boxSize}px)`;
  targetWall.style.gap = `${gapSize}px`;
  targetWall.style.width = `${COLS * boxSize + (COLS - 1) * gapSize}px`;
  targetWall.style.height = `${ROWS * boxSize + (ROWS - 1) * gapSize}px`;
  container.style.overflowY = 'auto';
  container.style.overflowX = 'auto';

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const imgIdx = Math.floor(Math.random() * images.length);
      const box = document.createElement('div');
      box.className = 'rect-box';
      box.dataset.row = row;
      box.dataset.col = col;
      if (!hideEmbedBtn) box.onclick = () => showExpandedModal(images[imgIdx]);
      let hasImg = false;
      if (uploadedImages.length > 0 || (uploadedImages.length === 0 && images[imgIdx])) {
        const img = document.createElement('img');
        const src = images[imgIdx].startsWith('http') ? images[imgIdx] : '/images/' + images[imgIdx];
        img.src = src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '0';
        img.draggable = false;
        box.appendChild(img);
        hasImg = true;
      }
      if (!hasImg) {
        box.style.background = currentBgColor;
      }
      targetWall.appendChild(box);
    }
  }
  highlightCenterCell();
  updateBackgrounds(currentBgColor);
}

function snapDockToCenter() {
  const boxes = wall.querySelectorAll('.rect-box');
  const { scrollLeft, clientWidth } = container;
  let minDist = Infinity, snapIdx = 0;
  boxes.forEach((box, i) => {
    const boxRect = box.getBoundingClientRect();
    const boxCenter = boxRect.left + boxRect.width / 2;
    const dist = Math.abs((window.innerWidth / 2) - boxCenter);
    if (dist < minDist) {
      minDist = dist;
      snapIdx = i;
    }
  });
  const box = boxes[snapIdx];
  const boxRect = box.getBoundingClientRect();
  const boxCenter = boxRect.left + boxRect.width / 2;
  const scrollTo = container.scrollLeft + (boxCenter - window.innerWidth / 2);
  smoothScrollTo(scrollTo, 0);
}

window.addEventListener('resize', () => {
  renderAppleGrid();
  setTimeout(() => {
    highlightCenterCell();
    applyParallaxAndScaleEffect();
  }, 100);
});
document.addEventListener('DOMContentLoaded', function() {
  renderAppleGrid();
  setTimeout(() => {
    highlightCenterCell();
    applyParallaxAndScaleEffect();
  }, 100);
});

// Expanded modal overlay
function showExpandedModal(imgSrc) {
  let modal = document.getElementById('expanded-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'expanded-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.style.transition = 'background 0.3s';
    modal.innerHTML = '';
    document.body.appendChild(modal);
  } else {
    modal.innerHTML = '';
    modal.style.display = 'flex';
  }
  // Responsive modal image container
  const imgWrap = document.createElement('div');
  imgWrap.style.background = '#222';
  imgWrap.style.borderRadius = '32px';
  imgWrap.style.boxShadow = '0 16px 64px 0 rgba(0,0,0,0.45), 0 2px 8px 0 rgba(0,0,0,0.18)';
  imgWrap.style.overflow = 'hidden';
  imgWrap.style.position = 'relative';
  imgWrap.style.display = 'flex';
  imgWrap.style.alignItems = 'center';
  imgWrap.style.justifyContent = 'center';
  imgWrap.style.maxWidth = '90vw';
  imgWrap.style.maxHeight = '80vh';
  imgWrap.style.width = 'min(90vw, 600px)';
  imgWrap.style.height = 'min(80vh, 600px)';
  // Mobile override
  if (window.innerWidth <= 600) {
    imgWrap.style.maxWidth = '98vw';
    imgWrap.style.maxHeight = '60vh';
    imgWrap.style.width = '98vw';
    imgWrap.style.height = '60vh';
  }
  const img = document.createElement('img');
  const src = imgSrc.startsWith('http') ? imgSrc : '/images/' + imgSrc;
  img.src = src;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  imgWrap.appendChild(img);
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '16px';
  closeBtn.style.right = '16px';
  closeBtn.style.background = 'rgba(0,0,0,0.6)';
  closeBtn.style.color = 'white';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.width = '36px';
  closeBtn.style.height = '36px';
  closeBtn.style.fontSize = '1.5rem';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.zIndex = '2';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    modal.style.display = 'none';
  };
  imgWrap.appendChild(closeBtn);
  modal.appendChild(imgWrap);
  // Close on click outside
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };
}

// Handle adding image URLs
const addUrlBtn = document.getElementById('add-url-btn');
const photoUrlUpload = document.getElementById('photo-url-upload');
if (addUrlBtn && photoUrlUpload) {
  addUrlBtn.addEventListener('click', () => {
    const raw = photoUrlUpload.value;
    if (!raw.trim()) return;
    // Split by comma or newline
    const urls = raw.split(/[,\n]/).map(u => u.trim()).filter(Boolean);
    // Validate URLs (basic check)
    const validUrls = urls.filter(url => url.match(/^https?:\/\//i));
    if (validUrls.length === 0) {
      alert('Please enter at least one valid image URL (starting with http or https).');
      return;
    }
    // Add to uploadedImages (avoid duplicates)
    validUrls.forEach(url => {
      if (!uploadedImages.some(img => img.src === url)) {
        uploadedImages.push({ src: url });
      }
    });
    renderAppleGrid();
    photoUrlUpload.value = '';
  });
}

// --- Copy only the #infinity-wall grid HTML with images and inline styles, suitable for iframe srcdoc ---
document.getElementById('copy-embed-btn').addEventListener('click', async () => {
  try {
    const images = uploadedImages.map(img => encodeURIComponent(img.src));
    if (images.length === 0) throw new Error('No images to export.');
    // Inline styles for grid and boxes
    const gridStyle = "display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:24px;padding:32px;";
    const boxStyle = "background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;cursor:pointer;";
    const imgStyle = "width:100%;height:100%;object-fit:cover;display:block;";
    const gridHtml = `<div id=\"infinity-wall\" style=\"${gridStyle}\">` +
      images.map(url => `<div class=\"rect-box\" style=\"${boxStyle}\"><img src=\"${decodeURIComponent(url)}\" alt=\"Image\" style=\"${imgStyle}\"></div>`).join('') +
      `</div>`;
    await navigator.clipboard.writeText(gridHtml);
    const copyBtn = document.getElementById('copy-embed-btn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
  } catch (error) {
    alert('Failed to copy grid HTML: ' + error.message);
  }
});

// Image upload logic
const photoUpload = document.getElementById('photo-upload');
if (photoUpload) {
  photoUpload.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
    const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total
    let totalSize = 0;
    
    // Validate file sizes first
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large. Maximum size is 5MB per file.`);
        return;
      }
      totalSize += file.size;
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      alert('Total size of uploaded images should be below 20MB.');
      return;
    }

    try {
      const uploadPromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = async (e) => {
            try {
              const imageData = e.target.result;
              const key = await storeImage(imageData);
              resolve({ key, imageData });
            } catch (error) {
              reject(error);
            }
          };
          
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(uploadPromises);
      
      // Update the grid with new images
      results.forEach(({ imageData }) => {
        uploadedImages.push({ src: imageData });
      });
      
      // Re-render the grid
      renderAppleGrid();
      
      // Update URL with the first image's key
      if (results.length > 0) {
        const firstKey = results[0].key;
        window.history.pushState({}, '', `/img/${firstKey}`);
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload one or more images. Please try again.');
    }
  });
}

function startMomentum() {
  let vx = velocityX * 20; // scale up for more natural feel
  let vy = velocityY * 20;
  setBoxTransformTransition(false);
  startScaleAnimationLoop();
  function step() {
    container.scrollLeft -= vx;
    container.scrollTop -= vy;
    vx *= 0.92; // friction
    vy *= 0.92;
    if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
      momentumFrame = requestAnimationFrame(step);
    } else {
      // Optionally, snap to nearest cell here
      // snapToNearestCell();
      setTimeout(() => setBoxTransformTransition(true), 0);
      setTimeout(() => stopScaleAnimationLoop(), 200);
    }
  }
  step();
}

function applyParallaxAndScaleEffect() {
  const boxes = document.querySelectorAll('.rect-box');
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  const maxScale = 1.5; // Increased by 20% from 1.25
  const minScale = 1.0;
  const maxDist = Math.sqrt((window.innerWidth/2)**2 + (window.innerHeight/2)**2);
  boxes.forEach(box => {
    const rect = box.getBoundingClientRect();
    const cellCenterX = rect.left + rect.width / 2;
    const cellCenterY = rect.top + rect.height / 2;
    const dist = Math.sqrt((cellCenterX - viewportCenterX) ** 2 + (cellCenterY - viewportCenterY) ** 2);
    let t = Math.min(dist / (maxDist * 0.5), 1); // 0 at center, 1 at half-diagonal
    t = t * t; // quadratic falloff
    const scale = minScale + (maxScale - minScale) * (1 - t);
    box.style.transform = `scale(${scale})`;
    box.style.zIndex = Math.round(scale * 100);
    // Remove .focused logic for seamless effect
  });
}

function highlightCenterCell() {
  const boxes = wall.querySelectorAll('.rect-box');
  const { scrollLeft, clientWidth } = container;
  const centerX = scrollLeft + clientWidth / 2;
  boxes.forEach(box => {
    const boxRect = box.getBoundingClientRect();
    const boxCenter = boxRect.left + boxRect.width / 2;
    const dist = Math.abs(centerX - (boxRect.left + boxRect.width / 2));
    if (dist < 10) {
      box.classList.add('focused');
    } else {
      box.classList.remove('focused');
    }
  });
}

// Add cleanup function for IndexedDB
const cleanupStorage = async () => {
  try {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    
    await new Promise((resolve, reject) => {
      request.onsuccess = resolve;
      request.onerror = reject;
    });
    
    uploadedImages = [];
    renderAppleGrid();
  } catch (error) {
    console.error('Error cleaning up storage:', error);
  }
};

// Add error handling for IndexedDB operations
const handleDBError = (error) => {
  console.error('IndexedDB error:', error);
  if (error.name === 'QuotaExceededError') {
    alert('Storage quota exceeded. Please delete some images and try again.');
    cleanupStorage();
  }
};

// Update embed code generation with better error handling
document.getElementById('copy-embed-btn').addEventListener('click', async () => {
  try {
    // Get current URL and parameters
    const currentUrl = new URL(window.location.href);
    const params = new URLSearchParams(currentUrl.search);
    
    // Add image keys to URL parameters
    const imageKeys = uploadedImages.map(img => {
      const key = img.src.split('/').pop();
      return key;
    });
    
    if (imageKeys.length > 0) {
      params.set('images', imageKeys.join(','));
    }
    
    // Add background color if set
    if (currentBgColor) {
      params.set('bg', currentBgColor);
    }
    
    // Update URL with parameters
    currentUrl.search = params.toString();
    
    // Create embed code
    const embedCode = `<iframe src="${currentUrl.toString()}" style="width:100%;height:600px;border:none;background:${currentBgColor};"></iframe>`;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(embedCode);
    
    // Show success message
    const copyBtn = document.getElementById('copy-embed-btn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy embed code:', error);
    alert('Failed to copy embed code. Please try again.');
  }
});

// --- Copy iframe (srcdoc) ---
document.getElementById('copy-iframe-srcdoc-btn').addEventListener('click', async () => {
  try {
    const images = uploadedImages.map(img => encodeURIComponent(img.src));
    if (images.length === 0) throw new Error('No images to export.');
    const gridStyle = "display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:24px;padding:32px;";
    const boxStyle = "background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;cursor:pointer;";
    const imgStyle = "width:100%;height:100%;object-fit:cover;display:block;";
    const gridHtml = `<div id=\"infinity-wall\" style=\"${gridStyle}\">` +
      images.map(url => `<div class=\"rect-box\" style=\"${boxStyle}\"><img src=\"${decodeURIComponent(url)}\" alt=\"Image\" style=\"${imgStyle}\"></div>`).join('') +
      `</div>`;
    const iframe = `<iframe srcdoc='${gridHtml.replace(/'/g, "&apos;")}' width="100%" height="600" frameborder="0"></iframe>`;
    await navigator.clipboard.writeText(iframe);
    const btn = document.getElementById('copy-iframe-srcdoc-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch (error) {
    alert('Failed to copy iframe: ' + error.message);
  }
});

// --- Copy iframe (URL) ---
document.getElementById('copy-iframe-url-btn').addEventListener('click', async () => {
  try {
    const images = uploadedImages.map(img => img.src);
    if (images.length === 0) throw new Error('No images to export.');
    const imageString = encodeURIComponent(images.join(','));
    const colorString = encodeURIComponent(currentBgColor);
    const url = `${window.location.origin}/grid.html?images=${imageString}&bg=${colorString}`;
    const iframe = `<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`;
    await navigator.clipboard.writeText(iframe);
    const btn = document.getElementById('copy-iframe-url-btn');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch (error) {
    alert('Failed to copy iframe: ' + error.message);
  }
});

// --- Download Grid HTML ---
document.getElementById('download-grid-html-btn').addEventListener('click', () => {
  const images = uploadedImages.map(img => img.src);
  if (images.length === 0) {
    alert('No images to export.');
    return;
  }
  const gridStyle = "display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:24px;padding:32px;";
  const boxStyle = "background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden;position:relative;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;cursor:pointer;";
  const imgStyle = "width:100%;height:100%;object-fit:cover;display:block;";
  const gridHtml = `<div id=\"infinity-wall\" style=\"${gridStyle}\">` +
    images.map(url => `<div class=\"rect-box\" style=\"${boxStyle}\"><img src=\"${url}\" alt=\"Image\" style=\"${imgStyle}\"></div>`).join('') +
    `</div>`;
  const html = `<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<title>Infinity Wall Export</title>\n<style>body{margin:0;padding:0;background:#EEECE5;font-family:'Inter','Segoe UI',Arial,sans-serif;}#infinity-wall-container{width:100vw;height:100vh;overflow:auto;}#infinity-wall{${gridStyle}}.rect-box{${boxStyle}}.rect-box img{${imgStyle}}</style>\n</head>\n<body>\n<div id=\"infinity-wall-container\">${gridHtml}</div>\n</body>\n</html>`;
  const blob = new Blob([html.replace(/\\n/g, '\n').replace(/\\"/g, '"')], {type: 'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'infinity-wall-grid.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}); 